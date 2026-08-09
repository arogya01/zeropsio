# Handoff Report: Test Suite Unification & Coverage Setup Analysis (Milestone M1)

## 1. Observation

### Codebase & Config State (`zeroops-engine/`)
- **`package.json` (`/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/package.json`)**:
  - Lines 6–12 currently define:
    ```json
    "scripts": {
      "start": "node src/server/index.js",
      "dev": "node --watch src/server/index.js",
      "verify": "node src/server/health-checker.js",
      "build": "npx tsc",
      "test": "npx vitest run"
    }
    ```
  - Lines 33–40 (`devDependencies`):
    ```json
    "devDependencies": {
      "@types/cors": "2.8.19",
      "@types/express": "5.0.6",
      "@types/node": "26.2.0",
      "@types/ws": "8.18.1",
      "typescript": "5.9.3",
      "vitest": "4.1.10"
    }
    ```
  - `tsx` runner is currently missing from `devDependencies` in `package.json`.

- **`vitest.config.ts` (`/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/vitest.config.ts`)**:
  - Lines 1–15:
    ```typescript
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
        exclude: ['tests/tier*.test.ts', 'node_modules', 'dist'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
        },
      },
    });
    ```
  - Excludes `tests/tier*.test.ts` from Vitest, so Vitest only runs unit and integration test files.

- **Test Files Breakdown (`zeroops-engine/tests/`)**:
  - **Vitest Suite (9 files, 72 tests)**:
    - `tests/cli.test.ts` (3 tests)
    - `tests/code-gen.test.ts` (23 tests)
    - `tests/harness.test.ts` (6 tests)
    - `tests/m3_challenger_stress.test.ts` (10 tests)
    - `tests/private-net.test.ts` (2 tests)
    - `tests/studio.test.ts` (15 tests)
    - `tests/synthesizer.test.ts` (4 tests)
    - `tests/yaml-generator.test.ts` (3 tests)
    - `tests/zcp-client.test.ts` (6 tests)
  - **Node Native Test Runner Suite (4 files, 197 tests)**:
    - `tests/tier1_feature_coverage.test.ts` (85 tests)
    - `tests/tier2_boundary_edge.test.ts` (85 tests)
    - `tests/tier3_pairwise.test.ts` (17 tests)
    - `tests/tier4_scenarios.test.ts` (10 tests)

- **Test Execution Findings**:
  - `npx vitest run` output:
    - 9 passed test files, 72 passed test cases (Duration: ~1.5s).
    - Outputs Vite warning: `(!) Your Vite config uses features that are unsupported by configLoader: 'native'`.
  - `npx tsx --test tests/tier*.test.ts` output:
    - 4 test files passed, 197 passed test cases (Duration: ~0.26s).
  - Combined `npx vitest run && npx tsx --test tests/tier*.test.ts` output:
    - 269 passed test cases in 2.8s, zero hangs, zero unhandled rejections.
  - Setting `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` when running Vitest suppresses the Vite config warning cleanly.

---

## 2. Logic Chain

1. **Current Gap**: Running `npm test` currently calls `npx vitest run`, which skips all 197 Node native tier tests (`tier1_feature_coverage.test.ts` through `tier4_scenarios.test.ts`).
2. **Framework Separation**: Vitest is configured to run `tests/**/*.test.ts` excluding `tests/tier*.test.ts`. This design is correct because tier tests use Node native imports (`node:test`, `node:assert`).
3. **Dependency Requirement**: `tsx` is required to run `node:test` TypeScript files (`tsx --test tests/tier*.test.ts`). Although `tsx` v4.23.11 is present in the local system environment, it is absent from `package.json` `devDependencies`. Adding `"tsx": "^4.19.2"` (or `"tsx": "4.23.11"`) to `devDependencies` guarantees reproducibility across all environments.
4. **Script Target Mapping**:
   - `test:unit`: `"VITE_CONFIG_NATIVE_IGNORE_WARNING=true vitest run"` (or `"vitest run"`)
   - `test:tier`: `"tsx --test tests/tier*.test.ts"`
   - `test:all`: `"npm run test:unit && npm run test:tier"`
   - `test`: `"npm run test:all"`
5. **Future M1 Expansion**: When Worker adds the three required test files (`tests/auth-onboarding.test.ts`, `tests/template-library.test.ts`, `tests/workbench-ui.test.ts`), `vitest` will automatically discover and run them during `npm run test:unit` / `npm test` because they match `tests/**/*.test.ts` and are not excluded by `tests/tier*.test.ts`.

---

## 3. Caveats

- **Vite Warning**: In Vite 6+, CommonJS projects loading TypeScript config files trigger a warning unless `"type": "module"` is set or `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` is exported. Setting `"type": "module"` in `package.json` could affect `src/server/index.js` which uses `require(...)`. Therefore, suppressing the warning via `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` in `test:unit` or renaming `vitest.config.ts` to `vitest.config.mts` is the cleanest approach.
- **Async Teardown**: Server integration tests (`tests/studio.test.ts`) properly close HTTP/WebSocket server handles in `afterAll()`, so tests complete deterministically without process hangs.

---

## 4. Conclusion

The test infrastructure in `zeroops-engine/` is fully operational with 269 existing tests passing across two runners (Vitest: 72, Node test runner: 197). 

To complete Task 1 of Milestone M1, the following changes are recommended for implementation by Worker:

### Implementation Plan for Worker:
1. **Update `zeroops-engine/package.json`**:
   - Add `"tsx": "^4.19.2"` (or `4.23.11`) to `devDependencies`.
   - Update `scripts` section:
     ```json
     "scripts": {
       "start": "node src/server/index.js",
       "dev": "node --watch src/server/index.js",
       "verify": "node src/server/health-checker.js",
       "build": "npx tsc",
       "test": "npm run test:all",
       "test:unit": "VITE_CONFIG_NATIVE_IGNORE_WARNING=true vitest run",
       "test:tier": "tsx --test tests/tier*.test.ts",
       "test:all": "npm run test:unit && npm run test:tier"
     }
     ```
2. **New Test File Structure**:
   - Place `tests/auth-onboarding.test.ts`, `tests/template-library.test.ts`, and `tests/workbench-ui.test.ts` directly in `zeroops-engine/tests/`.
   - Write these tests using Vitest imports (`import { describe, it, expect } from 'vitest'`) so they are automatically picked up by `test:unit`.

---

## 5. Verification Method

To verify the updated setup once implemented by Worker:

1. **Verify Unit Tests**:
   ```bash
   cd zeroops-engine
   npm run test:unit
   ```
   *Expected*: 9+ Vitest test files pass with 0 failures.

2. **Verify Tier Tests**:
   ```bash
   cd zeroops-engine
   npm run test:tier
   ```
   *Expected*: 4 Node test runner tier files pass (197 tests) with 0 failures.

3. **Verify Full Unified Test Suite**:
   ```bash
   cd zeroops-engine
   npm run test:all
   # OR
   npm test
   ```
   *Expected*: Both unit and tier suites execute sequentially, passing all 269+ test cases cleanly with exit code 0.

4. **Invalidation Conditions**:
   - `npm test` failing to run tier tests or unit tests.
   - Any test process hanging after completion.
   - Non-zero exit code on missing `tsx` binary.
