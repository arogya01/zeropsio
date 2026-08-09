# Dispatch for Worker 1 (Verification & Health Audit Suite Implementation)

Working directory: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/worker_m5_1
Project root: /Users/arogyabichpuria/Documents/side-quests/zerops-hack
Code directory: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine
Original Request Path: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m5_r2/ORIGINAL_REQUEST.md

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks to Execute:
1. **Create `src/verifier/live-auditor.ts`**:
   - Implement `IVerificationSuite` contract matching `tests/harness.ts` (`auditHttp`, `auditDb`, `auditCache`, `auditQueueE2E`, `runFullAudit`).
   - Support 4 audits: public HTTP 200 check, API gateway `/api/health` check, private PostgreSQL VXLAN connectivity audit (`10.160.0.21:5432`), private Valkey cache ping audit (`10.160.0.25:6379`).
   - Implement configurable retries with backoff for cold starts, per-probe 3000ms timeouts, and graceful offline/mock fallback for unit tests.

2. **Harden `src/server/health-checker.js`**:
   - Integrate `LiveAuditor` (or underlying verification logic).
   - Return complete `AuditResult` schema with `details` object (`publicHttp`, `apiGateway`, `postgresPrivateDb`, `valkeyPrivateCache`), `auditsPassed`, `auditsTotal`, `score`, and `liveUrl`.
   - Wrap in `try/catch` to ensure `runAudit` never throws uncaught exceptions.

3. **Harden Deployment Pipeline Integration in `src/server/index.js`**:
   - Execute `healthChecker.runAudit()` on deployment completion.
   - Stream logs to WebSocket client via `sendLog`.
   - Ensure WebSocket handler catches errors during deploy/audit and sends `{ type: 'error', error: err.message }` to socket.

4. **Harden UI Verified URL Presenter Banner**:
   - In `public/studio.html`: Add `id="success-banner"` attribute to the success card container element (line 163).
   - In `public/studio.js`: Update WebSocket `type: 'complete'` handler to show `#success-banner` and set `#success-link` ONLY if `data.audit && (data.audit.success === true || data.audit.auditsPassed === data.audit.auditsTotal)`.

5. **Run & Verify Tests**:
   - Run `cd zeroops-engine && npx vitest run tests/cli.test.ts tests/harness.test.ts` and `npx vitest run`.
   - Update unit test assertions in `tests/cli.test.ts` and `tests/harness.test.ts` to assert all 4 health audits and banner conditions.
   - Verify 100% test pass.

Write your report to `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/worker_m5_1/handoff.md`.
