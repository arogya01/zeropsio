## 2026-08-08T17:30:28Z
You are Worker 1 for Milestone M1 (ZCP Stack Synthesizer & Engine Core).
Your working directory is `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/worker_m1_1`. Please create agent metadata files only in your working directory.
Code implementation must be created directly in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/`.

MANDATORY INPUTS TO READ BEFORE STARTING:
1. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md`
2. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/PROJECT.md`
3. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m1/SCOPE.md`
4. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_1/analysis.md`
5. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_2/analysis.md`
6. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_3/analysis.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement the complete, genuine, zero-stub codebase for Milestone M1 in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`:

1. **Workspace & Build Scaffolding**:
   - Create `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine` workspace directory.
   - Write `package.json` (ESM `"type": "module"`, `"bin": { "zeroops": "./dist/index.js" }`, dependencies `commander`, `js-yaml`, `picocolors`, `zod`, devDependencies `typescript`, `@types/node`, `@types/js-yaml`, `tsup`, `vitest`, `tsx`).
   - Write `tsconfig.json` (Target ES2022, `moduleResolution: NodeNext`, strict mode).
   - Write `tsup.config.ts` and `vitest.config.ts`.

2. **Synthesizer Core Module**:
   - `src/synthesizer/types.ts`: Standard interface definitions (`StackTopologySpec`, `GeneratedConfigs`, `RuntimeSpec`, `ManagedServiceSpec`, `SupportedRuntime`, `SupportedManagedService`, `ZeropsProjectImportSpec`, `ZeropsYamlSpec`) adhering strictly to `PROJECT.md` § Interface Contracts.
   - `src/synthesizer/stack-synthesizer.ts`: Natural language prompt parser to stack topology specification. Parses prompts and enforces standard fallbacks guaranteeing at least 3 runtimes (e.g. nodejs frontend, go api, python worker) + 2 managed DBs (postgresql HA, valkey HA).
   - `src/synthesizer/private-net.ts`: Inter-service private network IP environment variable injector (`DB_HOST=postgres`, `DB_PORT=5432`, `DATABASE_URL=...`, `VALKEY_HOST=valkey`, `REDIS_URL=...`, `API_URL=...`, `PORT=...`).
   - `src/synthesizer/yaml-generator.ts`: Dual generator producing spec-compliant `zerops-project-import.yml` and `zerops.yml` using `js-yaml` or structured string serialization.

3. **ZCP Bridge & Engine CLI Entry Point**:
   - `src/zcp/zcp-client.ts`: `ZcpClient` class supporting dual execution modes (`real` REST API / zcli call vs `mock` simulation). Mock mode allocates synthetic private IPs (`10.0.0.10` - `10.0.0.14`) and mock URLs (`https://${serviceName}-${hash}.zerops.app`), deployment status polling, log streaming callbacks, auto-fallback when token missing.
   - `src/index.ts`: Executable CLI entry point with `commander` (`synthesize <prompt>`, `deploy <project-name>`, `import <yaml-path>`, flags `--mock`, `--output`, `--json`, `--verbose`) + re-exported programmatic API functions (`runSynthesis`, `runDeployment`, `runImport`).

4. **Comprehensive Unit & Integration Test Suite**:
   - Write tests under `zeroops-engine/tests/`:
     - `tests/synthesizer.test.ts`
     - `tests/yaml-generator.test.ts`
     - `tests/private-net.test.ts`
     - `tests/zcp-client.test.ts`
     - `tests/cli.test.ts`

5. **Build, Typecheck & Verification**:
   - Execute build command (`npm run build` or `npx tsup`) inside `zeroops-engine/` and verify clean build.
   - Execute typecheck command (`npm run typecheck` or `npx tsc --noEmit`) inside `zeroops-engine/` and verify 0 errors.
   - Execute test command (`npm test` or `npx vitest run`) inside `zeroops-engine/` and verify all tests pass with exit code 0.

Write your implementation report to `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/worker_m1_1/changes.md` and deliver your handoff in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/worker_m1_1/handoff.md` with exact build and test command outputs. Send a message back to parent when complete.
