/**
 * Real deploy pipeline — prompt-scaffolded app → running Zerops project.
 *
 * The old path called `zcli project project-import` and stopped, which creates
 * empty service slots and no application. This runs the whole sequence:
 *
 *   1. import     — create the project + its two services from the import spec
 *   2. resolve    — find the new project's id
 *   2a. activate  — poll until both services can be deployed to
 *   3. materialize— write the scaffolded file tree to a temp directory
 *   4. push       — `zcli push webapp` builds and deploys the code
 *   5. subdomain  — ensure public HTTP access is enabled
 *   6. url        — derive the real URL from PROJECT_zeropsSubdomainString
 *   7. verify     — poll the URL until it actually answers
 *
 * We never invent a URL. Zerops assigns `{hostname}-{subdomainHost}-{port}`,
 * and `subdomainHost` is only knowable from the platform, so step 6 reads it
 * back rather than guessing.
 */

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ANSI = /\x1b\[[0-9;]*m/g;

/**
 * Locate zcli.
 *
 * On a developer laptop it's on PATH. On the deployed Zerops runtime it is not
 * — the nodejs@22 image has no zcli — so the build vendors the binary into
 * `bin/zcli` next to the app (see the root zerops.yml) and we prefer that.
 */
function resolveZcli() {
  if (process.env.ZCLI_BIN) return process.env.ZCLI_BIN;
  const vendored = path.join(__dirname, '../../bin/zcli');
  return fs.existsSync(vendored) ? vendored : 'zcli';
}

const ZCLI = resolveZcli();

/**
 * Per-step ceilings. A hung zcli must never wedge a demo slot forever.
 *
 * `import` is generous on purpose: `project-import` blocks until Zerops finishes
 * core-services activation, which has been measured between ~105s and well over
 * 3 minutes for the same two-service spec. The old 120s ceiling sat right on
 * that boundary, so the import was killed mid-activation and the run failed with
 * "project import timed out" while leaving a half-built project behind.
 */
const TIMEOUTS = {
  import: 420_000,
  list: 60_000,
  push: 420_000,
  subdomain: 60_000,
  env: 60_000,
};

const VERIFY_TIMEOUT_MS = 150_000;
const VERIFY_INTERVAL_MS = 5_000;

/** How long to wait for both services to finish activating before pushing. */
const SERVICES_READY_TIMEOUT_MS = 600_000;
const SERVICES_POLL_MS = 8_000;

/**
 * Run a command, streaming each output line to `onLine`.
 * Resolves (never rejects) with { code, out, timedOut }.
 */
function run(cmd, args, { cwd, stdin, env, onLine, timeout = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
    });

    let out = '';
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
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

    if (stdin != null) {
      child.stdin?.write(stdin);
      child.stdin?.end();
    }

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Statuses from which a service can be pushed to. */
const READY_STATES = new Set(['READY_TO_DEPLOY', 'ACTIVE']);

/**
 * Parse `zcli service list` into { hostname: STATUS }.
 * Rows look like: │ <id> │ <name> │ <status> │
 */
function parseServiceStatuses(out) {
  const statuses = {};
  for (const line of (out || '').split('\n')) {
    const cells = line
      .split('│')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 3) continue;
    const [id, name, status] = cells;
    if (!/^[A-Za-z0-9_-]{16,}$/.test(id)) continue; // skips the header row
    if (!/^[A-Z_]+$/.test(status)) continue;
    statuses[name] = status;
  }
  return statuses;
}

/**
 * Block until every service can be deployed to.
 *
 * `project-import` is supposed to wait for this, but how long activation takes
 * varies enormously — ~105s on a good run, over ten minutes on a bad one — so
 * hanging the whole deploy on that one command's exit code is what made the demo
 * flaky. Polling status is cheap, tells the log what is actually happening, and
 * lets a slow-but-fine import proceed instead of failing.
 *
 * @returns {Promise<Record<string,string>|null>} statuses, or null on timeout
 */
async function waitForServices(projectId, expected, env, emit, log) {
  const deadline = Date.now() + SERVICES_READY_TIMEOUT_MS;
  let announced = '';

  while (Date.now() < deadline) {
    const { out } = await run(ZCLI, ['service', 'list', '--project-id', projectId], {
      env,
      timeout: TIMEOUTS.list,
    });
    const statuses = parseServiceStatuses(out);
    const names = Object.keys(statuses);

    const summary = names
      .map((n) => `${n}=${statuses[n]}`)
      .sort()
      .join(' ');
    if (summary && summary !== announced) {
      log(`[deploy] ${summary}`);
      announced = summary;
    }

    if (names.length >= expected && names.every((n) => READY_STATES.has(statuses[n]))) {
      return statuses;
    }
    await sleep(SERVICES_POLL_MS);
  }
  return null;
}

/**
 * Find a project id by exact name via `zcli project list`.
 * Used because `project-import` does not reliably print the new id, and our
 * project names carry a unique suffix so an exact match is unambiguous.
 */
