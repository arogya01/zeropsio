## 2026-08-09T00:49:09Z
Task:
Fix the test mocking issue reported by Reviewer 1 so that `npm test` passes 100% without failures:
1. In `zeroops-engine/src/server/zcp-client.js`: Use `const childProcess = require('child_process');` and invoke `childProcess.spawn(...)` (or `const cp = require('child_process'); cp.spawn(...)`) instead of destructuring `const { spawn } = require('child_process')` at module load time. This ensures `vi.spyOn(childProcess, 'spawn')` in vitest cleanly intercepts child process spawning during full suite execution (`npm test`).
2. In `zeroops-engine/tests/auth-onboarding.test.ts`: Ensure `vi.spyOn(childProcess, 'spawn')` or `vi.mock` works reliably regardless of module cache state.
3. Run test verification inside `zeroops-engine`:
   - `npx vitest run tests/auth-onboarding.test.ts`
   - `npm test`
   Verify 100% pass across all test suites with 0 failures and exit code 0.
4. Write your handoff report at `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2/worker_2/handoff.md` and send a message to parent when complete.
