#!/usr/bin/env node
/**
 * End-to-end: vibe Build → local preview smoke → Ship → live URL verify.
 *
 * Usage:
 *   node scripts/e2e-vibe-ship.mjs
 *   node scripts/e2e-vibe-ship.mjs --prompt "todo list for a small team"
 *   node scripts/e2e-vibe-ship.mjs --base http://127.0.0.1:3000
 *
 * Writes result JSON to /tmp/zeroops-e2e-result.json and prints liveUrl.
 * Exit 0 only when live URL returns HTTP 2xx.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const BASE = flag('--base', process.env.ZEROOPS_BASE || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);
const PROMPT = flag(
  '--prompt',
  'A clean personal habit tracker with daily checkboxes, streaks, and a calm minimal UI',
);
const OUT = flag('--out', '/tmp/zeroops-e2e-result.json');
const BUILD_TIMEOUT_MS = Number(flag('--build-timeout', '600000')); // 10m
const SHIP_TIMEOUT_MS = Number(flag('--ship-timeout', '900000')); // 15m
const POLL_MS = 2500;

const result = {
  ok: false,
  prompt: PROMPT,
  base: BASE,
  buildJobId: null,
  workspaceId: null,
  previewPath: null,
  previewHttp: null,
  previewHasApp: null,
  shipJobId: null,
  liveUrl: null,
  verified: null,
  httpStatus: null,
  error: null,
  stages: [],
  startedAt: new Date().toISOString(),
  finishedAt: null,
};

function log(...parts) {
  console.log(`[e2e ${new Date().toISOString().slice(11, 19)}]`, ...parts);
}

function note(stage, detail) {
  result.stages.push({ stage, detail, at: new Date().toISOString() });
  log(stage, detail || '');
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { res, body, text };
}

async function pollJob(url, timeoutMs, label) {
  const start = Date.now();
  let from = 0;
  while (Date.now() - start < timeoutMs) {
    const { res, body } = await jsonFetch(`${url}${url.includes('?') ? '&' : '?'}from=${from}`);
    if (!res.ok) {
      throw new Error(`${label} poll HTTP ${res.status}: ${JSON.stringify(body)}`);
    }
    if (Array.isArray(body.events)) {
      for (const ev of body.events) {
        if (ev.type === 'stage' || ev.type === 'log') {
          note(label, `${ev.stage || ev.type}: ${ev.message || ev.text || ''}`.trim());
        }
      }
      if (typeof body.next === 'number') from = body.next;
    }
    const st = body.status;
    note(label, `status=${st}`);
    if (st === 'ready' || st === 'failed' || body.done) return body;
    await sleep(POLL_MS);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function main() {
  note('status', 'checking demo status');
  const status = await jsonFetch(`${BASE}/api/demo/status`);
  if (!status.res.ok) throw new Error(`status HTTP ${status.res.status}`);
  note('status', JSON.stringify({
    hasDemoOpenAI: status.body.hasDemoOpenAI,
    hasDemoPat: status.body.hasDemoPat,
    vibeRoutes: status.body.vibeRoutes,
  }));
  if (!status.body.hasDemoOpenAI) {
    throw new Error('OPENAI missing on server — set OPENAI_API_KEY in .env and restart');
  }
  if (!status.body.hasDemoPat) {
    throw new Error('DEMO_PAT missing on server — set DEMO_PAT in .env and restart');
  }

  note('build', `POST /api/vibe/build prompt=${PROMPT.slice(0, 60)}…`);
  const buildStart = await jsonFetch(`${BASE}/api/vibe/build`, {
    method: 'POST',
    body: JSON.stringify({ prompt: PROMPT }),
  });
  if (buildStart.res.status !== 202 || !buildStart.body.jobId) {
    throw new Error(`build start failed: HTTP ${buildStart.res.status} ${JSON.stringify(buildStart.body)}`);
  }
  result.buildJobId = buildStart.body.jobId;
  note('build', `job ${result.buildJobId}`);

  const build = await pollJob(`${BASE}/api/vibe/build/${result.buildJobId}`, BUILD_TIMEOUT_MS, 'build');
  if (build.status !== 'ready') {
    throw new Error(`build failed: ${build.error || build.status}`);
  }
  result.workspaceId = build.workspaceId;
  result.previewPath = build.previewPath || `/api/vibe/preview/${build.workspaceId}/`;
  note('build', `ready workspace=${result.workspaceId}`);

  // Preview smoke: HTML shell + App module
  const previewUrl = `${BASE}${result.previewPath}`;
  const html = await fetch(previewUrl);
  result.previewHttp = html.status;
  const htmlText = await html.text();
  if (!html.ok || !htmlText.includes('root')) {
    throw new Error(`preview HTML not ok: HTTP ${html.status}`);
  }
  const appRes = await fetch(`${previewUrl.replace(/\/?$/, '/')}src/App.tsx`);
  const appText = await appRes.text();
  result.previewHasApp = appRes.ok && /basename|BrowserRouter|HashRouter|Index/.test(appText);
  note('preview', `html=${result.previewHttp} appOk=${result.previewHasApp}`);
  if (!result.previewHasApp) {
    note('preview', 'warn: App.tsx missing expected markers (still shipping)');
  }

  note('ship', `POST /api/vibe/ship workspaceId=${result.workspaceId}`);
  const shipStart = await jsonFetch(`${BASE}/api/vibe/ship`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: result.workspaceId,
      buildJobId: result.buildJobId,
      projectName: undefined,
    }),
  });
  if (shipStart.res.status !== 202 || !shipStart.body.jobId) {
    throw new Error(`ship start failed: HTTP ${shipStart.res.status} ${JSON.stringify(shipStart.body)}`);
  }
  result.shipJobId = shipStart.body.jobId;
  note('ship', `job ${result.shipJobId}`);

  const ship = await pollJob(`${BASE}/api/vibe/ship/${result.shipJobId}`, SHIP_TIMEOUT_MS, 'ship');
  if (ship.status === 'failed' || ship.error) {
    throw new Error(`ship failed: ${ship.error || ship.status}`);
  }
  result.liveUrl = ship.liveUrl || null;
  result.verified = ship.verified ?? null;
  result.httpStatus = ship.httpStatus ?? null;
  if (!result.liveUrl) {
    throw new Error('ship finished without liveUrl (refusing to invent one)');
  }
  note('ship', `liveUrl=${result.liveUrl} verified=${result.verified}`);

  // External verify
  let liveCode = 0;
  for (let i = 0; i < 12; i += 1) {
    try {
      const live = await fetch(result.liveUrl, { redirect: 'follow' });
      liveCode = live.status;
      note('verify', `GET liveUrl → ${liveCode}`);
      if (liveCode >= 200 && liveCode < 400) break;
    } catch (err) {
      note('verify', `attempt ${i + 1} error: ${err.message}`);
    }
    await sleep(5000);
  }
  result.httpStatus = liveCode || result.httpStatus;
  if (!(liveCode >= 200 && liveCode < 400)) {
    throw new Error(`live URL not healthy: HTTP ${liveCode}`);
  }

  result.ok = true;
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  // Also drop a short note in the engine for humans
  const notesPath = path.resolve('e2e-last-deploy.json');
  try {
    fs.writeFileSync(notesPath, JSON.stringify(result, null, 2));
  } catch {
    /* ignore */
  }
  console.log('\n=== E2E SUCCESS ===');
  console.log('liveUrl:', result.liveUrl);
  console.log('workspaceId:', result.workspaceId);
  console.log('wrote:', OUT);
  process.exit(0);
}

main().catch((err) => {
  result.ok = false;
  result.error = err && err.message ? err.message : String(err);
  result.finishedAt = new Date().toISOString();
  try {
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  } catch {
    /* ignore */
  }
  console.error('\n=== E2E FAILED ===');
  console.error(result.error);
  console.error('partial:', JSON.stringify(result, null, 2));
  process.exit(1);
});