async function resolveProjectId(name, env, log) {
  const { out } = await run(ZCLI, ['project', 'list'], { env, timeout: TIMEOUTS.list });

  // Table rows look like: │ <id> │ <name> │ <org> │ ...
  for (const line of out.split('\n')) {
    const cells = line
      .split('│')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length >= 2 && cells[1] === name && /^[A-Za-z0-9_-]{16,}$/.test(cells[0])) {
      return cells[0];
    }
  }

  // Fall back to a loose scan in case the table style changes.
  const loose = out.match(new RegExp(`([A-Za-z0-9_-]{16,})\\s*[│|]\\s*${name}\\b`));
  if (loose) return loose[1];

  log(`[deploy] could not find project '${name}' in zcli project list`);
  return null;
}

/**
 * Determine which org to create the project under.
 *
 * Passing --org-id explicitly matters: if the token can see more than one org,
 * zcli asks which to use, and an interactive prompt on a server would hang the
 * request until the step timeout. The org id is the 4th column of
 * `zcli project list`, so we read it from there rather than requiring config.
 */
async function resolveOrgId(env) {
  if (process.env.DEMO_ORG_ID) return process.env.DEMO_ORG_ID;
  if (process.env.ZEROPS_ORG_ID) return process.env.ZEROPS_ORG_ID;

  const { out } = await run(ZCLI, ['project', 'list'], { env, timeout: TIMEOUTS.list });
  for (const line of out.split('\n')) {
    const cells = line
      .split('│')
      .map((c) => c.trim())
      .filter(Boolean);
    // ID │ NAME │ ORG NAME │ ORG ID │ STATUS │ MODE
    if (cells.length >= 4 && /^[A-Za-z0-9_-]{16,}$/.test(cells[3])) return cells[3];
  }
  return '';
}

/**
 * Build the public URL from the project's own subdomain template.
 * PROJECT_zeropsSubdomainString looks like:
 *   https://${hostname}-2cbd-${port}.prg1.zerops.app
 */
function urlFromEnvDump(envOut, hostname, port) {
  const match = envOut.match(/PROJECT_zeropsSubdomainString="([^"]+)"/);
  if (!match) return null;
  return match[1]
    .replace(/\\/g, '')
    .replace(/\$\{hostname\}/g, hostname)
    .replace(/\$\{port\}/g, String(port));
}

/** Write { 'webapp/server.js': '...' } into <dir>/server.js. */
function materialize(codeFiles, dir, servicePrefix) {
  const written = [];
  for (const [rel, content] of Object.entries(codeFiles || {})) {
    const stripped = rel.startsWith(`${servicePrefix}/`)
      ? rel.slice(servicePrefix.length + 1)
      : rel;
    // Defensive: never let a generated path escape the staging directory.
    const safe = stripped.replace(/\.\./g, '').replace(/^\/+/, '');
    if (!safe) continue;
    const abs = path.join(dir, safe);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    written.push(safe);
  }
  return written;
}

