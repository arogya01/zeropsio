## 2026-08-08T17:29:49Z
<USER_REQUEST>
You are test_writer_infra.
Your working directory is: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/test_writer_infra
You MUST read:
1. /Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md
2. /Users/arogyabichpuria/Documents/side-quests/zerops-hack/PROJECT.md
3. /Users/arogyabichpuria/Documents/side-quests/zerops-hack/TEST_INFRA.md

Objective:
Set up the test runner environment and harness for `zeroops-engine`.
Files you EXCLUSIVELY own:
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/package.json
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/tsconfig.json
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/tests/harness.ts

Requirements:
1. Create `zeroops-engine/package.json` if missing or update it to include `"scripts": { "test": "tsx --test tests/*.test.ts" }` or `node --import tsx --test tests/*.test.ts` or `vitest run`. Make sure `npm test` or `npx tsx --test tests/*.test.ts` runs all test files cleanly. Add needed devDependencies like `tsx`, `typescript`, `@types/node`.
2. Create `zeroops-engine/tsconfig.json` configuring TypeScript (target ES2022, module NodeNext/ESNext, strict true).
3. Create `zeroops-engine/tests/harness.ts` exporting:
   - Test utilities & assertion functions (e.g. `assert`, `expect`, `describe`, `it`, `test`)
   - Opaque-box contract interfaces & mock drivers for ZCP API, Stack Synthesizer, Code Synthesizer, Web Studio, WebSocket Log Streamer, and Verification Suite so tests can run opaque-box assertions.
4. Run `npm test` or verify that the test runner environment is properly initialized.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write a detailed handoff report in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/test_writer_infra/handoff.md` summarizing what you created and verified.
</USER_REQUEST>
