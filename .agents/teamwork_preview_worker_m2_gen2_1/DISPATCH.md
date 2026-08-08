## 2026-08-08T17:53:32Z
You are Worker 1 for Milestone M2 Gen 2 (`teamwork_preview_worker_m2_gen2_1`).
Your working directory is `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_worker_m2_gen2_1`.

You MUST read:
1. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md`
2. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/PROJECT.md`
3. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_gen2/SCOPE.md`
4. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_explorer_m2_gen2_1/handoff.md`
5. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_explorer_m2_gen2_2/handoff.md`
6. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_explorer_m2_gen2_3/handoff.md`

Your objective:
Implement the fixes for Go template string escaping, polyglot stub validation, and unit test coverage in `zeroops-engine`.

Write Ownership:
- `zeroops-engine/src/code-gen/template-generator.ts`
- `zeroops-engine/src/code-gen/stub-validator.ts`
- `zeroops-engine/tests/code-gen.test.ts` (or new test file under `zeroops-engine/tests/`)

Specific Action Items:
1. In `zeroops-engine/src/code-gen/template-generator.ts`:
   - Fix lines 782 and 784 in the Go worker template where single `\n` inside TypeScript backticks produces unescaped newlines in Go string literals (`fmt.Printf("[Worker] Processing queue task #%d\n", id)`). Escape `\n` to `\\n`.
   - Perform a full pass over all templates (Go API, Python API/Worker, Express, gRPC, React, SQL) to ensure all control characters in string literals are properly escaped (`\\n`, `\\t`, etc.).

2. In `zeroops-engine/src/code-gen/stub-validator.ts`:
   - Hardened `validateNonTsFile`: Add check for unterminated string literals or syntax corruptions in Go files (e.g. unescaped newlines in double-quoted strings).
   - Hardened `validateTsAst`: Verify `(sourceFile as any).parseDiagnostics` or `ts.getPreEmitDiagnostics` so TypeScript syntax parsing errors set `astValid: false`.

3. In `zeroops-engine/tests/code-gen.test.ts`:
   - Add test cases for `generateWorker` with `runtime: 'go'`.
   - Add test cases verifying that generated Go worker code contains valid Go syntax without unterminated string literals.
   - Add test cases testing `stub-validator.ts` against valid and invalid Go code.

4. Build and Test Verification:
   - Run `cd /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine && npm run build`
   - Run `cd /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine && npm test`
   - Run empirical test:
     `node -e "const { generateWorker } = require('./dist/index.js'); console.log(generateWorker({ runtimes: [{ name: 'worker', runtime: 'go' }], managedServices: [] })['src/worker/consumer.go']);" | gofmt -e`
     and verify it exits 0 with zero syntax errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Output your handoff report to `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_worker_m2_gen2_1/handoff.md`. Include exact build and test outputs and command results. Communicate back via send_message when done.
