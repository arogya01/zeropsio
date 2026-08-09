/**
 * Vibe Build pipeline — generate → install → preview.
 *
 * Detached job model mirrors demo-deploy-jobs: createBuildJob returns immediately;
 * client polls job-store until status is ready|failed.
 *
 * Single-shot regenerate: a new Build for the same sessionKey stops the previous
 * preview (if any) before starting a fresh workspace.
 */

const path = require('path');
const fs = require('fs');
const jobStore = require('./job-store');
const previewManager = require('./preview-manager');
const {
  generateVibeApp,
  listCodeFiles,
  WORKSPACE_ROOT_DEFAULT,
} = require('../llm/vibe-scaffold');

/**
 * sessionKey → last active build for that browser/session (regenerate tracking).
 * @type {Map<string, { jobId: string, workspaceId: string|null }>}
 */
const sessionBuilds = new Map();

/**
 * workspaceId → absolute path (for files/preview endpoints after job finishes).
 * @type {Map<string, string>}
 */
const workspacePaths = new Map();

/**
 * Create a build job and run the pipeline in the background.
 *
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} opts.apiKey  Required — callers must 503 before inventing apps.
 * @param {string} [opts.sessionKey]  Express session id or client token for regenerate.
 * @param {string} [opts.workspaceRoot]
 * @returns {{ jobId: string }}
 */
function createBuildJob(opts = {}) {
  const prompt = String(opts.prompt || '').trim();
  const apiKey = opts.apiKey || '';
  const sessionKey = opts.sessionKey || null;
  const workspaceRoot = opts.workspaceRoot || WORKSPACE_ROOT_DEFAULT;

  // Regenerate: stop previous preview for this session so ports/processes free up.
  if (sessionKey && sessionBuilds.has(sessionKey)) {
    const prev = sessionBuilds.get(sessionKey);
    if (prev && prev.workspaceId) {
      previewManager.stopPreview(prev.workspaceId).catch(() => {});
    }
  }

  const jobId = jobStore.create({ prompt });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'queued',
    message: 'Build job created',
  });

  if (sessionKey) {
    sessionBuilds.set(sessionKey, { jobId, workspaceId: null });
  }

  setImmediate(() => {
    runBuildPipeline(jobId, {
      prompt,
      apiKey,
      sessionKey,
      workspaceRoot,
    }).catch((err) => {
      const message = err && err.message ? err.message : String(err);
      console.error('[vibe/build]', err);
      jobStore.finish(
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
 * @param {{ prompt: string, apiKey: string, sessionKey?: string|null, workspaceRoot?: string }} opts
 */
async function runBuildPipeline(jobId, opts) {
  if (!opts.apiKey) {
    const message = 'OPENAI_API_KEY required';
    jobStore.finish(
      jobId,
      {
        type: 'error',
        error: message,
        code: 'OPENAI_API_KEY_REQUIRED',
        status: 503,
      },
      { status: 'failed', error: message },
    );
    return;
  }

  if (!opts.prompt) {
    const message = 'prompt is required';
    jobStore.finish(
      jobId,
      { type: 'error', error: message },
      { status: 'failed', error: message },
    );
    return;
  }

  // ── Stage: generate ──────────────────────────────────────────────
  jobStore.update(jobId, { status: 'generating' });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'generate',
    message: 'Generating app from prompt…',
  });

  const result = await generateVibeApp({
    prompt: opts.prompt,
    apiKey: opts.apiKey,
    workspaceRoot: opts.workspaceRoot,
  });

  workspacePaths.set(result.workspaceId, result.workspacePath);

  if (opts.sessionKey && sessionBuilds.has(opts.sessionKey)) {
    sessionBuilds.set(opts.sessionKey, {
      jobId,
      workspaceId: result.workspaceId,
    });
  }

  jobStore.update(jobId, {
    status: 'installing',
    workspaceId: result.workspaceId,
    workspacePath: result.workspacePath,
    plan: result.plan,
    codeFiles: result.codeFiles,
    dependencies: result.dependencies || [],
  });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'generate',
    message: `Wrote ${result.appliedFiles.length} file(s)`,
    workspaceId: result.workspaceId,
    fileCount: result.appliedFiles.length,
  });
  if (result.repairedFiles && result.repairedFiles.length) {
    jobStore.append(jobId, {
      type: 'stage',
      stage: 'generate',
      message: `Fixed syntax in ${result.repairedFiles.join(', ')}`,
    });
  }
  if (result.syntaxErrors && result.syntaxErrors.length) {
    // Not fatal — Vite still starts and shows its own overlay — but silence here
    // reads as success right up until the preview renders an error page.
    for (const problem of result.syntaxErrors) {
      jobStore.append(jobId, {
        type: 'log',
        stage: 'generate',
        text: `warn: ${problem.path}:${problem.line} ${problem.message}`,
      });
    }
  }
  jobStore.append(jobId, {
    type: 'plan',
    plan: result.plan,
  });
  jobStore.append(jobId, {
    type: 'files',
    fileCount: Object.keys(result.codeFiles || {}).length,
  });

  // ── Stage: install ───────────────────────────────────────────────
  jobStore.update(jobId, { status: 'installing' });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'install',
    message: 'Installing dependencies…',
  });

  const onLog = (line) => {
    jobStore.append(jobId, { type: 'log', text: line, stage: 'install' });
  };

  await previewManager.ensureNpmInstall(
    result.workspacePath,
    result.dependencies || [],
    onLog,
  );

  jobStore.append(jobId, {
    type: 'stage',
    stage: 'install',
    message: 'Dependencies ready',
  });

  // ── Stage: preview ───────────────────────────────────────────────
  jobStore.update(jobId, { status: 'preview' });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'preview',
    message: 'Starting Vite preview…',
  });

  const preview = await previewManager.startPreview(
    result.workspaceId,
    result.workspacePath,
    {
      // Install already done above.
      skipInstall: true,
      onLog: (line) => {
        jobStore.append(jobId, { type: 'log', text: line, stage: 'preview' });
      },
    },
  );

  const previewPath = `/api/vibe/preview/${result.workspaceId}/`;
  // Refresh code files after install (unchanged usually; keeps map complete).
  const codeFiles = listCodeFiles(result.workspacePath);

  jobStore.update(jobId, {
    status: 'ready',
    previewUrl: previewPath,
    codeFiles,
  });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'preview',
    message: `Preview ready on port ${preview.port}`,
    port: preview.port,
    previewPath,
  });

  jobStore.finish(
    jobId,
    {
      type: 'done',
      workspaceId: result.workspaceId,
      previewPath,
      previewUrl: previewPath,
      port: preview.port,
    },
    {
      status: 'ready',
      previewUrl: previewPath,
      codeFiles,
      workspaceId: result.workspaceId,
      workspacePath: result.workspacePath,
    },
  );
}

