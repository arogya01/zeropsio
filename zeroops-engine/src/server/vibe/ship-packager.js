/**
 * Ship packager — Vite production build → Zerops static SPA deploy tree.
 *
 * Produces a temp deploy root:
 *
 *   webapp/
 *     package.json   (express only; start = node server.js)
 *     server.js      (express.static dist on PORT||3000)
 *     dist/          (vite output)
 *     zerops.yml     (nodejs@22, npm ci --omit=dev, httpSupport 3000)
 *   zerops-import.yml  (single service hostname webapp, enableSubdomainAccess)
 *
 * Never invents live URLs — packaging only prepares artifacts for deploy-pipeline.
 */

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ANSI = /\x1b\[[0-9;]*m/g;
const BUILD_TIMEOUT_MS = 300_000;

const EXPRESS_PACKAGE_JSON = `{
  "name": "zeroops-vibe-webapp",
  "private": true,
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}
`;

const STATIC_SERVER_JS = `/**
 * ZeroOps vibe ship host — serves Vite dist as a static SPA.
 * PORT is injected by Zerops (default 3000).
 */
const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const dist = path.join(__dirname, 'dist');

app.use(express.static(dist, { index: false, fallthrough: true }));

// SPA fallback: non-file routes serve index.html
app.get('*', (req, res) => {
  const index = path.join(dist, 'index.html');
  res.sendFile(index, (err) => {
    if (err) {
      res.status(500).type('text/plain').send('index.html missing — did the build produce dist/?');
    }
  });
});

app.listen(PORT, () => {
  console.log(\`zeroops-vibe-webapp listening on \${PORT}\`);
});
`;

/**
 * zerops.yml for static SPA host.
 * Task contract: nodejs@22, npm ci --omit=dev, deployFiles, start, httpSupport 3000.
 */
function makeZeropsYml() {
  return `# Build/run recipe for the vibe static SPA (hostname: webapp).
zerops:
  - setup: webapp
    build:
      base: nodejs@22
      # package-lock.json is generated during ship packaging so npm ci works.
      buildCommands:
        - npm ci --omit=dev
      deployFiles:
        - package.json
        - package-lock.json
        - server.js
        - dist
        - node_modules
    run:
      base: nodejs@22
      ports:
        - port: 3000
          httpSupport: true
      envVariables:
        PORT: "3000"
      start: npm start
`;
}

/**
 * Single-service import — no Postgres in v1.
 * @param {string} projectName
 */
function makeImportYaml(projectName) {
  const name = String(projectName || 'vibe-spa')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'vibe-spa';

  return `project:
  name: ${name}
  tags:
    - zeroops-vibe
    - vibe-spa

services:
  - hostname: webapp
    type: nodejs@22
    minContainers: 1
    maxContainers: 1
    enableSubdomainAccess: true
    priority: 1
`;
}

/**
 * Run a command; resolve with { code, out, timedOut }. Never rejects.
 */
function run(cmd, args, { cwd, onLine, timeout = BUILD_TIMEOUT_MS, env } = {}) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const child = childProcess.spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });

    let out = '';
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeout);

    const consume = (buf) => {
      const text = buf.toString();
      out += text;
      if (!onLine) return;
      for (const line of text.split('\n')) {
        const clean = line.replace(ANSI, '').trimEnd();
        if (clean.trim()) onLine(clean);
      }
    };

    child.stdout?.on('data', consume);
    child.stderr?.on('data', consume);

    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, out: out.replace(ANSI, ''), timedOut });
    };

    child.on('close', finish);
    child.on('error', (err) => {
      out += `\n${err.message}`;
      finish(null);
    });
  });
}

/**
 * Recursively copy a directory (files only; overwrites dest).
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

/**
 * Walk a tree into a relative path → utf8 content map (skip node_modules, binaries best-effort).
 * @param {string} root
 * @param {string} [prefix]
 * @returns {Record<string, string>}
 */
function treeToCodeFiles(root, prefix = '') {
  /** @type {Record<string, string>} */
  const files = {};
  if (!fs.existsSync(root)) return files;

  const walk = (dir, relBase) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const abs = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (!entry.isFile()) continue;
      // Skip large lock binary-ish; still include package-lock.json as text.
      try {
        const buf = fs.readFileSync(abs);
        // Skip obvious binary (null bytes).
        if (buf.includes(0)) continue;
        files[rel] = buf.toString('utf8');
      } catch {
        // skip unreadable
      }
    }
  };

  walk(root, prefix);
  return files;
}

/**
 * Ensure package-lock.json exists so Zerops `npm ci --omit=dev` succeeds.
 * @param {string} webappDir
 * @param {(line: string) => void} [onLog]
 */
