# Demo Integrity & Self-Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get ZeroOps Studio running on a real, clickable Zerops URL, and make every success claim in the demo reflect something the code actually measured.

**Architecture:** The `zcli` integration in `src/server/zcp-client.js` is already correct — it spawns the real `zcli project project-import -` with the user's token. The defects are all *fallbacks that manufacture success*: fabricated URLs, a mock-by-default health auditor, hardcoded private IPs, and unconditional green topology chips. Every fix is a deletion or an inversion of a default, not new subsystem work. Task 1 is additive (deploy config that does not exist yet); Tasks 2–6 remove fabrication from existing code paths.

**Tech Stack:** Node.js 22, Express 4, `ws`, `js-yaml`, Vitest, `zcli` (authenticated as org `arogya01`).

## Global Constraints

- **Deadline: end of day 2026-08-09.** Tasks are ordered by risk. If time runs out, the cut line is documented after Task 3 — Tasks 1–3 are mandatory, 4–6 are the integrity polish.
- **`zerops.yml` port key is `httpSupport: true`, never `http: true`.** The current root file uses the wrong key.
- **Build and run env vars are NOT shared on Zerops.** Anything needed at build time must be declared in `build.envVariables` explicitly.
- **Managed services (Valkey, PostgreSQL) are declared in the project-import YAML, never as a `setup:` block in `zerops.yml`.** A managed service has no build step.
- **`setup:` in `zerops.yml` must exactly match a `hostname:` in the import YAML.**
- **Never construct a live URL from a project name.** Either parse it from real `zcli` output or return `null`.
- **Two copies of the auditor exist:** `src/verifier/live-auditor.js` (loaded at runtime by `health-checker.js` via CommonJS resolution) and `src/verifier/live-auditor.ts` (source for `dist/`, imported by tests). Every auditor change must be applied to **both**, with identical logic.
- Do not commit a Zerops PAT. Tokens come from the session (`wsTokenMap`) or `ZEROPS_TOKEN` in the environment.

---

### Task 1: Deployable self-hosting config (get a live URL)

This is the single highest-value task. A dead live URL at judging is the #1 documented point-loser. Nothing else in this plan matters if this does not land.

**Files:**
- Create: `zerops-project-import.yml` (engine root)
- Modify: `zerops.yml` (engine root — full rewrite, currently 34 lines and invalid)
- Create: `.zerops-deploy-notes.md` (engine root — record the real URL and project ID)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a live `https://<subdomain>.zerops.app` URL recorded in `.zerops-deploy-notes.md`, and a Zerops project named `zeroops-studio`. Task 2's URL-parsing regex is validated against the real `zcli` output captured here.

- [ ] **Step 1: Write the project-import YAML**

Create `zerops-project-import.yml`:

```yaml
project:
  name: zeroops-studio
  tags:
    - zerops-challenge

services:
  - hostname: studio
    type: nodejs@22
    enableSubdomainAccess: true
    minContainers: 1
    maxContainers: 1

  - hostname: cache
    type: valkey@7.2
    mode: NON_HA
```

`enableSubdomainAccess: true` is what gets you the public `.zerops.app` hostname. Without it the service is private-network only and there is nothing to click in the demo.

- [ ] **Step 2: Rewrite the root `zerops.yml`**

Replace the entire contents of `zerops.yml` with:

```yaml
zerops:
  - setup: studio
    build:
      base: nodejs@22
      buildCommands:
        - npm ci --omit=dev
      deployFiles:
        - src
        - public
        - package.json
        - package-lock.json
        - node_modules
    run:
      base: nodejs@22
      ports:
        - port: 3000
          httpSupport: true
      start: node src/server/index.js
      envVariables:
        PORT: 3000
        NODE_ENV: production
        VALKEY_HOST: cache
        VALKEY_PORT: 6379
```

Three deliberate changes from the current file: the `zeroops-cache` block is gone (Valkey is managed, declared in the import YAML above), `http: true` becomes `httpSupport: true`, and `setup:` is now `studio` to match the import hostname. `VALKEY_HOST: cache` is the Zerops hostname — services address each other by hostname on the private network, no IP required.

`ZEROPS_API_TOKEN` is intentionally **not** in this file. Users supply their own PAT through the Studio onboarding UI at runtime.

- [ ] **Step 3: Create the project**