async function probe(url) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    clearTimeout(t);
    return res.status;
  } catch {
    return 0;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.pat            Zerops personal access token
 * @param {string} opts.projectName
 * @param {string} opts.importYaml
 * @param {object} opts.codeFiles      { 'webapp/server.js': '...' }
 * @param {string} [opts.serviceHost]  service to push + expose (default webapp)
 * @param {number} [opts.servicePort]  public port (default 3000)
 * @param {string} [opts.orgId]
 * @param {(e:{stage:string,text:string,level?:string}) => void} [opts.onEvent]
 */
async function deployApp(opts) {
  const {
    pat,
    projectName,
    importYaml,
    codeFiles,
    serviceHost = 'webapp',
    servicePort = 3000,
    orgId,
    onEvent = () => {},
  } = opts;

  if (!pat) throw new Error('No Zerops PAT provided');
  if (!importYaml) throw new Error('No import spec to deploy');

  const env = { ZEROPS_TOKEN: pat };
  const emit = (stage, text, level) => onEvent({ stage, text, level });
  const log = (text) => emit('log', text);

  let stagingDir = null;

  try {
    // ── 0. authenticate ────────────────────────────────────────────────────
    // The env var alone is not reliably honoured by every zcli subcommand, so
    // establish a session first. Output is deliberately NOT streamed — the PAT
    // is an argument here and must never reach the demo log.
    // ZEROPS_SKIP_LOGIN exists for local development, where the developer's
    // zcli already holds a session and no PAT is available to the process.
    if (process.env.ZEROPS_SKIP_LOGIN === '1') {
      emit('auth', 'using existing zcli session (ZEROPS_SKIP_LOGIN)', 'ok');
    } else {
      emit('auth', 'authenticating zcli', 'run');
      const login = await run(ZCLI, ['login', pat], { env, timeout: TIMEOUTS.list });
      if (login.code !== 0) {
        throw new Error('zcli login failed — the demo PAT looks invalid or expired');
      }
      emit('auth', 'authenticated', 'ok');
    }

    // ── 1. import ──────────────────────────────────────────────────────────
    emit('import', `creating project '${projectName}' (2 services)`, 'run');

    const org = orgId || (await resolveOrgId(env));
    if (org) emit('import', `org ${org}`, 'ok');

    const importArgs = ['project', 'project-import', '-'];
    if (org) importArgs.push('--org-id', org);

    const imported = await run(ZCLI, importArgs, {
      env,
      stdin: importYaml,
      onLine: (l) => log(`[zcli] ${l}`),
      timeout: TIMEOUTS.import,
    });

    // A timeout is NOT fatal. `project-import` blocks on core-services
    // activation, which the platform continues regardless of whether zcli is
    // still waiting — so killing the command tells us nothing about whether the
    // project exists. Step 2a settles that by looking, rather than by trusting
    // this exit code.
    if (imported.code !== 0 && !imported.timedOut) {
      throw new Error(`project import failed (exit ${imported.code})`);
    }
    emit(
      'import',
      imported.timedOut ? 'import still activating — checking on it' : 'project imported',
      'ok'
    );

    // ── 2. resolve project id ──────────────────────────────────────────────
    const projectId = await resolveProjectId(projectName, env, log);
    if (!projectId) throw new Error('project imported but its id could not be resolved');
    emit('resolve', `project id ${projectId}`, 'ok');

    // ── 2a. wait until both services can actually be deployed to ───────────
    emit('activate', 'waiting for both services to finish activating', 'run');
    const ready = await waitForServices(projectId, 2, env, emit, log);
    if (!ready) {
      throw new Error('services did not finish activating in time — nothing was pushed');
    }
    emit('activate', 'services ready to deploy', 'ok');

    // ── 3. materialize the scaffolded tree ─────────────────────────────────
    stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeroops-deploy-'));
    const files = materialize(codeFiles, stagingDir, serviceHost);
    if (!files.includes('zerops.yml')) {
      throw new Error('scaffold produced no zerops.yml — nothing to push');
    }
    emit('materialize', `staged ${files.length} files: ${files.join(', ')}`, 'ok');

    // ── 4. push (build + deploy) ───────────────────────────────────────────
    emit('push', `building ${serviceHost} on Zerops — this is the slow part`, 'run');

    // `--no-git` is required, not optional. zcli defaults to pushing a git
    // workspace state and refuses a plain directory with "folder is not
    // initialized via git init" — and this staging tree is generated per deploy,
    // so it never has a repo. Without the flag the push always exits 1 and the
    // service is left sitting at READY_TO_DEPLOY with no code on it.
    const pushed = await run(
      ZCLI,
      ['push', serviceHost, '--project-id', projectId, '--no-git'],
      {
        cwd: stagingDir,
        env,
        onLine: (l) => log(`[zcli] ${l}`),
        timeout: TIMEOUTS.push,
      }
    );

    if (pushed.code !== 0) {
      throw new Error(
        pushed.timedOut ? 'build timed out' : `push failed (exit ${pushed.code})`
      );
    }
    emit('push', 'build finished, service deployed', 'ok');

    // ── 5. subdomain (import already asks for it; this is belt and braces) ──
    const sub = await run(
      ZCLI,
      ['service', 'enable-subdomain', serviceHost, '--project-id', projectId],
      { env, timeout: TIMEOUTS.subdomain }
    );
    emit('subdomain', sub.code === 0 ? 'public subdomain enabled' : 'subdomain already enabled', 'ok');

    // ── 6. read the real URL back from the platform ────────────────────────
    const envDump = await run(ZCLI, ['project', 'env', '--project-id', projectId], {
      env,
      timeout: TIMEOUTS.env,
    });
    const liveUrl = urlFromEnvDump(envDump.out, serviceHost, servicePort);
    if (!liveUrl) throw new Error('deployed, but Zerops returned no subdomain for the service');
    emit('url', liveUrl, 'ok');

    // ── 7. verify it actually answers ──────────────────────────────────────
    emit('verify', 'waiting for the app to answer', 'run');

    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    let status = 0;
    while (Date.now() < deadline) {
      status = await probe(liveUrl);
      if (status >= 200 && status < 400) break;
      await new Promise((r) => setTimeout(r, VERIFY_INTERVAL_MS));
    }

    const verified = status >= 200 && status < 400;
    emit(
      'verify',
      verified ? `HTTP ${status} — live` : `no answer yet (last status ${status || 'none'})`,
      verified ? 'ok' : 'warn'
    );

    return {
      success: true,
      projectId,
      projectName,
      liveUrl,
      verified,
      httpStatus: status,
      services: [
        { id: serviceHost, type: 'nodejs@22', port: servicePort, privateHost: `${serviceHost}:${servicePort}` },
        { id: 'db', type: 'postgresql@16', port: 5432, privateHost: 'db:5432' },
      ],
    };
  } finally {
    if (stagingDir) {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

/**
 * Whether the deploy path can run at all. Surfaced on /api/demo/status so a
 * failed deploy can be diagnosed from the page instead of the container logs.
 */
function zcliInfo() {
  const bin = ZCLI;
  const bundled = bin !== 'zcli';
  return { path: bin, bundled, present: bundled ? fs.existsSync(bin) : true };
}

module.exports = {
  deployApp,
  zcliInfo,
  ZCLI,
  urlFromEnvDump,
  resolveProjectId,
  resolveOrgId,
  parseServiceStatuses,
  waitForServices,
  materialize,
  run,
};