/**
 * Resolve workspace path by id (registry → default tmp layout).
 * @param {string} workspaceId
 * @returns {string|null}
 */
function resolveWorkspacePath(workspaceId) {
  if (!workspaceId || typeof workspaceId !== 'string') return null;
  if (!/^[a-f0-9]{16,64}$/i.test(workspaceId) && !/^[a-z0-9_-]{8,64}$/i.test(workspaceId)) {
    // Still allow hex ids from crypto.randomBytes(12).toString('hex') = 24 chars.
    // Reject path traversal and odd shapes.
    if (workspaceId.includes('..') || workspaceId.includes('/') || workspaceId.includes('\\')) {
      return null;
    }
  }
  if (workspaceId.includes('..') || workspaceId.includes('/') || workspaceId.includes('\\')) {
    return null;
  }

  if (workspacePaths.has(workspaceId)) {
    return workspacePaths.get(workspaceId);
  }

  const preview = previewManager.getPreview(workspaceId);
  if (preview && preview.workspacePath) return preview.workspacePath;

  // Fall back to default layout from generateVibeApp.
  const candidate = path.join(WORKSPACE_ROOT_DEFAULT, workspaceId);
  if (fs.existsSync(candidate)) return candidate;

  // Scan jobs for a matching workspaceId.
  for (const job of jobStore.jobs.values()) {
    if (job.workspaceId === workspaceId && job.workspacePath) {
      return job.workspacePath;
    }
  }
  return null;
}

/**
 * Code panel map for a workspace.
 * @param {string} workspaceId
 * @returns {Record<string, string>|null}
 */
function getWorkspaceCodeFiles(workspaceId) {
  const wsPath = resolveWorkspacePath(workspaceId);
  if (!wsPath) return null;
  return listCodeFiles(wsPath);
}

/**
 * Snapshot helper for GET /api/vibe/build/:jobId — adds previewPath alias.
 * @param {string} jobId
 * @param {number} [from] event cursor
 */
function readBuildJob(jobId, from) {
  if (from != null && Number.isFinite(from)) {
    const snap = jobStore.read(jobId, from);
    if (!snap) return null;
    return {
      ...snap,
      previewPath: snap.previewUrl,
    };
  }
  const snap = jobStore.snapshot(jobId);
  if (!snap) return null;
  return {
    ...snap,
    previewPath: snap.previewUrl,
  };
}

module.exports = {
  createBuildJob,
  runBuildPipeline,
  resolveWorkspacePath,
  getWorkspaceCodeFiles,
  readBuildJob,
  sessionBuilds,
  workspacePaths,
  jobStore,
  previewManager,
};