Run from the engine root:

```bash
zcli project project-import zerops-project-import.yml
```

Expected: project `zeroops-studio` created with services `studio` and `cache`. Save the full stdout — Step 5 needs it.

If it fails on org ambiguity, add `--org-id cydeTCagQTayIC5j5CzRKA`.

- [ ] **Step 4: Push the code**

```bash
zcli push --serviceId studio
```

If `--serviceId` is rejected, scope the project first and push by hostname:

```bash
zcli project scope zeroops-studio
zcli push studio
```

Expected: build runs `npm ci --omit=dev`, deploy succeeds, service reaches `ACTIVE`.

- [ ] **Step 5: Capture the real URL and verify from outside**

```bash
zcli project list
curl -sS -o /dev/null -w "%{http_code}\n" https://<subdomain>.zerops.app
```

Expected: `200`. If you get a non-200, read the build log with `zcli service log studio` before changing anything — do not guess.

Record the exact `zcli` stdout from Step 3 in `.zerops-deploy-notes.md` along with the project ID and live URL. Task 2 writes a regex against that literal output, so the real text matters.

- [ ] **Step 6: Commit**

```bash
git add zerops-project-import.yml zerops.yml .zerops-deploy-notes.md
git commit -m "feat: add deployable Zerops self-hosting config for ZeroOps Studio"
```

---

### Task 2: Parse the real live URL instead of fabricating one

`zcp-client.js:123` builds `https://${cleanName}.zerops.app`. Zerops issues per-service subdomains with a generated suffix (the repo's own fixture `frontend-a1b2.zerops.app` shows the real shape), so this link is dead even when the import succeeds.

**Files:**
- Modify: `src/server/zcp-client.js:88-152`
- Test: `tests/zcp-client-url.test.ts` (create)

**Interfaces:**
- Consumes: the literal `zcli` stdout captured in Task 1 Step 5.
- Produces: `provisionProject()` now resolves `{ status, projectName, liveUrl, services, exitCode }` where `liveUrl` is `string | null` — **null when no URL was found in real output**. Tasks 3 and 5 both read `status` and `exitCode`; `index.js` must tolerate `liveUrl === null`.

- [ ] **Step 1: Write the failing test**

Create `tests/zcp-client-url.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
const { extractLiveUrl } = require('../src/server/zcp-client');

describe('extractLiveUrl', () => {
  it('extracts a real zerops.app subdomain from zcli output', () => {
    const out = 'service studio deployed\nurl: https://studio-7f3a.zerops.app\ndone';
    expect(extractLiveUrl(out)).toBe('https://studio-7f3a.zerops.app');
  });

  it('returns null when zcli printed no url', () => {
    expect(extractLiveUrl('build failed: exit status 1')).toBeNull();
  });

  it('never invents a url from a project name', () => {
    expect(extractLiveUrl('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/zcp-client-url.test.ts`
Expected: FAIL — `extractLiveUrl is not a function`.

- [ ] **Step 3: Implement `extractLiveUrl` and buffer stdout**

In `src/server/zcp-client.js`, add above `module.exports`:

```js
/**
 * Extract a real Zerops subdomain from zcli output.
 * Returns null when zcli printed no URL — we never synthesize one.
 */
function extractLiveUrl(output) {
  if (!output) return null;
  const match = output.match(/https:\/\/[a-z0-9][a-z0-9-]*\.zerops\.app[^\s'"]*/i);
  return match ? match[0] : null;
}
```

Change the export line to:

```js
module.exports = ZCPClient;
module.exports.ZCPClient = ZCPClient;
module.exports.extractLiveUrl = extractLiveUrl;
```

Inside `provisionProject`, declare a buffer immediately before `const zcliProc = childProcess.spawn(...)`:

```js
let stdoutBuffer = '';
```

In the `stdout` handler (currently line 96-103), append to it:

```js
zcliProc.stdout.on('data', (data) => {
  const text = data.toString().trim();
  stdoutBuffer += data.toString();
  if (text) {
    log(`[zcli stdout] ${text}`);
  }
});
```

Add the same `stdoutBuffer += data.toString();` line to the `stderr` handler — `zcli` prints some progress output to stderr.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/zcp-client-url.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/zcp-client.js tests/zcp-client-url.test.ts
git commit -m "fix: parse real zerops.app URL from zcli output instead of fabricating"
```

---

### Task 3: Report provisioning failure as failure

`zcp-client.js:120-131` logs `[ZCP-SUCCESS] ... provisioned on Zerops!` on **every** close regardless of exit code, and the `error` handler at 133-142 does the same on spawn failure. A failed deploy is visually identical to a successful one.

**Files:**
- Modify: `src/server/zcp-client.js:114-152`
- Test: `tests/zcp-client-status.test.ts` (create)

**Interfaces:**
- Consumes: `extractLiveUrl` and `stdoutBuffer` from Task 2.
- Produces: resolved object gains `exitCode: number | null`. `status` is `'active'` only when `code === 0`, otherwise `'error'`. `liveUrl` is `null` on any non-zero exit. Task 5 branches on `status`.

- [ ] **Step 1: Write the failing test**

Create `tests/zcp-client-status.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
const childProcess = require('child_process');
const ZCPClient = require('../src/server/zcp-client');

function fakeProc(exitCode: number, stdout = '') {
  const proc: any = new EventEmitter();
  proc.stdin = { write: () => {}, end: () => {} };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    proc.emit('close', exitCode);
  }, 0);
  return proc;
}

