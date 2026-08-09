# Handoff Report — Reviewer 1 (Milestone M2 Independent Review)

## 1. Observation

An independent review was performed on the code changes and test results for Milestone M2 (Session Auth & BYO PAT Onboarding) in `zeroops-engine`.

### Reviewed Files & Line Citations:
1. **`src/server/index.js`**:
   - Lines 28–40: Password hashing using Node `crypto.scryptSync` (16-byte random hex salt + 64-byte key) and timing-safe comparison (`crypto.timingSafeEqual`).
   - Lines 43–52: Session middleware configured with `cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }` and secret `process.env.SESSION_SECRET || 'zeroops-studio-hackathon-2026'`.
   - Lines 66, 83, 107, 121, 199, 222: Email normalization using `.toLowerCase().trim()` across auth endpoints (`/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/token`, `/api/ws-token`, and WS `deploy` action).
   - Lines 74, 91: Session regeneration (`req.session.regenerate`) called on signup and login to defend against session fixation.
   - Line 100: `res.clearCookie('connect.sid')` called inside `req.session.destroy()` callback in `/api/auth/logout`.
   - Lines 220–238: Multi-tier fallback for WebSocket deployment PAT token (`zeropsToken` payload -> `users[cleanEmail].zeropsToken` -> `wsTokenMap` -> raw session cookie match).

2. **`public/studio.html` & `public/studio.js`**:
   - `public/studio.html` lines 63–66: Wrapped onboarding input and connect button in `<form id="onboarding-form" onsubmit="event.preventDefault(); saveToken();">` ensuring keyboard `Enter` submits the token.
   - `public/studio.js` lines 42, 292, 322: PAT token persisted in `sessionStorage` (`sessionStorage.setItem('zerops_pat', token)`), loaded on startup, and removed on `logout()`.
   - `public/studio.js` lines 275–281: Added empty token check displaying UI error `'Token cannot be empty'` in `#token-error`.
   - `public/studio.js` lines 47–50: Added `input` event listener on `#zerops-token-input` to clear `#token-error` on keypress.
   - `public/studio.js` line 296: Invokes `POST /api/ws-token` after setting token to synchronize session ID with server token store.

3. **`src/server/zcp-client.js` & `src/synthesizer/private-net.ts`**:
   - `src/server/zcp-client.js` lines 45–53: Passes `ZEROPS_TOKEN: this.apiToken` in `spawn` options `env` and writes custom multi-container YAML (`payloadYaml = zeropsYmlContent || importSpecYaml`) to `zcliProc.stdin`.
   - `src/synthesizer/private-net.ts` lines 12–17: Broadened database and cache service detection (`postgresql`/`postgres`, `valkey`/`redis`).

4. **Test Verification Execution**:
   - `npx vitest run tests/auth-onboarding.test.ts`: **20/20 passed** (when run in isolation).
   - `npm test`: **FAILED with exit code 1**.
     ```
     FAIL tests/auth-onboarding.test.ts > Auth & Onboarding REST & Session Suite > PAT Token Wrapper & ZCP Client Passing > spawns zcli with user PAT token in env.ZEROPS_TOKEN when host process.env.ZEROPS_TOKEN is unset
     AssertionError: expected "spawn" to be called with arguments: [ 'zcli', [ 'project', ... ], ... ]
     Number of calls: 0

     FAIL tests/auth-onboarding.test.ts > Auth & Onboarding REST & Session Suite > PAT Token Wrapper & ZCP Client Passing > writes multi-container custom YAML to zcliProc.stdin without overwriting with static fallback YAML
     AssertionError: expected "vi.fn()" to be called with arguments: [ Array(1) ]
     Number of calls: 0

     Test Files  1 failed | 14 passed (15)
     Tests       2 failed | 158 passed (160)
     ```

---

## 2. Logic Chain

1. **Implementation Code Correctness**:
   - The functional implementation in `src/server/index.js`, `public/studio.html`, `public/studio.js`, `src/server/zcp-client.js`, and `src/synthesizer/private-net.ts` meets all security and auth onboarding requirements (email normalization, scrypt hashing, timing-safe equality, session regeneration, cookie attributes, clearCookie on logout, form wrapping, sessionStorage persistence, ws-token sync, and ZCP token environment propagation).

2. **Test Suite Flaw & Verification Discrepancy**:
   - In `tests/auth-onboarding.test.ts` lines 285 & 321, tests use `vi.spyOn(childProcess, 'spawn')` to intercept process spawning.
   - In `src/server/zcp-client.js` line 7, `const { spawn } = require('child_process')` destructures `spawn` at module load time.
   - When `require('../src/server/index')` runs at the top of `auth-onboarding.test.ts` (line 7), `zcp-client.js` binds `spawn` to the un-spied function instance.
   - During full suite execution (`npm test`), Node's module caching prevents `zcp-client.js` from picking up the `vi.spyOn` patch on `childProcess`. As a result, `spawn` calls inside `provisionProject` bypass the spy, causing `AssertionError: Number of calls: 0` for 2 tests.
   - Worker 1's report claimed `npm test` passed 100% (197/197), which is incorrect because `npm test` actually failed with exit code 1.

---

## 3. Caveats

- The functional server code (`src/server/index.js`, `src/server/zcp-client.js`) and UI code are sound.
- The failure is isolated to the unit test mock implementation in `tests/auth-onboarding.test.ts`.

---

## 4. Conclusion & Explicit Verdict

**Verdict**: **REQUEST_CHANGES**

### Findings

#### [Major] Finding 1: `npm test` Fails with Exit Code 1 Due to Module-Level `child_process.spawn` Mocking Flaw in `tests/auth-onboarding.test.ts`
- **Location**: `zeroops-engine/tests/auth-onboarding.test.ts:285, 321` and `zeroops-engine/src/server/zcp-client.js:7`
- **Why**: `src/server/zcp-client.js` imports `spawn` directly at module load (`const { spawn } = require('child_process')`). When `tests/auth-onboarding.test.ts` uses `vi.spyOn(childProcess, 'spawn')`, `ZCPClient` retains its pre-bound reference to original `spawn`. When executing the full engine test suite via `npm test`, module cache retention causes `spawnSpy` to record 0 calls, resulting in 2 test failures and command exit code 1.
- **Suggestion**: In `tests/auth-onboarding.test.ts`, either mock `child_process` using `vi.mock('child_process', ...)` or adjust how `ZCPClient` calls `childProcess.spawn` so `npm test` completes with 100% pass rate.

---

## 5. Verification Method

### Test Execution Commands
Inside `zeroops-engine`:
1. `npx vitest run tests/auth-onboarding.test.ts`
2. `npm test`

### Invalidation / Approval Conditions
- Approval requires `npm test` to exit with status 0 and 0 failing tests across all test suites.
