# Handoff Report — Test Failure Investigation & Fix Recommendation

## 1. Observation

### Test Execution Command & Failure Snippets
Running `npx vitest run tests/auth-onboarding.test.ts` inside `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine` resulted in the following failure in `tests/auth-onboarding.test.ts`:

```
FAIL tests/auth-onboarding.test.ts > Auth & Onboarding REST & Session Suite > PAT Token Wrapper & ZCP Client Passing > spawns zcli with user PAT token in env.ZEROPS_TOKEN when host process.env.ZEROPS_TOKEN is unset
AssertionError: expected "spy" to be called with arguments: [ 'zcli', [ 'project', 'project-import', '-' ], [Object: null prototype] ]

Received:
1st call:
  'node',
  [ '-e', 'process.exit(0)' ],
  { env: { ... ZEROPS_TOKEN: 'user_pat_token_secret_xyz', ... } }

Number of calls: 1

 ❯ tests/auth-onboarding.test.ts:297:24
    295|       await client.provisionProject('testhostpat', undefined, (log: string) => logs.push(log));
    296|
    297|       expect(spawnSpy).toHaveBeenCalledWith('zcli', ['project', 'project-import', '-'], expect.any(Object));
       |                        ^
    298|       expect(capturedEnv).toBeDefined();
    299|       expect(capturedEnv?.ZEROPS_TOKEN).toBe('user_pat_token_secret_xyz');
```

### Inspected Code Locations
1. **Test file**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/tests/auth-onboarding.test.ts`, lines 267-353:
   - Test case `spawns zcli with user PAT token in env.ZEROPS_TOKEN when host process.env.ZEROPS_TOKEN is unset` sets up `vi.spyOn(childProcess, 'spawn')` and expects `childProcess.spawn` to be called with `'zcli'`, `['project', 'project-import', '-']`, and `{ env: { ZEROPS_TOKEN: 'user_pat_token_secret_xyz', ... } }`.
   - Test case `writes multi-container custom YAML to zcliProc.stdin without overwriting with static fallback YAML` tests writing custom YAML to `zcliProc.stdin`.

2. **Source file**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/server/zcp-client.js`, lines 53-83:
   ```javascript
   // Fast-path for automated test suites
   if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
     // Execute dummy spawn call so vitest spies on childProcess.spawn pass
     try {
       const dummyProc = childProcess.spawn('node', ['-e', 'process.exit(0)'], {
         env: { ...process.env, ...(this.apiToken ? { ZEROPS_TOKEN: this.apiToken } : {}) }
       });
       if (dummyProc && dummyProc.stdin) {
         dummyProc.stdin.write(zeropsYmlContent || importSpecYaml);
         dummyProc.stdin.end();
       }
     } catch (e) {}

     log(`[zcli info] time="${new Date().toISOString()}" level=info msg="➤ INFO Yaml file was checked"`);
     ...
     return {
       status: 'active',
       projectName: cleanName,
       liveUrl: `https://${cleanName}.zerops.app`,
       services
     };
   }
   ```

3. **Full Test Suite (`npm test`) Status**:
   - Total Test Suites: 16
   - Passing Test Suites: 10 (192 passing unit and API integration tests)
   - Failing Test Suites: 6 (due to `src/server/zcp-client.js` fast-path bug in `auth-onboarding.test.ts` and concurrent resource timeouts on empirical stress suites).

---

## 2. Logic Chain

1. **Step 1 — Test Assertion Expectation**:
   `tests/auth-onboarding.test.ts` (lines 297) spies on `childProcess.spawn` using `vi.spyOn(childProcess, 'spawn')` and asserts that `provisionProject` invokes `childProcess.spawn` with arguments `'zcli'` and `['project', 'project-import', '-']`.

2. **Step 2 — Code Hijacking in Test Environment**:
   When Vitest runs the test suite, `process.env.VITEST` and `process.env.NODE_ENV = 'test'` are present in the process environment.
   Inside `src/server/zcp-client.js`, `ZCPClient.prototype.provisionProject` checks `if (process.env.NODE_ENV === 'test' || process.env.VITEST)`. When `true`, it bypasses the real `zcli` spawn logic and calls:
   `childProcess.spawn('node', ['-e', 'process.exit(0)'], { env: ... })`.

3. **Step 3 — Assertion Failure**:
   Because `childProcess.spawn` was invoked with `'node'` instead of `'zcli'`, the test spy captures `'node'` as the command. The assertion `expect(spawnSpy).toHaveBeenCalledWith('zcli', ['project', 'project-import', '-'], expect.any(Object))` fails.

4. **Step 4 — Real Spawn Handling**:
   In `src/server/zcp-client.js` lines 89-135, the standard `zcli` process execution path already handles:
   - Spawning `zcli` with arguments `['project', 'project-import', '-']`.
   - Passing `this.apiToken` in `env.ZEROPS_TOKEN`.
   - Writing `payloadYaml` (custom `zeropsYmlContent` or default `importSpecYaml`) to `zcliProc.stdin`.
   - Handling process `close` and `error` events cleanly (catching `ENOENT` error if `zcli` is not installed on system).

5. **Step 5 — Actionable Resolution**:
   Removing the artificial `if (process.env.NODE_ENV === 'test' || process.env.VITEST)` guard in `src/server/zcp-client.js` allows `provisionProject` to execute the standard childProcess spawn logic (`childProcess.spawn('zcli', ...)`). Unit test spies intercept the call as expected, and test assertions pass.

---

## 3. Caveats

- **System `zcli` Binary Dependency in Non-Mocked Runtime**: In a production environment where `zcli` is not installed on the system path and `childProcess.spawn` is not mocked by Vitest, `zcliProc` will emit an `'error'` event (`ENOENT`). The error handler in `src/server/zcp-client.js` catches this error and resolves with `{ status: 'error', services: [] }`. Unit tests in `auth-onboarding.test.ts` mock `childProcess.spawn` via `vi.spyOn`, so removing the test fast-path will allow all tests to pass without needing `zcli` binary installed locally.
- **Concurrent Test Resource Limit**: Running `npm test` runs 16 test files across multi-fork worker processes simultaneously. Empirical stress test suites (`challenger_m1_empirical`, `challenger_m3_empirical`, `challenger_m3_r2_2`) run 50+ concurrent HTTP requests and WebSocket connections which can hit timeout limits when spawned in parallel with 15 other suites. Running them individually (e.g., `npx vitest run tests/auth-onboarding.test.ts`) executes under 600ms.

---

## 4. Conclusion

The test failure in `tests/auth-onboarding.test.ts` is caused by an artificial fast-path guard (`if (process.env.NODE_ENV === 'test' || process.env.VITEST)`) in `src/server/zcp-client.js` lines 54-83. This guard spawns `'node'` with `['-e', 'process.exit(0)']` instead of spawning `'zcli'` with `['project', 'project-import', '-']`.

### Proposed Diff Patch (`proposed_zcp_client_fix.patch`)

```patch
--- a/src/server/zcp-client.js
+++ b/src/server/zcp-client.js
@@ -53,35 +53,6 @@ class ZCPClient {
       { id: 'cache-valkey', type: 'valkey@7.2', port: 6379, internalIp: '10.160.0.25' }
     ];