async function ensurePackageLock(webappDir, onLog) {
  const lockPath = path.join(webappDir, 'package-lock.json');
  if (fs.existsSync(lockPath)) return;

  if (onLog) onLog('[ship] generating package-lock.json for npm ci');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = await run(npmCmd, ['install', '--package-lock-only', '--omit=dev'], {
    cwd: webappDir,
    onLine: onLog,
    timeout: 120_000,
  });
  if (result.code !== 0 || !fs.existsSync(lockPath)) {
    // Fallback: full install to produce lock + node_modules (not deployed from here).
    const full = await run(npmCmd, ['install', '--omit=dev'], {
      cwd: webappDir,
      onLine: onLog,
      timeout: 180_000,
    });
    if (full.code !== 0 || !fs.existsSync(lockPath)) {
      throw new Error(
        full.timedOut || result.timedOut
          ? 'npm lock generation timed out'
          : `failed to generate package-lock.json (exit ${full.code ?? result.code})`,
      );
    }
  }
}

/**
 * Package a vibe workspace for Zerops static SPA deploy.
 *
 * @param {string} workspacePath  Absolute path to React+Vite workspace (has package.json, vite)
 * @param {string} projectName    Zerops project name
 * @param {{ onLog?: (line: string) => void }} [opts]
 * @returns {Promise<{
 *   deployRoot: string,
 *   materializeDir: string,
 *   importYaml: string,
 *   codeFiles: Record<string, string>,
 *   projectName: string,
 *   buildLog: string,
 * }>}
 */
async function packageForZerops(workspacePath, projectName, opts = {}) {
  const onLog = opts.onLog || (() => {});

  if (!workspacePath || !fs.existsSync(workspacePath)) {
    throw new Error(`workspace path missing: ${workspacePath}`);
  }
  const pkgJson = path.join(workspacePath, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    throw new Error('workspace has no package.json — cannot build');
  }

  const name =
    String(projectName || 'vibe-spa')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'vibe-spa';

  // ── 1. vite production build ──────────────────────────────────────
  onLog('[ship] running npm run build');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  // Prefer a clean production base (not the preview --base proxy path).
  const built = await run(npmCmd, ['run', 'build'], {
    cwd: workspacePath,
    onLine: onLog,
    timeout: BUILD_TIMEOUT_MS,
    env: { NODE_ENV: 'production' },
  });

  if (built.timedOut) {
    throw new Error('npm run build timed out');
  }
  if (built.code !== 0) {
    const tail = built.out.trim().split('\n').slice(-30).join('\n');
    throw new Error(`npm run build failed (exit ${built.code})${tail ? `: ${tail}` : ''}`);
  }

  const distSrc = path.join(workspacePath, 'dist');
  if (!fs.existsSync(distSrc) || !fs.statSync(distSrc).isDirectory()) {
    throw new Error('vite build produced no dist/ directory');
  }
  const indexHtml = path.join(distSrc, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error('vite build produced no dist/index.html');
  }

  // ── 2. materialize deploy root ────────────────────────────────────
  const deployRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zeroops-ship-'));
  const webappDir = path.join(deployRoot, 'webapp');
  fs.mkdirSync(webappDir, { recursive: true });

  fs.writeFileSync(path.join(webappDir, 'package.json'), EXPRESS_PACKAGE_JSON, 'utf8');
  fs.writeFileSync(path.join(webappDir, 'server.js'), STATIC_SERVER_JS, 'utf8');
  fs.writeFileSync(path.join(webappDir, 'zerops.yml'), makeZeropsYml(), 'utf8');

  const distDest = path.join(webappDir, 'dist');
  copyDir(distSrc, distDest);

  await ensurePackageLock(webappDir, onLog);

  // Clean local node_modules if ensurePackageLock installed them — Zerops rebuilds.
  const localNm = path.join(webappDir, 'node_modules');
  if (fs.existsSync(localNm)) {
    try {
      fs.rmSync(localNm, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }

  const importYaml = makeImportYaml(name);
  fs.writeFileSync(path.join(deployRoot, 'zerops-import.yml'), importYaml, 'utf8');

  // UI codeFiles map (includes webapp/* + import yml).
  const codeFiles = {
    ...treeToCodeFiles(webappDir, 'webapp'),
    'zerops-import.yml': importYaml,
  };

  onLog(`[ship] packaged deploy root ${deployRoot} (${Object.keys(codeFiles).length} files mapped)`);

  return {
    deployRoot,
    materializeDir: webappDir,
    importYaml,
    codeFiles,
    projectName: name,
    buildLog: built.out,
  };
}

/**
 * Best-effort cleanup of a deploy root created by packageForZerops.
 * @param {string} deployRoot
 */
function cleanupDeployRoot(deployRoot) {
  if (!deployRoot) return;
  try {
    fs.rmSync(deployRoot, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

module.exports = {
  packageForZerops,
  cleanupDeployRoot,
  makeImportYaml,
  makeZeropsYml,
  treeToCodeFiles,
  EXPRESS_PACKAGE_JSON,
  STATIC_SERVER_JS,
};
