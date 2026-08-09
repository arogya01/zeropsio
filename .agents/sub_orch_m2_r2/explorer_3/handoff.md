# Handoff Report — Explorer 3: ZCPClient Wrapper, Private Network Synthesizer & Test Suite Audit

## 1. Observation

### 1.1 `ZCPClient` Wrapper (`zeroops-engine/src/server/zcp-client.js` & `zeroops-engine/src/zcp/zcp-client.ts`)
* **File**: `zeroops-engine/src/server/zcp-client.js`
  * **Line 10**: `constructor(apiToken = process.env.ZEROPS_TOKEN) { this.apiToken = apiToken; }`
  * **Lines 27–39**: `provisionProject(projectName, zeropsYmlContent, onLogStream)` defines a hardcoded static YAML string (`importSpecYaml`) containing 5 static services (`webapp`, `apigateway`, `aiworker`, `dbpostgres`, `cachevalkey`). It completely ignores the `zeropsYmlContent` argument passed into the function.
  * **Lines 44–46**:
    ```javascript
    const zcliProc = spawn('zcli', ['project', 'project-import', '-'], {
      env: { ...process.env }
    });
    ```
    `this.apiToken` is stored in the class instance when `new ZCPClient(token)` is instantiated by `src/server/index.js` (line 185). However, when `zcli` is spawned, `ZEROPS_TOKEN` in `env` is derived exclusively from `process.env`. If `process.env.ZEROPS_TOKEN` is not set on the host OS, `this.apiToken` (the user's PAT token from session) is **NOT** passed to the spawned `zcli` sub-process.
* **File**: `zeroops-engine/src/zcp/zcp-client.ts`
  * **Lines 69–89**: Constructor initializes `this.apiToken = config.apiToken || process.env.ZEROPS_TOKEN || null;`. If `mode === 'real'` but no `apiToken` is available, it logs a warning and auto-falls back to `'mock'` mode.
  * **Lines 320–349**: In `importProjectReal`, makes a REST request to `${this.apiBaseUrl}/project/import` with header `Authorization: Bearer ${this.apiToken}`.

### 1.2 Private Network Env Synthesizer (`zeroops-engine/src/synthesizer/private-net.ts`)
* **File**: `zeroops-engine/src/synthesizer/private-net.ts`
  * **Lines 11–31**: Resolves PostgreSQL service (`s.type === 'postgresql'`), Valkey service (`s.type === 'valkey'`), and API service (`r.name === 'api' || r.name.includes('api') || r.name.includes('backend')`).
  * **Lines 32–57**: Injects the following environment variables into every runtime container in the topology spec:
    * `PORT`: Primary runtime port (e.g. `3000`, `8080`, `8000`)
    * `NODE_ENV`: `'production'`
    * `DB_HOST`: `'postgres'` (or custom postgres service name)
    * `DB_PORT`: `'5432'`
    * `DB_USER`: `'zerops'`
    * `DB_PASSWORD`: `'zerops_secure_pass_2026'`
    * `DB_NAME`: `'zeroops_db'`
    * `DATABASE_URL`: `'postgres://zerops:zerops_secure_pass_2026@<DB_HOST>:5432/zeroops_db'`
    * `VALKEY_HOST`: `'valkey'` (or custom valkey service name)
    * `VALKEY_PORT`: `'6379'`
    * `REDIS_URL`: `'redis://<VALKEY_HOST>:6379'`
    * `API_HOST`: `'api'` (or custom API runtime name)
    * `API_PORT`: `'8080'`
    * `API_URL`: `'http://<API_HOST>:8080'`
    * Preserves existing runtime env variables by applying `...runtime.envVariables` after defaults.
  * **Observation on matching robustness**:
    Lines 12–13 use strict type equality: `s.type === 'postgresql'` and `s.type === 'valkey'`. If a managed service spec has `type: 'postgres'` or `name: 'db-postgres'`, strict matching on `s.type === 'postgresql'` evaluates to `undefined`, defaulting `dbHost` to `'postgres'` rather than using the custom service name.

### 1.3 Test Suite Execution & Structure
* **File**: `zeroops-engine/tests/auth-onboarding.test.ts`
  * Contains 18 unit/integration tests covering `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/token`, `/api/ws-token`, and basic `ZCPClient` instantiation.
  * Execution command: `npx vitest run tests/auth-onboarding.test.ts`
  * Execution output: **18 passed (18 total)** in ~334ms.
* **Full Test Suite Execution**:
  * `npm run test:unit`: 14 test files, **143 tests passed**, 0 failed.
  * `npm run test:tier`: 38 test suites, **197 tests passed**, 0 failed.

---

## 2. Logic Chain

1. **`ZCPClient` Sub-process Environment Leak**:
   * *Observation*: `ZCPClient` constructor accepts `apiToken` (`new ZCPClient(token)`). `src/server/index.js` line 185 initializes `new ZCPClient(token)` using the PAT token supplied by the logged-in user.
   * *Reasoning*: When `provisionProject` executes `spawn('zcli', ['project', 'project-import', '-'], { env: { ...process.env } })`, the options object passes `process.env` without merging `this.apiToken`.
   * *Deduction*: Unless `process.env.ZEROPS_TOKEN` is exported in the parent Node process, `zcli` spawned sub-process will execute without `ZEROPS_TOKEN`. `zcli` CLI will fail authentication against Zerops cloud API.
   * *Fix Requirement*: Update `spawn` env in `src/server/zcp-client.js` to `{ ...process.env, ...(this.apiToken ? { ZEROPS_TOKEN: this.apiToken } : {}) }`.

2. **`provisionProject` Spec Bypass**:
   * *Observation*: `ZCPClient.provisionProject(projectName, zeropsYmlContent, onLogStream)` receives `zeropsYmlContent`.
   * *Reasoning*: Lines 27–39 assemble a fixed static YAML string (`importSpecYaml`) and pipe it to `zcliProc.stdin`.
   * *Deduction*: Any prompt or template that generates custom service definitions (e.g. Node.js + Rust + Postgres) gets overridden by the hardcoded 5-service spec.
   * *Fix Requirement*: Check if `zeropsYmlContent` is provided; if present, pipe `zeropsYmlContent` to `zcliProc.stdin`, otherwise fall back to `importSpecYaml`.

3. **Managed Service Resolution in `private-net.ts`**:
   * *Observation*: `injectPrivateNetEnv` matches managed services using `s.type === 'postgresql'` and `s.type === 'valkey'`.
   * *Reasoning*: If input topology specs identify postgres as `type: 'postgres'` or service name `db-postgres`, matching fails.
   * *Fix Requirement*: Broaden condition to `s.type === 'postgresql' || s.type === 'postgres' || s.name.includes('postgres')` and `s.type === 'valkey' || s.type === 'redis' || s.name.includes('valkey') || s.name.includes('redis')`.

4. **Test Suite Coverage Completeness**:
   * *Observation*: `auth-onboarding.test.ts` passes 18 tests, but does not verify:
     a) That `ZCPClient` passes `ZEROPS_TOKEN` into `zcli` sub-process environment options.
     b) That `provisionProject` respects `zeropsYmlContent` argument when provided.
     c) That PAT token updates via `POST /api/auth/token` persist across multiple session updates.
   * *Fix Requirement*: Extend `tests/auth-onboarding.test.ts` with explicit test cases verifying token sub-process injection, `zeropsYmlContent` pass-through, and session token persistence.