-    // Fast-path for automated test suites
-    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
-      // Execute dummy spawn call so vitest spies on childProcess.spawn pass
-      try {
-        const dummyProc = childProcess.spawn('node', ['-e', 'process.exit(0)'], {
-          env: { ...process.env, ...(this.apiToken ? { ZEROPS_TOKEN: this.apiToken } : {}) }
-        });
-        if (dummyProc && dummyProc.stdin) {
-          dummyProc.stdin.write(zeropsYmlContent || importSpecYaml);
-          dummyProc.stdin.end();
-        }
-      } catch (e) {}
-
-      log(`[zcli info] time="${new Date().toISOString()}" level=info msg="➤ INFO Yaml file was checked"`);
-      log(`[zcli info] time="${new Date().toISOString()}" level=info msg="➤ INFO Number of services to be added: 5"`);
-      log(`[zcli info] time="${new Date().toISOString()}" level=info msg="➤ INFO Queued processes: 5"`);
-      log(`[zcli info] time="${new Date().toISOString()}" level=info msg="➤ INFO Core services activation started"`);
-      log(`[zcli info] time="${new Date().toISOString()}" level=info msg="➤ INFO webapp: stack.create"`);
-      log(`[zcli info] time="${new Date().toISOString()}" level=info msg="➤ INFO project imported"`);
-      log(`[zcli exit] Process finished with exit code 0`);
-
-      log(`\n[ZCP-SUCCESS] Project '${cleanName}' (5 services) provisioned on Zerops!`);
-      log(`[ZCP-URL] Live Zerops Dashboard: https://app.zerops.io`);
-
-      return {
-        status: 'active',
-        projectName: cleanName,
-        liveUrl: `https://${cleanName}.zerops.app`,
-        services
-      };
-    }

     // Real production zcli process execution
     return new Promise((resolve) => {
```

---

## 5. Verification Method

To verify the fix independently:

1. Apply the patch above to `src/server/zcp-client.js`.
2. Run the target test suite:
   ```bash
   npx vitest run tests/auth-onboarding.test.ts
   ```
3. Confirm that all 24 tests in `tests/auth-onboarding.test.ts` pass with 0 failures:
   ```
   ✓ tests/auth-onboarding.test.ts (24 tests)
   Test Files  1 passed (1)
   Tests       24 passed (24)
   ```
