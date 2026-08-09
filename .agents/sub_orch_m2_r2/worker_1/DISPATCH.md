## 2026-08-08T19:11:18Z
Your working directory is /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2/worker_1.
Your project root is /Users/arogyabichpuria/Documents/side-quests/zerops-hack.
Your code working directory is /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine.

Read ORIGINAL_REQUEST.md at /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2/ORIGINAL_REQUEST.md.
Also read Explorer handoff reports at:
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2/explorer_1/handoff.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2/explorer_2/handoff.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2/explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks for Milestone M2:
1. Session Authentication Endpoints & Security (`zeroops-engine/src/server/index.js`):
   - Normalize email inputs with `.toLowerCase().trim()` across signup, login, and token endpoints.
   - Hash passwords safely using Node built-in `crypto.scryptSync` (or `crypto.pbkdf2Sync`) with salt on signup, and timing-safe comparison on login.
   - Harden `express-session` options: set `cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }` and secret fallback `process.env.SESSION_SECRET || 'zeroops-studio-hackathon-2026'`.
   - Call `req.session.regenerate()` upon successful signup and login.
   - In `/api/auth/logout`, add `res.clearCookie('connect.sid')` alongside `req.session.destroy()`.
   - In WebSocket `deploy` event handler, if `zeropsToken` is not provided in message payload, fall back to checking `users[sessionUser.email].zeropsToken` or `wsTokenMap.get(req.sessionID)`.

2. PAT Onboarding Modal & Frontend Session Storage (`zeroops-engine/public/studio.html` & `studio.js`):
   - In `studio.html`: Wrap PAT input and button in `<form id="onboarding-form" onsubmit="event.preventDefault(); saveToken();">` so pressing Enter submits token. Add `<button class="topbar__logout" onclick="openTokenModal()">Change Token</button>` in `.topbar__user`.
   - In `studio.js`: Persist PAT token in `sessionStorage` (`sessionStorage.setItem('zerops_pat', token)`). In `saveToken()`, call `POST /api/ws-token` to register session token on server. Show UI error message if empty token is submitted. On prompt submit, verify PAT token is present before launching deployment (show modal if missing).

3. ZCPClient Wrapper & Private Net Injection (`zeroops-engine/src/server/zcp-client.js`, `src/zcp/zcp-client.ts`, `src/synthesizer/private-net.ts`):
   - In `src/server/zcp-client.js`: Ensure `this.apiToken` is passed to `zcli` child process via environment options (`env: { ...process.env, ...(this.apiToken ? { ZEROPS_TOKEN: this.apiToken } : {}) }`).
   - In `src/server/zcp-client.js`: Pipe `zeropsYmlContent || importSpecYaml` to `zcliProc.stdin` instead of overriding with static YAML.
   - In `src/synthesizer/private-net.ts`: Broaden managed service matching to support `postgres`/`postgresql` and `valkey`/`redis` variations.

4. Test Verification:
   - Update and expand `zeroops-engine/tests/auth-onboarding.test.ts` to cover all new/hardened functionality.
   - Run tests: `npx vitest run tests/auth-onboarding.test.ts` and `npm test` inside `zeroops-engine`. Verify 100% pass.

5. Deliverable: Write handoff report at `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2/worker_1/handoff.md` with complete evidence chain, build/test results, and changed file list. Send a message to parent when complete.
