/**
 * Vibe Ship pipeline — package → import → push → url → verify.
 *
 * Detached job model (same as demo deploy / vibe build): POST returns jobId,
 * client polls GET until done. Never fabricates a live URL — only returns what
 * deploy-pipeline reads back from Zerops.
 *
 * Requires:
 *   - workspaceId from a ready Build (workspace still on disk)
 *   - Zerops PAT (demo operator or user)
 */

const path = require('path');
const crypto = require('crypto');
const { packageForZerops, cleanupDeployRoot } = require('./ship-packager');
const { deployApp } = require('../deploy-pipeline');
const buildPipeline = require('./build-pipeline');
const demoQuota = require('../llm/demo-quota');

/** @typedef {'queued'|'packaging'|'import'|'push'|'url'|'verify'|'ready'|'failed'} ShipJobStatus */

/**
 * @typedef {object} ShipJob
 * @property {string} id
 * @property {ShipJobStatus} status
 * @property {Array<{type:string, [k:string]: unknown}>} events
 * @property {string|null} workspaceId
 * @property {string|null} projectName
 * @property {string|null} projectId
 * @property {string|null} liveUrl
 * @property {boolean|null} verified
 * @property {number|null} httpStatus
 * @property {Record<string, string>|null} codeFiles
 * @property {string|null} error
 * @property {boolean} done
 * @property {number} startedAt
 * @property {number|null} finishedAt
 */

const MAX_EVENTS = 2000;
const RETAIN_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 45 * 60 * 1000;

/** @type {Map<string, ShipJob>} */
const jobs = new Map();

let seq = 0;

function prune(now = Date.now()) {
  for (const [id, job] of jobs) {
    const expired = job.finishedAt
      ? now - job.finishedAt > RETAIN_MS
      : now - job.startedAt > MAX_AGE_MS;
    if (expired) jobs.delete(id);
  }
}

/**
 * @param {{ workspaceId?: string, projectName?: string }} [opts]
 * @param {number} [now]
 * @returns {string}
 */
function createJob(opts = {}, now = Date.now()) {
  prune(now);
  seq += 1;
  const id = `ship-${now.toString(36)}-${seq.toString(36)}`;
  /** @type {ShipJob} */
  const job = {
    id,
    status: 'queued',
    events: [],
    workspaceId: opts.workspaceId || null,
    projectName: opts.projectName || null,
    projectId: null,
    liveUrl: null,
    verified: null,
    httpStatus: null,
    codeFiles: null,
    error: null,
    done: false,
    startedAt: now,
    finishedAt: null,
  };
  jobs.set(id, job);
  return id;
}

/**
 * @param {string} id
 * @returns {ShipJob|null}
 */
function getJob(id) {
  prune();
  return jobs.get(id) || null;
}

/**
 * @param {string} id
 * @param {Partial<ShipJob>} patch
 */
function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  const allowed = [
    'status',
    'workspaceId',
    'projectName',
    'projectId',
    'liveUrl',
    'verified',
    'httpStatus',
    'codeFiles',
    'error',
  ];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      job[key] = patch[key];
    }
  }
}

/**
 * @param {string} id
 * @param {{ type: string, [k: string]: unknown }} event
 */
function append(id, event) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  if (job.events.length >= MAX_EVENTS) return;
  job.events.push(event);
}

/**
 * @param {string} id
 * @param {{ type: string, [k: string]: unknown }} event
 * @param {Partial<ShipJob>} [patch]
 * @param {number} [now]
 */
function finish(id, event, patch = {}, now = Date.now()) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  if (patch && typeof patch === 'object') {
    updateJob(id, patch);
  }
  if (event && event.type === 'error' && event.error && !job.error) {
    job.error = String(event.error);
  }
  if (event && event.type === 'error') {
    job.status = 'failed';
  }
  if (event && event.type === 'done' && job.status !== 'failed') {
    job.status = 'ready';
  }
  job.events.push(event);
  job.done = true;
  job.finishedAt = now;
}

/**
 * @param {string} id
 * @param {number} [from]
 */
