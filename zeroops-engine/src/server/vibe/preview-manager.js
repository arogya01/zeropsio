/**
 * Preview manager — one Vite dev server per vibe workspace.
 *
 * - Allocates a free port in 5100–5199
 * - Ensures npm install (and optional extra deps)
 * - Spawns: npx vite --host 127.0.0.1 --port PORT --strictPort
 * - Tracks child process; stopPreview kills the process tree
 *
 * Studio iframes hit same-origin /api/vibe/preview/:workspaceId/* which proxies
 * here. Vite is started with --base matching that proxy path so assets resolve.
 */

const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT_MIN = 5100;
const PORT_MAX = 5199;
const READY_TIMEOUT_MS = 90_000;
const READY_POLL_MS = 400;

/**
 * @typedef {'starting'|'running'|'stopped'|'failed'} PreviewStatus
 *
 * @typedef {object} PreviewEntry
 * @property {number|null} port
 * @property {PreviewStatus} status
 * @property {import('child_process').ChildProcess|null} process
 * @property {string} workspacePath
 * @property {string} basePath  e.g. /api/vibe/preview/<id>/
 * @property {string|null} error
 * @property {number} startedAt
 */

/** @type {Map<string, PreviewEntry>} */
const previews = new Map();

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * @returns {Promise<number>}
 */
async function allocatePort() {
  const used = new Set();
  for (const entry of previews.values()) {
    if (entry.port != null) used.add(entry.port);
  }
  for (let port = PORT_MIN; port <= PORT_MAX; port += 1) {
    if (used.has(port)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free preview port in ${PORT_MIN}–${PORT_MAX}`);
}

/**
 * @param {string} workspacePath
 */
function hasNodeModules(workspacePath) {
  const nm = path.join(workspacePath, 'node_modules');
  if (!fs.existsSync(nm)) return false;
  try {
    return fs.readdirSync(nm).length > 0;
  } catch {
    return false;
  }
}

/**
 * Run a command, capture stdout/stderr, reject on non-zero exit.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, onLog?: (line: string) => void, env?: NodeJS.ProcessEnv }} opts
 * @returns {Promise<void>}
 */
function runCommand(command, args, opts) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });

    let stderr = '';
    const onData = (buf) => {
      const text = buf.toString();
      stderr += text;
      if (opts.onLog) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) opts.onLog(line);
        }
      }
    };
    if (child.stdout) child.stdout.on('data', onData);
    if (child.stderr) child.stderr.on('data', onData);

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        const tail = stderr.trim().split('\n').slice(-20).join('\n');
        reject(new Error(`${command} ${args.join(' ')} exited ${code}${tail ? `: ${tail}` : ''}`));
      }
    });
  });
}

/**
 * npm install if node_modules missing; then install any extra packages.
 * @param {string} workspacePath
 * @param {string[]} [extraDeps]
 * @param {(line: string) => void} [onLog]
 */
async function ensureNpmInstall(workspacePath, extraDeps = [], onLog) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if (!hasNodeModules(workspacePath)) {
    if (onLog) onLog('npm install (scaffold deps)…');
    await runCommand(npmCmd, ['install', '--no-fund', '--no-audit'], {
      cwd: workspacePath,
      onLog,
    });
  }
  const extras = (extraDeps || []).map((d) => String(d).trim()).filter(Boolean);
  if (extras.length) {
    if (onLog) onLog(`npm install extra: ${extras.join(' ')}`);
    await runCommand(npmCmd, ['install', '--no-fund', '--no-audit', ...extras], {
      cwd: workspacePath,
      onLog,
    });
  }
}

/**
 * @param {number} port
 * @param {string} probePath  path including base, e.g. /api/vibe/preview/id/
 * @param {number} timeoutMs
 */
function waitForHttp(port, probePath, timeoutMs = READY_TIMEOUT_MS) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Vite did not become ready on port ${port} within ${timeoutMs}ms`));
        return;
      }
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port,
          path: probePath.startsWith('/') ? probePath : `/${probePath}`,
          timeout: 2000,
        },
        (res) => {
          res.resume();
          // Any HTTP response means the server is up (even 404).
          if (res.statusCode && res.statusCode < 500) resolve();
          else setTimeout(attempt, READY_POLL_MS);
        },
      );
      req.on('error', () => setTimeout(attempt, READY_POLL_MS));
      req.on('timeout', () => {
        req.destroy();
        setTimeout(attempt, READY_POLL_MS);
      });
    };
    attempt();
  });
}

/**
 * Kill process tree best-effort (POSIX process group; Windows taskkill).
 * @param {import('child_process').ChildProcess|null} child
 */
function killProcessTree(child) {
  if (!child || child.killed || child.exitCode != null) return;
  const pid = child.pid;
  if (!pid) return;

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        // Negative PID = process group (spawned with detached: true).
        process.kill(-pid, 'SIGTERM');
      } catch {
        try {
          child.kill('SIGTERM');
        } catch {
          // already gone
        }
      }
      setTimeout(() => {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore
          }
        }
      }, 1500).unref?.();
    }
  } catch {
    // ignore
  }
}