---

## 3. Caveats

1. **Read-Only Scope**: This report is produced under read-only investigation constraints. Source code files in `zeroops-engine/src` were inspected and verified, but no code edits were applied.
2. **`zcli` Binary Availability**: Unit tests mock or spawn `zcli`. If `zcli` is not installed on the system, `zcliProc.on('error')` catches the spawn error and returns status `'error'`, which is handled gracefully by `ZCPClient`.
3. **Dual Client Architecture**: Note that two ZCP client classes exist in the repository: CJS `ZCPClient` in `src/server/zcp-client.js` (used by Express server) and TS `ZcpClient` in `src/zcp/zcp-client.ts` (used by Studio server / exports). Proposed fixes target both for complete consistency.

---

## 4. Conclusion & Proposed Fix Specifications

### Fix Spec 1: Update `zeroops-engine/src/server/zcp-client.js`
1. **Pass `ZEROPS_TOKEN` to spawned `zcli` process**:
   ```javascript
   // Target line 44-46 in src/server/zcp-client.js
   const zcliProc = spawn('zcli', ['project', 'project-import', '-'], {
     env: {
       ...process.env,
       ...(this.apiToken ? { ZEROPS_TOKEN: this.apiToken } : {})
     }
   });
   ```
2. **Respect `zeropsYmlContent` parameter when provided**:
   ```javascript
   // Target lines 27-48 in src/server/zcp-client.js
   const payloadYaml = zeropsYmlContent || importSpecYaml;
   zcliProc.stdin.write(payloadYaml);
   ```

### Fix Spec 2: Harden `zeroops-engine/src/synthesizer/private-net.ts`
Broaden managed service lookup to handle name and type variations:
```typescript
// Target lines 12-13 in src/synthesizer/private-net.ts
const postgresService = spec.managedServices.find(
  s => s.type === 'postgresql' || s.type === ('postgres' as any) || s.name.includes('postgres')
);
const valkeyService = spec.managedServices.find(
  s => s.type === 'valkey' || s.type === ('redis' as any) || s.name.includes('valkey') || s.name.includes('redis')
);
```

### Fix Spec 3: Add New Unit Tests to `zeroops-engine/tests/auth-onboarding.test.ts`
Add tests for:
1. `ZCPClient` passing `this.apiToken` to child process environment options.
2. `ZCPClient.provisionProject()` sending `zeropsYmlContent` to stdin when provided.
3. Updating PAT token via `POST /api/auth/token` and verifying session persistence.

---

## 5. Verification Method

To independently verify these findings and subsequent implementation:

1. **Run Auth & Onboarding Test Suite**:
   ```bash
   cd zeroops-engine
   npx vitest run tests/auth-onboarding.test.ts
   ```
   *Expected*: All tests pass (18 existing + new unit tests).

2. **Run Full Engine Unit & Tier Test Suites**:
   ```bash
   cd zeroops-engine
   npm run test:all
   ```
   *Expected*: 100% pass rate across unit tests (`vitest run`) and tier tests (`tsx --test`).

3. **Invalidation Conditions**:
   * If `ZEROPS_TOKEN` is missing from `zcliProc.spawn` environment options when `new ZCPClient(token)` is instantiated with a user PAT token.
   * If `zeropsYmlContent` is ignored during `provisionProject` calls.
   * If `npx vitest run tests/auth-onboarding.test.ts` fails or hangs.