function readJob(id, from) {
  prune();
  const job = jobs.get(id);
  if (!job) return null;
  const start =
    from != null && Number.isFinite(from) && from > 0
      ? Math.min(from, job.events.length)
      : 0;
  return {
    id: job.id,
    status: job.status,
    events: job.events.slice(start),
    next: job.events.length,
    done: job.done,
    workspaceId: job.workspaceId,
    projectName: job.projectName,
    projectId: job.projectId,
    liveUrl: job.liveUrl,
    verified: job.verified,
    httpStatus: job.httpStatus,
    codeFiles: job.codeFiles,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

/**
 * Safe Zerops project name with unique suffix.
 * @param {string} [hint]
 */
function makeProjectName(hint) {
  const slug = String(hint || 'vibe-spa')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '');
  let base = slug || 'vibe-spa';
  if (base.length > 20) {
    base = base.slice(0, 20);
    const cut = base.lastIndexOf('-');
    if (cut > 6) base = base.slice(0, cut);
  }
  base = base.replace(/-+$/, '') || 'vibe-spa';
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}

/**
 * Resolve workspaceId from request body (workspaceId or build jobId).
 * @param {{ workspaceId?: string, jobId?: string, buildJobId?: string }} body
 * @returns {{ workspaceId: string, workspacePath: string } | { error: string, status: number }}
 */
function resolveShipWorkspace(body = {}) {
  let workspaceId = body.workspaceId ? String(body.workspaceId).trim() : '';
  const buildJobId = body.buildJobId || body.jobId || null;

  if (!workspaceId && buildJobId) {
    const snap = buildPipeline.readBuildJob(String(buildJobId));
    if (!snap) {
      return { error: 'Unknown or expired build job', status: 404 };
    }
    if (snap.status !== 'ready' || !snap.workspaceId) {
      return {
        error: 'Build job is not ready — Ship requires a successful Build first',
        status: 400,
      };
    }
    workspaceId = snap.workspaceId;
  }

  if (!workspaceId) {
    return { error: 'workspaceId (or build jobId) is required', status: 400 };
  }

  const workspacePath = buildPipeline.resolveWorkspacePath(workspaceId);
  if (!workspacePath) {
    return {
      error: 'Workspace not found — run Build again before Ship',
      status: 404,
    };
  }

  // Prefer an explicitly ready build for this workspace if we can find one.
  let readyFound = false;
  for (const job of buildPipeline.jobStore.jobs.values()) {
    if (job.workspaceId === workspaceId && job.status === 'ready') {
      readyFound = true;
      break;
    }
  }
  // If workspace is still on disk from a finished build, allow ship even if
  // the job was pruned from memory (workspacePaths / filesystem remain).
  if (!readyFound && !buildPipeline.workspacePaths.has(workspaceId)) {
    // Path exists on disk (resolveWorkspacePath found it) — allow.
  }

  return { workspaceId, workspacePath };
}

/**
 * Create a ship job and run the pipeline in the background.
 *
 * @param {object} opts
 * @param {string} opts.workspaceId
 * @param {string} opts.workspacePath
 * @param {string} opts.pat
 * @param {string} [opts.projectName]
 * @param {string} [opts.orgId]
 * @returns {{ jobId: string }}
 */
function createShipJob(opts = {}) {
  const workspaceId = opts.workspaceId;
  const workspacePath = opts.workspacePath;
  const pat = opts.pat;
  const projectName = opts.projectName || makeProjectName('vibe-spa');
  const orgId = opts.orgId;

  if (!workspaceId || !workspacePath) {
    throw new Error('workspaceId and workspacePath required');
  }
  if (!pat) {
    throw new Error('Zerops PAT required');
  }

  const jobId = createJob({ workspaceId, projectName });
  append(jobId, {
    type: 'stage',
    stage: 'queued',
    message: 'Ship job created',
    workspaceId,
    projectName,
  });

  setImmediate(() => {
    runShipPipeline(jobId, {
      workspaceId,
      workspacePath,
      pat,
      projectName,
      orgId,
    }).catch((err) => {
      const message = err && err.message ? err.message : String(err);
      console.error('[vibe/ship]', err);
      finish(
        jobId,
        { type: 'error', error: message },
        { status: 'failed', error: message },
      );
    });
  });

  return { jobId };
}

/**
 * @param {string} jobId
 * @param {{
 *   workspaceId: string,
 *   workspacePath: string,
 *   pat: string,
 *   projectName: string,
 *   orgId?: string,
 * }} opts
 */
async function runShipPipeline(jobId, opts) {
  let deployRoot = null;

  try {
    // ── Stage: package ──────────────────────────────────────────────
    updateJob(jobId, { status: 'packaging', projectName: opts.projectName });
    append(jobId, {
      type: 'stage',
      stage: 'package',
      message: 'Building SPA and packaging for Zerops…',
      level: 'run',
    });

    const packaged = await packageForZerops(opts.workspacePath, opts.projectName, {
      onLog: (line) => append(jobId, { type: 'log', text: line, stage: 'package' }),
    });

    deployRoot = packaged.deployRoot;
    updateJob(jobId, {
      projectName: packaged.projectName,
      codeFiles: packaged.codeFiles,
    });
    append(jobId, {
      type: 'stage',
      stage: 'package',
      message: `Packaged ${Object.keys(packaged.codeFiles).length} files`,
      level: 'ok',
    });
    append(jobId, {
      type: 'files',
      codeFiles: packaged.codeFiles,
      fileCount: Object.keys(packaged.codeFiles).length,
    });

    // ── Stages: import → push → url → verify via deploy-pipeline ────
    updateJob(jobId, { status: 'import' });
    append(jobId, {
      type: 'stage',
      stage: 'import',
      message: `Deploying project '${packaged.projectName}' (static SPA, single service)`,
      level: 'run',
    });

    const result = await deployApp({
      pat: opts.pat,
      projectName: packaged.projectName,
      importYaml: packaged.importYaml,
      materializeDir: packaged.materializeDir,
      // Deploy root cleanup is ours; do not rm mid-flight service dir alone.
      cleanupMaterialize: false,
      serviceHost: 'webapp',
      servicePort: 3000,
      expectedServiceCount: 1,
      orgId: opts.orgId,
      servicesMeta: [
        {
          id: 'webapp',
          type: 'nodejs@22',
          port: 3000,
          privateHost: 'webapp:3000',
        },
      ],
      onEvent: (e) => {
        if (e.stage === 'log') {
          append(jobId, { type: 'log', text: e.text });
          return;
        }
        // Map deploy stages onto ship job status for the poller UI.
        if (e.stage === 'import' || e.stage === 'resolve' || e.stage === 'activate' || e.stage === 'auth') {
          updateJob(jobId, { status: 'import' });
        } else if (e.stage === 'materialize' || e.stage === 'push') {
          updateJob(jobId, { status: 'push' });
        } else if (e.stage === 'subdomain' || e.stage === 'url') {
          updateJob(jobId, { status: 'url' });
        } else if (e.stage === 'verify') {
          updateJob(jobId, { status: 'verify' });
        }
        append(jobId, {
          type: 'stage',
          stage: e.stage,
          text: e.text,
          message: e.text,
          level: e.level,
        });
        // Capture URL as soon as platform returns it (never invent).
        if (e.stage === 'url' && e.text && /^https?:\/\//i.test(String(e.text))) {
          updateJob(jobId, { liveUrl: String(e.text) });
        }
      },
    });

    // Integrity: only report URL that came from deploy result.
    const liveUrl = result.liveUrl || null;
    if (!liveUrl) {
      throw new Error('Deploy finished but Zerops returned no public URL');
    }

    updateJob(jobId, {
      status: 'ready',
      projectId: result.projectId || null,
      projectName: result.projectName || packaged.projectName,
      liveUrl,
      verified: !!result.verified,
      httpStatus: result.httpStatus != null ? result.httpStatus : null,
    });

    // Soft-register under demo quota when using operator PAT path.
    try {
      const id = `vibe-ship-${Date.now()}`;
      demoQuota.registerProject(id, {
        projectName: result.projectName || packaged.projectName,
        liveUrl,
      });
    } catch {
      // non-fatal
    }

    finish(
      jobId,
      {
        type: 'done',
        projectId: result.projectId,
        projectName: result.projectName || packaged.projectName,
        liveUrl,
        verified: !!result.verified,
        httpStatus: result.httpStatus,
        services: result.services,
      },
      {
        status: 'ready',
        projectId: result.projectId || null,
        liveUrl,
        verified: !!result.verified,
        httpStatus: result.httpStatus != null ? result.httpStatus : null,
      },
    );
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    finish(
      jobId,
      { type: 'error', error: message },
      { status: 'failed', error: message },
    );
  } finally {
    if (deployRoot) cleanupDeployRoot(deployRoot);
  }
}

function activeCount(now = Date.now()) {
  prune(now);
  let n = 0;
  for (const job of jobs.values()) if (!job.done) n += 1;
  return n;
}

function reset() {
  jobs.clear();
  seq = 0;
}

module.exports = {
  createShipJob,
  runShipPipeline,
  resolveShipWorkspace,
  makeProjectName,
  readJob,
  getJob,
  activeCount,
  reset,
  jobs,
  MAX_EVENTS,
  RETAIN_MS,
  MAX_AGE_MS,
};