/**
 * Start (or restart) a Vite preview for a workspace.
 *
 * @param {string} workspaceId
 * @param {string} workspacePath
 * @param {{ extraDeps?: string[], onLog?: (line: string) => void, skipInstall?: boolean }} [opts]
 * @returns {Promise<{ port: number, status: PreviewStatus, basePath: string }>}
 */
async function startPreview(workspaceId, workspacePath, opts = {}) {
  if (!workspaceId) throw new Error('workspaceId required');
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    throw new Error(`workspace path missing: ${workspacePath}`);
  }

  // Replace any existing preview for this id.
  await stopPreview(workspaceId);

  const basePath = `/api/vibe/preview/${workspaceId}/`;
  /** @type {PreviewEntry} */
  const entry = {
    port: null,
    status: 'starting',
    process: null,
    workspacePath,
    basePath,
    error: null,
    startedAt: Date.now(),
  };
  previews.set(workspaceId, entry);

  try {
    if (!opts.skipInstall) {
      await ensureNpmInstall(workspacePath, opts.extraDeps || [], opts.onLog);
    } else if (opts.extraDeps && opts.extraDeps.length) {
      await ensureNpmInstall(workspacePath, opts.extraDeps, opts.onLog);
    }

    const port = await allocatePort();
    entry.port = port;

    const isWin = process.platform === 'win32';
    const npxCmd = isWin ? 'npx.cmd' : 'npx';
    const args = [
      'vite',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
      '--base',
      basePath,
    ];

    if (opts.onLog) opts.onLog(`starting vite on 127.0.0.1:${port} base=${basePath}`);

    const child = spawn(npxCmd, args, {
      cwd: workspacePath,
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      // New process group so we can kill the whole tree on stop.
      detached: !isWin,
      shell: isWin,
    });
    entry.process = child;

    const onData = (buf) => {
      if (!opts.onLog) return;
      for (const line of buf.toString().split(/\r?\n/)) {
        if (line.trim()) opts.onLog(line);
      }
    };
    if (child.stdout) child.stdout.on('data', onData);
    if (child.stderr) child.stderr.on('data', onData);

    child.on('exit', (code, signal) => {
      const current = previews.get(workspaceId);
      if (!current || current.process !== child) return;
      if (current.status === 'running' || current.status === 'starting') {
        current.status = code === 0 || signal === 'SIGTERM' || signal === 'SIGKILL' ? 'stopped' : 'failed';
        if (current.status === 'failed') {
          current.error = `vite exited code=${code} signal=${signal || ''}`;
        }
        current.process = null;
      }
    });
    child.on('error', (err) => {
      const current = previews.get(workspaceId);
      if (!current || current.process !== child) return;
      current.status = 'failed';
      current.error = err.message || String(err);
      current.process = null;
    });

    await waitForHttp(port, basePath);
    entry.status = 'running';
    return { port, status: entry.status, basePath };
  } catch (err) {
    entry.status = 'failed';
    entry.error = err && err.message ? err.message : String(err);
    if (entry.process) {
      killProcessTree(entry.process);
      entry.process = null;
    }
    throw err;
  }
}

/**
 * @param {string} workspaceId
 * @returns {Promise<void>}
 */
async function stopPreview(workspaceId) {
  const entry = previews.get(workspaceId);
  if (!entry) return;
  killProcessTree(entry.process);
  entry.process = null;
  entry.status = 'stopped';
  entry.port = null;
  previews.delete(workspaceId);
}

/**
 * @param {string} workspaceId
 * @returns {{ port: number|null, status: PreviewStatus, basePath?: string, error?: string|null, workspacePath?: string }|null}
 */
function getPreview(workspaceId) {
  const entry = previews.get(workspaceId);
  if (!entry) return null;
  return {
    port: entry.port,
    status: entry.status,
    basePath: entry.basePath,
    error: entry.error,
    workspacePath: entry.workspacePath,
  };
}

/**
 * Best-effort shutdown of every tracked preview (process exit / tests).
 */
function stopAll() {
  for (const id of [...previews.keys()]) {
    // fire-and-forget sync kill
    const entry = previews.get(id);
    if (entry) {
      killProcessTree(entry.process);
      entry.process = null;
      entry.status = 'stopped';
    }
    previews.delete(id);
  }
}

// Best-effort: kill children when the Node process is actually exiting.
// Do not trap SIGINT/SIGTERM here — that would fight the main server's handlers.
process.on('exit', () => {
  stopAll();
});

module.exports = {
  startPreview,
  stopPreview,
  getPreview,
  stopAll,
  ensureNpmInstall,
  allocatePort,
  hasNodeModules,
  previews,
  PORT_MIN,
  PORT_MAX,
};