afterEach(() => vi.restoreAllMocks());

describe('provisionProject status honesty', () => {
  it('reports error and null url when zcli exits non-zero', async () => {
    vi.spyOn(childProcess, 'spawn').mockReturnValue(fakeProc(1));
    const logs: string[] = [];
    const result = await new ZCPClient('tok').provisionProject('demo', '', (l: string) => logs.push(l));

    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.liveUrl).toBeNull();
    expect(logs.join('\n')).not.toContain('ZCP-SUCCESS');
  });

  it('reports active with the parsed url when zcli exits zero', async () => {
    vi.spyOn(childProcess, 'spawn')
      .mockReturnValue(fakeProc(0, 'url: https://studio-7f3a.zerops.app\n'));
    const result = await new ZCPClient('tok').provisionProject('demo', '', () => {});

    expect(result.status).toBe('active');
    expect(result.liveUrl).toBe('https://studio-7f3a.zerops.app');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/zcp-client-status.test.ts`
Expected: FAIL — first test fails because `liveUrl` is a fabricated string and logs contain `ZCP-SUCCESS`.

- [ ] **Step 3: Rewrite the close and error handlers**

Replace the `zcliProc.on('close', ...)` handler body with:

```js
zcliProc.on('close', (code) => {
  if (settled) return;
  settled = true;

  const ok = code === 0;
  const liveUrl = ok ? extractLiveUrl(stdoutBuffer) : null;

  log(`[zcli exit] Process finished with exit code ${code}`);

  if (ok) {
    log(`\n[ZCP-OK] Import for '${cleanName}' completed (${services.length} services declared).`);
    if (liveUrl) {
      log(`[ZCP-URL] Live URL: ${liveUrl}`);
    } else {
      log(`[ZCP-WARN] Import succeeded but zcli printed no public URL.`);
      log(`[ZCP-WARN] Check subdomain access at https://app.zerops.io`);
    }
  } else {
    log(`\n[ZCP-FAILED] zcli exited ${code}. No project was provisioned.`);
  }

  resolve({
    status: ok ? 'active' : 'error',
    projectName: cleanName,
    liveUrl,
    services,
    exitCode: code
  });
});
```

Replace the `error` handler body with:

```js
zcliProc.on('error', (err) => {
  if (settled) return;
  settled = true;
  log(`[ZCP-FAILED] Could not spawn zcli: ${err.message}`);
  log(`[ZCP-HINT] Is zcli installed and on PATH?`);
  resolve({
    status: 'error',
    projectName: cleanName,
    liveUrl: null,
    services,
    exitCode: null
  });
});
```

Replace the `else` fallback branch (currently resolving `status: 'active'` when `zcliProc.on` is missing) with:

```js
} else {
  // zcliProc has no event emitter (mocked in tests) — we cannot observe an outcome.
  resolve({
    status: 'unknown',
    projectName: cleanName,
    liveUrl: null,
    services,
    exitCode: null
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/zcp-client-status.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full suite and fix fallout**

Run: `npm run test:unit`

Existing tests asserting `status === 'active'` from a mocked spawn will now see `'unknown'`. Update those assertions to `'unknown'` — do not revert the source change. If a test asserted a fabricated `liveUrl`, change it to assert `toBeNull()`.

- [ ] **Step 6: Commit**

```bash
git add src/server/zcp-client.js tests/
git commit -m "fix: propagate zcli exit code instead of always reporting success"
```

> ### CUT LINE
> Tasks 1–3 are mandatory: a live URL exists and the deploy path cannot lie about whether it worked. If the clock runs out here, stop, film the demo, and state the remaining gaps in the README's limitations section. Tasks 4–6 remove the remaining fabrications.

---

### Task 4: Make health audits actually probe

`live-auditor.js:15` reads `this.mockMode = options.mockMode ?? (process.env.MOCK_MODE !== 'false')`. With `MOCK_MODE` unset this evaluates to `true`, so `auditHttp` returns `{status: 200, ok: true}` at line 36 without a network call. `auditQueueE2E` (line 196) has no `mockMode` branch at all and returns `{passed: true}` unconditionally.

**Files:**
- Modify: `src/verifier/live-auditor.js:15` and `:196-201`
- Modify: `src/verifier/live-auditor.ts:76` and its `auditQueueE2E` — identical logic
- Test: `tests/live-auditor-real-mode.test.ts` (create)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `mockMode` now defaults to **false** (real probes); mocking is opt-in via `MOCK_MODE=true` or `new LiveAuditor({mockMode: true})`. `auditQueueE2E` returns `{passed: boolean, skipped?: true, reason?: string}` — `runFullAudit`'s score must count a skipped audit as not-passed.

- [ ] **Step 1: Write the failing test**

Create `tests/live-auditor-real-mode.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const { LiveAuditor } = require('../src/verifier/live-auditor');

describe('LiveAuditor default mode', () => {
  const prev = process.env.MOCK_MODE;
  beforeEach(() => { delete process.env.MOCK_MODE; });
  afterEach(() => { if (prev === undefined) delete process.env.MOCK_MODE; else process.env.MOCK_MODE = prev; });

  it('defaults to real probing, not mock', () => {
    expect(new LiveAuditor().mockMode).toBe(false);
  });

  it('opts into mock only when MOCK_MODE=true', () => {
    process.env.MOCK_MODE = 'true';
    expect(new LiveAuditor().mockMode).toBe(true);
  });

  it('reports an unreachable host as failed, not 200', async () => {
    const auditor = new LiveAuditor({ retries: 1, timeoutMs: 300 });
    const res = await auditor.auditHttp('https://this-host-does-not-exist-zeroops.zerops.app');
    expect(res.ok).toBe(false);
  });

  it('does not claim the queue audit passed when it is not implemented', async () => {
    const auditor = new LiveAuditor({ retries: 1, timeoutMs: 300 });
    const res = await auditor.auditQueueE2E('https://example.invalid/api');
    expect(res.passed).toBe(false);
    expect(res.skipped).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/live-auditor-real-mode.test.ts`
Expected: FAIL — `mockMode` is `true` by default and the queue audit returns `passed: true`.

- [ ] **Step 3: Invert the default and make the queue audit honest**

In **both** `src/verifier/live-auditor.js` (line 15) and `src/verifier/live-auditor.ts` (line 76), change:

```js
this.mockMode = options.mockMode ?? (process.env.MOCK_MODE === 'true');
```

In **both** files, replace `auditQueueE2E` with:

```js
/**
 * Queue end-to-end verification.
 * Not implemented against a live broker — reported as skipped rather than passed,
 * so the audit score never counts an unrun check as a success.
 */
async auditQueueE2E(apiEndpoint) {
  if (this.simulateQueueFailure || (apiEndpoint && apiEndpoint.includes('fail'))) {
    return { passed: false };
  }

  if (this.mockMode) {
    return { passed: true, messageId: `msg_mock` };
  }

  return {
    passed: false,
    skipped: true,
    reason: 'queue round-trip not implemented — no live broker probe'
  };
}
```

In `runFullAudit`, where the queue result is logged, make the skipped case explicit:

```js
if (onLogStream) {
  if (queueRes.skipped) {
    onLogStream(`[TEST-4] RESULT: SKIPPED — ${queueRes.reason}`);
  } else if (queueRes.passed) {
    onLogStream(`[TEST-4] RESULT: PASS`);
  } else {
    onLogStream(`[TEST-4] RESULT: FAIL`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/live-auditor-real-mode.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full suite and fix fallout**

Run: `npm run test:unit`

Tests that constructed a bare `new LiveAuditor()` and expected passing audits were relying on the old mock default. Fix each by passing `{mockMode: true}` explicitly — that is the correct expression of their intent, and it makes the mocking visible at the call site.

- [ ] **Step 6: Verify against the real deployment**

With the Task 1 URL:

```bash
MOCK_MODE=false node -e "
const {LiveAuditor} = require('./src/verifier/live-auditor');
new LiveAuditor().runFullAudit('https://<your-subdomain>.zerops.app','zeroops-studio',console.log)
  .then(r => console.log(JSON.stringify(r,null,2)));
"
```

Expected: TEST-1 genuinely passes against the live host. TEST-3/TEST-4 will likely fail or skip because Postgres is not on the private network from your laptop — **this is the correct output**, and it is the limitation to name out loud in the demo.

- [ ] **Step 7: Commit**

```bash
git add src/verifier/live-auditor.js src/verifier/live-auditor.ts tests/
git commit -m "fix: probe real endpoints by default and stop passing unimplemented queue audit"
```

---

### Task 5: Derive topology state from the actual result

`index.js:290-292` runs `for (const s of services) sendState(s, 'healthy')` unconditionally, immediately after `provisionProject` returns and before the audit runs. The chips go green even when the deploy failed.

**Files:**
- Modify: `src/server/index.js:277-305`

**Interfaces:**
- Consumes: `deployResult.status` from Task 3, `auditResult.success` from Task 4.
- Produces: no new exports. WebSocket `topology-update` messages now carry `'healthy' | 'failed'`; `public/studio.js` must render a `failed` state.

- [ ] **Step 1: Branch chip state on the deploy result**

In `src/server/index.js`, replace:

```js
for (const s of services) {
  sendState(s, 'healthy');
}
```

with:

```js
const deployOk = deployResult.status === 'active';
for (const s of services) {
  sendState(s, deployOk ? 'healthy' : 'failed');
}

if (!deployOk) {
  sendLog(`[PIPELINE] Deploy did not succeed — skipping health audit.`);
}
```

- [ ] **Step 2: Skip the audit when there is nothing to audit**

Replace the `healthChecker.runAudit(...)` call with:

```js
const auditResult = deployOk && deployResult.liveUrl
  ? await healthChecker.runAudit(
      deployResult.projectName,
      deployResult.liveUrl,
      sendLog
    )
  : { success: false, auditsPassed: 0, auditsTotal: 4, score: '0%', skipped: true };
```

Auditing a `null` URL is how a fabricated 200 sneaks back in.

- [ ] **Step 3: Confirm the UI already renders the failed state — no change expected**

`public/studio.js:228` assigns the status straight through as a class (`node.className = \`topo-chip ${rawStatus}\``), and `public/studio.css:514` already defines `.topo-chip.failed .topo-chip__dot`. Sending `'failed'` therefore renders correctly with no frontend edit.

Verify rather than assume:

```bash
grep -n "topo-chip.failed" public/studio.css   # → line 514 exists
```

If that grep returns nothing, add a `.topo-chip.failed .topo-chip__dot { background: #ef4444; box-shadow: 0 0 8px #ef4444; }` rule next to the `.healthy` rule at line 508.

- [ ] **Step 4: Verify manually**

```bash
PATH=/usr/bin:/bin node src/server/index.js
```

Running with `zcli` off `PATH` forces the spawn-error path. Trigger a deploy from the Studio UI.
Expected: chips turn **red**, the log shows `[ZCP-FAILED] Could not spawn zcli`, and no success card or live URL appears.

- [ ] **Step 5: Commit**

```bash
git add src/server/index.js public/studio.js public/studio.css
git commit -m "fix: derive topology chip state from real deploy result"
```

---

### Task 6: Replace fabricated private IPs with real Zerops hostnames

`zcp-client.js:66` generates `10.160.0.${12 + idx * 3}` and lines 74-78 hardcode five IPs. `ws-logger.ts:311` emits `[NETWORK]: Injected private IP env vars DB_HOST=10.160.0.21, VALKEY_HOST=10.160.0.25`. None of these come from Zerops. The demo storyboard narrates this line as real platform behavior.

The honest replacement is also the better demo: Zerops addresses services by **hostname** on the private network (`db:5432`, `valkey:6379`) with no connection-string plumbing. That is a genuine platform differentiator; the fake IPs were obscuring it.

**Files:**
- Modify: `src/server/zcp-client.js:60-79`
- Modify: `src/studio/ws-logger.ts:21,221-226,305-320`
- Modify: `src/studio/public/topology-canvas.js:22,33,44,55,66,148` (five more hardcoded IPs plus a `10.160.0.x` placeholder)
- Modify: `src/index.ts:216` (CLI prints `Private IP: ...`)
- Modify: `public/studio.js:231-234` (reads `data.privateIp`)
- Modify: `src/verifier/live-auditor.js:17-20` and `src/verifier/live-auditor.ts` (matching constructor defaults)
- Modify: `DEMO_STORYBOARD.md` (Scene 3 voiceover)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: service objects expose `privateHost: string` (the Zerops hostname) instead of `internalIp: string`, and the WebSocket `topology-update` payload carries `privateHost` instead of `privateIp`. **The rename must land in the same commit across the emitter (`ws-logger.ts`), the two renderers (`public/studio.js`, `src/studio/public/topology-canvas.js`), and the CLI (`src/index.ts`)** — a partial rename silently blanks the chip labels rather than erroring.

- [ ] **Step 1: Replace `internalIp` with `privateHost` in the parser**

In `src/server/zcp-client.js`, in the `services = rawServices.map(...)` block, change the returned object from `internalIp: \`10.160.0.${12 + idx * 3}\`` to:

```js
privateHost: sName
```

The hostname *is* the address on the Zerops private network — that is the whole point of the platform's networking model.

- [ ] **Step 2: Replace the hardcoded fallback list**

Replace the five-element fallback array with:

```js
services = [
  { id: 'web-frontend', type: 'nodejs@22',    port: 3000, privateHost: 'webapp' },
  { id: 'api-gateway',  type: 'go@1.22',      port: 8080, privateHost: 'apigateway' },
  { id: 'ai-worker',    type: 'python@3.12',  port: 5000, privateHost: 'aiworker' },
  { id: 'db-postgres',  type: 'postgresql@16',port: 5432, privateHost: 'dbpostgres' },
  { id: 'cache-valkey', type: 'valkey@7.2',   port: 6379, privateHost: 'cachevalkey' }
];
```

- [ ] **Step 3: Fix the fabricated network log line and rename the field**

In `src/studio/ws-logger.ts`, replace the line at 311 with:

```typescript
this.emit('zcp', 'stdout', `[NETWORK]: Services addressable by hostname on the Zerops private network — DB_HOST=dbpostgres, VALKEY_HOST=cachevalkey`);
```

Replace the IP map at 315-319 with hostname:port pairs:

```typescript
'web-frontend': 'webapp:3000',
'api-gateway': 'apigateway:8080',
'ai-worker': 'aiworker:5000',
'db-postgres': 'dbpostgres:5432',
'cache-valkey': 'cachevalkey:6379'
```

Rename the field on the interface at line 21 and the method at 221-226:

```typescript
privateHost?: string;
```

```typescript
public updateTopology(serviceId: string, status: string, privateHost?: string): void {
```

and the emitted payload property at 226 from `privateIp` to `privateHost`.

- [ ] **Step 4: Rename the field in both renderers and the CLI**

In `public/studio.js:231-234`:

```javascript
if (data.privateHost) {
  const ipEl = node.querySelector('.topo-chip__ip');
  if (ipEl) ipEl.textContent = data.privateHost;
}
```

In `src/studio/public/topology-canvas.js`, replace the five `privateIp: '10.160.0.NN:PORT'` values at lines 22, 33, 44, 55, 66 with hostname:port strings — `privateHost: 'webapp:3000'`, `'apigateway:8080'`, `'aiworker:5000'`, `'dbpostgres:5432'`, `'cachevalkey:6379'` respectively, matching the map in Step 3. At line 148 replace the fallback:

```javascript
document.getElementById('detail-node-ip').textContent = node.privateHost || 'not provisioned';
```

`'10.160.0.x'` as a default is the same fabrication in placeholder form.

In `src/index.ts:216`:

```typescript
console.log(`  - ${s.name} (${s.type}) -> Private host: ${s.privateHost}`);
```

- [ ] **Step 5: Fix the auditor's hardcoded IP defaults**

In **both** `src/verifier/live-auditor.js` (lines 17-20) and `src/verifier/live-auditor.ts`:

```js
this.postgresHost = options.postgresHost || 'dbpostgres';
this.postgresPort = options.postgresPort || 5432;
this.valkeyHost = options.valkeyHost || 'cachevalkey';
this.valkeyPort = options.valkeyPort || 6379;
```

- [ ] **Step 6: Correct the demo storyboard**

In `DEMO_STORYBOARD.md`, Scene 3, replace the claim *"allocates a private 10.160.0.0 internal subnet, binds internal private IPs for Postgres and Valkey"* with:

> *"Watch as Zerops provisions each service on a private network where they address each other by hostname — the API just connects to `dbpostgres:5432`, no connection strings, no secrets plumbing."*

Also correct Scene 4: it currently claims all four health audits pass at 100%. State the real audit count from Task 4 Step 6, and name the skipped queue check.

- [ ] **Step 7: Verify no fabricated IP or stale field name survives**

```bash
grep -rn "internalIp\|privateIp\|10\.160\." src/ public/ tests/ DEMO_STORYBOARD.md | grep -v node_modules
```

Expected: zero hits. Any remaining `privateIp` means the rename is partial, which blanks chip labels silently instead of erroring. Then run `npm run test:unit` and fix any assertion still expecting `internalIp` or an IP-shaped value.

- [ ] **Step 8: Commit**

```bash
git add src/server/zcp-client.js src/studio/ src/index.ts public/studio.js src/verifier/ DEMO_STORYBOARD.md tests/
git commit -m "fix: address services by real Zerops hostname instead of fabricated private IPs"
```

---

### Task 7: Disclosure and limitations

Required by the hackathon rules ("AI can help you build it. It can't build it for you." — disclose all tools). The repo contains a visible `.agents/` orchestration directory, so a judge will ask. Volunteering limits is documented as a score *gain*.

**Files:**
- Create: `AI-USAGE.md` (repo root — `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/`)
- Modify: `README.md` (create if absent) — add a "Known limitations" section

**Interfaces:**
- Consumes: the real audit output from Task 4 Step 6 and the live URL from Task 1.
- Produces: no code interfaces.

- [ ] **Step 1: Write `AI-USAGE.md`**

Name each tool and, per file or subsystem, what it generated versus what you wrote and reviewed. Be specific — "Claude Code generated the `zcli` subprocess wrapper in `src/server/zcp-client.js`; the project-import YAML and the `zerops.yml` service topology were hand-written and verified against a live deploy" is the level of detail that reads as credible. Do not write a generic disclaimer.

You must be able to explain the provisioning state machine cold if asked.

- [ ] **Step 2: Write the limitations section**

State plainly, in the README:
- The queue end-to-end audit is not implemented and reports as skipped.
- Private-network audits (Postgres, Valkey) only pass when run from inside the Zerops project; from a laptop they fail, so the local audit score is a lower bound.
- Whatever else Tasks 1–6 surfaced as genuinely broken.

- [ ] **Step 3: Verify the live URL one final time from a clean context**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://<your-subdomain>.zerops.app
```

Also open it on a phone. A dead URL at judging is the single largest documented point-loser; confirm it independently of your dev machine.

- [ ] **Step 4: Commit**

```bash
git add AI-USAGE.md README.md
git commit -m "docs: add AI usage disclosure and known limitations"
```

---

## Verification Summary

After all tasks, these must all hold:

```bash
# 1. Live URL returns 200 from outside your machine
curl -sS -o /dev/null -w "%{http_code}\n" https://<subdomain>.zerops.app   # → 200

# 2. No fabricated IPs or stale field names anywhere
grep -rn "internalIp\|privateIp\|10\.160\." src/ public/ DEMO_STORYBOARD.md | grep -v node_modules  # → no hits

# 3. Auditor probes for real by default
node -e "const {LiveAuditor}=require('./src/verifier/live-auditor');console.log(new LiveAuditor().mockMode)"  # → false

# 4. Full suite green
npm run test:unit
```

And one manual check that no automated test covers: run a deploy with `zcli` unavailable and confirm the UI shows failure — red chips, no live URL, no success card.
