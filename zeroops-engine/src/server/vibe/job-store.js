/**
 * In-memory job store for vibe Build jobs.
 *
 * Mirrors the detach pattern in demo-deploy-jobs.js: create → append events →
 * poll with a cursor. Shape is richer (workspaceId, plan, codeFiles, previewUrl)
 * because the Studio workbench needs plan/files/preview without re-running LLM.
 */

/** @typedef {'queued'|'generating'|'installing'|'preview'|'ready'|'failed'} VibeJobStatus */

/**
 * @typedef {object} VibeJob
 * @property {string} id
 * @property {VibeJobStatus} status
 * @property {Array<{type:string, [k:string]: unknown}>} events
 * @property {string|null} workspaceId
 * @property {string|null} workspacePath
 * @property {string|null} plan
 * @property {Record<string, string>|null} codeFiles
 * @property {string[]} dependencies
 * @property {string|null} previewUrl
 * @property {string|null} error
 * @property {string} prompt
 * @property {boolean} done
 * @property {number} startedAt
 * @property {number|null} finishedAt
 */

const MAX_EVENTS = 2000;
const RETAIN_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 30 * 60 * 1000;

/** @type {Map<string, VibeJob>} */
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
 * @param {{ prompt?: string }} [opts]
 * @param {number} [now]
 * @returns {string} job id
 */
function create(opts = {}, now = Date.now()) {
  prune(now);
  seq += 1;
  const id = `vibe-${now.toString(36)}-${seq.toString(36)}`;
  /** @type {VibeJob} */
  const job = {
    id,
    status: 'queued',
    events: [],
    workspaceId: null,
    workspacePath: null,
    plan: null,
    codeFiles: null,
    dependencies: [],
    previewUrl: null,
    error: null,
    prompt: String(opts.prompt || ''),
    done: false,
    startedAt: now,
    finishedAt: null,
  };
  jobs.set(id, job);
  return id;
}

/**
 * @param {string} id
 * @returns {VibeJob|null}
 */
function get(id) {
  prune();
  return jobs.get(id) || null;
}

/**
 * Partial update of job fields (status, plan, codeFiles, etc.).
 * @param {string} id
 * @param {Partial<VibeJob>} patch
 */
function update(id, patch) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  const allowed = [
    'status',
    'workspaceId',
    'workspacePath',
    'plan',
    'codeFiles',
    'dependencies',
    'previewUrl',
    'error',
    'prompt',
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
 * Terminal success or failure. Sets done + finishedAt.
 * @param {string} id
 * @param {{ type: string, [k: string]: unknown }} event
 * @param {Partial<VibeJob>} [patch]
 * @param {number} [now]
 */
function finish(id, event, patch = {}, now = Date.now()) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  if (patch && typeof patch === 'object') {
    update(id, patch);
  }
  if (event && event.type === 'error' && event.error && !job.error) {
    job.error = String(event.error);
  }
  if (event && event.type === 'done' && !job.status) {
    job.status = 'ready';
  }
  if (event && event.type === 'error') {
    job.status = 'failed';
  }
  job.events.push(event);
  job.done = true;
  job.finishedAt = now;
}

/**
 * Cursor-based event read for polling clients.
 * @param {string} id
 * @param {number} [from]
 * @param {number} [now]
 */
function read(id, from = 0, now = Date.now()) {
  prune(now);
  const job = jobs.get(id);
  if (!job) return null;
  const start = Number.isFinite(from) && from > 0 ? Math.min(from, job.events.length) : 0;
  return {
    id: job.id,
    status: job.status,
    events: job.events.slice(start),
    next: job.events.length,
    done: job.done,
    workspaceId: job.workspaceId,
    workspacePath: job.workspacePath,
    plan: job.plan,
    codeFiles: job.codeFiles,
    dependencies: job.dependencies,
    previewUrl: job.previewUrl,
    error: job.error,
    prompt: job.prompt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

/**
 * Snapshot without event slicing — handy for API handlers.
 * @param {string} id
 */
function snapshot(id) {
  const job = get(id);
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    events: job.events.slice(),
    done: job.done,
    workspaceId: job.workspaceId,
    workspacePath: job.workspacePath,
    plan: job.plan,
    codeFiles: job.codeFiles,
    dependencies: job.dependencies.slice(),
    previewUrl: job.previewUrl,
    error: job.error,
    prompt: job.prompt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
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
  create,
  get,
  update,
  append,
  finish,
  read,
  snapshot,
  activeCount,
  reset,
  jobs,
  MAX_EVENTS,
  RETAIN_MS,
  MAX_AGE_MS,
};
