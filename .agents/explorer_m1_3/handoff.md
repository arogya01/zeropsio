# Handoff Report: Workbench UI, Log Streamer & TEST_READY.md Plan

**Agent**: Explorer 3 (Milestone M1)  
**Working Directory**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_3/`  
**Date**: 2026-08-09  

---

## 1. Observation

Direct observations from codebase inspection and local test execution:

1. **Web Studio Backend Server (`src/studio/server.ts`)**:
   - `createStudioServer(options?: StudioServerOptions)` creates Express app + HTTP server + WebSocketServer (`/ws/logs`) + `WsLogger` instance.
   - REST endpoints mounted:
     - `GET /api/health` (`server.ts:61`)
     - `GET /api/status` (`server.ts:70`)
     - `GET /api/topology` (`server.ts:87`)
     - `POST /api/synthesize` (`server.ts:94`) — validates `prompt`, returns `zeropsProjectImportYaml`, `zeropsYaml`, `codeFiles`, `topology`
     - `POST /api/deploy` (`server.ts:121`) — triggers import + deploy, starts `logger.runDeploymentPipeline`, returns `deploymentId`, `liveUrl`
     - `GET *` (`server.ts:153`) — SPA fallback serving static files from dynamic static directory candidates.
   - `studio.listen(0)` (`server.ts:165`) binds to an ephemeral port; `studio.close()` (`server.ts:182`) cleanly closes WS logger and HTTP server.

2. **WebSocket Log Streamer & Broadcaster (`src/studio/ws-logger.ts`)**:
   - Attached to HTTP server on path `/ws/logs` (`ws-logger.ts:50`).
   - On connection: sends welcome JSON log message (`ws-logger.ts:83`) and log history replay `{ type: 'history', logs }` (`ws-logger.ts:56`).
   - Message routing (`ws-logger.ts:266`):
     - `{ type: 'subscribe', service: '...' }`: filters broadcast logs per client socket.
     - `{ type: 'getHistory' }`: returns log buffer array.
     - `{ type: 'ping' }`: responds with `{ type: 'pong', timestamp }`.
     - `{ action: 'deploy', prompt: '...', projectName: '...' }`: initiates `runDeploymentPipeline`.
     - Non-JSON malformed frames (`ws-logger.ts:284`): caught safely and emitted as sanitized system stderr message.
   - ANSI color formatting per service type (`ws-logger.ts:125`) and control character sanitization (`ws-logger.ts:116`).
   - Topology status broadcasts (`updateTopology`, `ws-logger.ts:221`) emit `{ type: 'topology-update', serviceId, status, privateIp }`.
   - Deployment completion broadcasts (`complete`, `ws-logger.ts:244`) emit `{ type: 'complete', liveUrl, projectName, services, audit }`.

3. **Current Test Runner & Test Case Counts**:
   - `npx vitest run` executes 72 unit/integration tests across 9 files:
     - `synthesizer.test.ts` (4 tests)
     - `harness.test.ts` (6 tests)
     - `private-net.test.ts` (2 tests)
     - `yaml-generator.test.ts` (3 tests)
     - `zcp-client.test.ts` (6 tests)
     - `cli.test.ts` (3 tests)
     - `code-gen.test.ts` (23 tests)
     - `m3_challenger_stress.test.ts` (10 tests)
     - `studio.test.ts` (15 tests)
   - `npx tsx --test tests/tier*.test.ts` executes 197 Node native E2E tests across 4 files:
     - `tier1_feature_coverage.test.ts` (85 tests)
     - `tier2_boundary_edge.test.ts` (85 tests)
     - `tier3_pairwise.test.ts` (17 tests)
     - `tier4_scenarios.test.ts` (10 tests)
   - Total existing baseline = 72 + 197 = 269 tests.
   - Adding M1 files (`auth-onboarding.test.ts`, `template-library.test.ts`, `workbench-ui.test.ts`) expands test suite to **296+ total tests**.

---

## 2. Logic Chain

1. **Need for `tests/workbench-ui.test.ts`**:
   - While `studio.test.ts` covers basic endpoint smoke tests and basic deployment triggering, a dedicated `workbench-ui.test.ts` file is required for Milestone M1 to isolate full Workbench UI API contracts, WebSocket streamer protocol edge cases (service filtering, ping/pong, non-JSON malformed frame resilience, history replay), topology state lifecycle (`idle` -> `BUILDING` -> `HEALTHY`), static asset routing, and `WsLogger` unit utility logic (control char sanitization, ring buffer bounds).
2. **Design of `tests/workbench-ui.test.ts`**:
   - Uses `createStudioServer({ mock: true })` listening on port `0` for true parallel test isolation.
   - Tests REST endpoints (`/api/health`, `/api/status`, `/api/topology`, `/api/synthesize`, `/api/deploy`, fallback `GET *`).
   - Tests WebSocket endpoints `/ws/logs` using `ws` client library.
   - Tests WsLogger unit methods (`sanitizeMessage`, `formatAnsi`, ring buffer bounds, `subscribe`).
3. **Documentation Unification Strategy for `TEST_READY.md`**:
   - `package.json` scripts currently only define `"test": "npx vitest run"`.
   - Update `package.json` to define:
     - `"test"`: `"npx vitest run && npx tsx --test tests/tier*.test.ts"`
     - `"test:unit"`: `"npx vitest run"`
     - `"test:tier"`: `"npx tsx --test tests/tier*.test.ts"`
     - `"test:all"`: `"npm run test:unit && npm run test:tier"`
   - `TEST_READY.md` must be updated to document these new commands and break down all test cases (269 baseline + 27+ new M1 tests = 296+ total tests across 16 test files).

---

## 3. Caveats

- **Dual-Runner Split**: Vitest handles module imports/ESM native files cleanly, whereas Node native runner (`npx tsx --test`) handles the Tier 1-4 tests (`tier*.test.ts`). `harness.ts` uses top-level await which fails under `tsx --test` if imported into CJS context; therefore Tier tests import directly from `node:test` and `node:assert`.
- **Ephemeral Port Conflicts**: Tests must always use port `0` (`studio.listen(0)`) to avoid `EADDRINUSE` port collision issues when running concurrently.
- **WebSocket Teardown**: WS client connections in tests must be explicitly closed (`ws.close()`) and `studio.close()` must be called in `afterAll` to prevent hanging open handles.

---

## 4. Conclusion

- Workbench UI endpoints (`/api/synthesize`, `/api/deploy`, `/api/status`, `/api/topology`) and WebSocket streamer backend (`/ws/logs`) are fully implemented and ready for comprehensive test coverage in `tests/workbench-ui.test.ts`.
- A 15-test specification for `tests/workbench-ui.test.ts` has been fully designed.
- The test count breakdown (72 Vitest + 197 Node Tier = 269 baseline + 27+ new M1 tests = 296+ total test cases) and `package.json` script updates provide a clear blueprint for updating `TEST_READY.md`.

---

## 5. Verification Method

1. **Verify Current Vitest Suite**:
   ```bash
   cd zeroops-engine
   npx vitest run
   ```
   Expect: 9 passed test files, 72 passed tests.

2. **Verify Node Native Tier Suite**:
   ```bash
   cd zeroops-engine
   npx tsx --test tests/tier*.test.ts
   ```
   Expect: 197 passed tests across Tier 1, Tier 2, Tier 3, and Tier 4.

3. **Verify Combined Baseline**:
   Total test cases: 72 + 197 = 269 test cases.

4. **Verify Detailed Plan File**:
   Inspect `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_3/analysis_workbench_and_test_ready.md`.
