# Test Infrastructure & Coverage Analysis Report

**Target Project**: ZeroOps Studio Multi-Tenant Cloud Engine (`zeroops-engine`)  
**Investigator**: teamwork_preview_explorer  
**Date**: 2026-08-08  

---

## 1. Executive Summary

This investigation analyzed the test infrastructure, build system, TypeScript configuration, test execution scripts, and test suite coverage for the ZeroOps Studio Multi-Tenant Cloud Engine across `zeroops-engine`.

Key findings include:
1. **Dual Test Runner Split**: The repository relies on two distinct test runners: **Vitest (v4.1.10)** for unit/integration tests (9 test files, 72 tests) and **Node.js Native Test Runner (`node:test`) + `tsx`** for a 4-tier E2E feature coverage suite (4 test files, 197 test cases + 6 harness tests).
2. **`npm test` Execution Mismatch**: Running `npm test` executes `npx vitest run`. However, `vitest.config.ts` explicitly excludes `tests/tier*.test.ts`. As a result, `npm test` executes only **72 tests**, skipping **197 Tier tests**.
3. **`TEST_READY.md` Documentation Inaccuracy**: `TEST_READY.md` states that `npm test` executes 203 tests. In reality, `npm test` executes 72 tests, while `npx tsx --test tests/harness.test.ts tests/tier*.test.ts` executes 203 tests. Across both runners, the codebase contains **269 total test cases**.
4. **Coverage Gaps for Updated Requirements**: While original R1–R4 features (YAML generation, AST zero-stub validation, WebSocket log streaming, live health check mocks) have extensive test coverage, the updated requirements (Session Auth & BYO Zerops Token Onboarding, 3 Pre-Built Stacks: AI Video Clipper, E-Commerce, RAG Search Engine, and Workbench Studio Split-Pane UI) lack explicit unit and integration test suites.

---

## 2. Test Infrastructure & Build System Breakdown

### 2.1 File Map & Role Matrix

| Component | Path | Description |
|---|---|---|
| Package Manifest | `zeroops-engine/package.json` | Specifies scripts (`start`, `dev`, `verify`, `build`, `test`) and dependencies (`express`, `ws`, `js-yaml`, `vitest`, `typescript`). |
| TS Compiler Config | `zeroops-engine/tsconfig.json` | Configures `ES2022`/`NodeNext`, output dir `./dist`, root dir `./src`, excludes `tests/**/*`. |
| Vitest Config | `zeroops-engine/vitest.config.ts` | Configures Node environment, v8 coverage, includes `tests/**/*.test.ts`, excludes `tests/tier*.test.ts`. |
| Test Harness | `zeroops-engine/tests/harness.ts` | Dynamic adapter supporting both `vitest` and `node:test`/`node:assert` assertion matchers, mock drivers (`MockZcpApiClient`, `MockStackSynthesizer`, `MockCodeSynthesizer`, `MockWebStudioServer`, `MockVerificationSuite`). |
| Documentation | `TEST_INFRA.md`, `TEST_READY.md` | Documents opaque-box test strategy, 17-feature breakdown, 4 tiers, and claims test execution readiness. |

### 2.2 Package Scripts Analysis (`package.json`)

```json
"scripts": {
  "start": "node src/server/index.js",
  "dev": "node --watch src/server/index.js",
  "verify": "node src/server/health-checker.js",
  "build": "npx tsc",
  "test": "npx vitest run"
}
```

- `npm run build`: Executes `npx tsc` compiling `./src` to `./dist`. Note: `tests/**/*` is excluded from compilation in `tsconfig.json`.
- `npm test`: Executes `npx vitest run`.

---

## 3. Test Execution Verification & Discovery

### 3.1 Vitest Unit/Integration Suite (`npm test`)

Running `npm test` inside `zeroops-engine` results in:

```
 RUN  v4.1.10 /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine

 ✓ tests/synthesizer.test.ts (4 tests)
 ✓ tests/harness.test.ts (6 tests)
 ✓ tests/private-net.test.ts (2 tests)
 ✓ tests/yaml-generator.test.ts (3 tests)
 ✓ tests/zcp-client.test.ts (6 tests)
 ✓ tests/cli.test.ts (3 tests)
 ✓ tests/code-gen.test.ts (23 tests)
 ✓ tests/m3_challenger_stress.test.ts (10 tests)
 ✓ tests/studio.test.ts (15 tests)

 Test Files  9 passed (9)
      Tests  72 passed (72)
   Duration  1.49s
```

### 3.2 Tiered E2E Suite (`npx tsx --test tests/tier*.test.ts`)

Running Node native test runner via `npx tsx --test tests/harness.test.ts tests/tier*.test.ts` results in:

```
▶ Tier 1 Feature Coverage (85 tests) — PASSED
▶ Tier 2 Boundary & Corner Case Tests (85 tests) — PASSED
▶ Tier 3 Cross-Feature Pairwise Interaction Tests (17 tests) — PASSED
▶ Tier 4 Real-World Application Scenario Tests (10 tests) — PASSED

ℹ tests 197 (plus 6 in harness.test.ts = 203 tests)
ℹ suites 38
ℹ pass 197
ℹ duration_ms 533.17ms
```

### 3.3 Root Cause of Discrepancy

In `zeroops-engine/vitest.config.ts`:
```ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/tier*.test.ts', 'node_modules', 'dist'], // <-- Excludes tier tests!
  },
});
```

Because `vitest.config.ts` excludes `tests/tier*.test.ts`, running `npm test` omits 197 test cases. `TEST_READY.md` incorrectly claimed that `npm test` ran all 203 tests.

---

## 4. Test Coverage Mapping for R1..R4 Features

### 4.1 Requirement Mapping Table

| Requirement Group | Feature | Existing Test Location | Existing Test Count | Test Status |
|---|---|---|:---:|:---:|
| **Original R1** | ZCP Orchestration, zerops.yml, 3+ runtimes, 2 DBs, Private Net IP Injection | `tests/synthesizer.test.ts`<br>`tests/private-net.test.ts`<br>`tests/yaml-generator.test.ts`<br>`tests/zcp-client.test.ts`<br>Tier 1–4 (F1–F5) | 4 + 2 + 3 + 6 + 25 = **40 tests** | **PASSED** |
| **Updated R1** | Minimal Session Auth (email/pass) & BYO Zerops Token Onboarding | `tests/zcp-client.test.ts` (token fallback only) | 1 test (partial) | ⚠️ **GAP** |
| **Original R2** | Full-Stack Code & Schema Synthesizer, AST Zero-Stub Validator | `tests/code-gen.test.ts`<br>Tier 1–4 (F6–F7) | 23 + 10 = **33 tests** | **PASSED** |
| **Updated R2** | 3 Pre-Built Templates (AI Video Clipper, E-Commerce, RAG Search Engine with pgvector/Whisper) | `tests/code-gen.test.ts` (generic synthesis only) | 0 explicit template tests | ⚠️ **GAP** |
| **Original R3** | Dark-Mode Web Studio, 3D/2D Topology Canvas, WebSocket Log Streaming, Zero-Downtime Trigger | `tests/studio.test.ts`<br>`tests/m3_challenger_stress.test.ts`<br>Tier 1–4 (F8–F11) | 15 + 10 + 20 = **45 tests** | **PASSED** |
| **Updated R3** | Workbench Studio Split-Pane UI (left feed, right tabbed Terminal/zerops.yml/Code Inspector) | `tests/studio.test.ts` (backend WS only) | 0 UI integration tests | ⚠️ **GAP** |
| **Original & Updated R4** | Automated Live Verification & Health Audit Suite (HTTP 200, Private DB/Cache, Queue E2E) | `tests/harness.test.ts`<br>`tests/cli.test.ts`<br>Tier 1–4 (F12–F15) | 6 + 3 + 20 = **29 tests** | **PASSED** |

---

## 5. Detailed Test Coverage Gaps

1. **Gap 1: Session Auth & Token Onboarding Tests (Updated R1)**
   - No tests exist for session authentication endpoints (`/api/auth/signup`, `/api/auth/login`, session cookie verification).
   - No tests for storing Personal Access Tokens per user session and passing them to `zcli project project-import`.

2. **Gap 2: Pre-Built Stack Templates Verification (Updated R2)**
   - No test suite verifies the 3 specific pre-built stack templates:
     1. AI Video Clipper (Next.js + Go REST + Python Whisper + PostgreSQL + Valkey)
     2. Multi-Service E-Commerce (Bun + Go Order + Python Rec + PostgreSQL + Valkey)
     3. RAG Search Engine (React + FastAPI + Python Embedder + PostgreSQL pgvector + Valkey)
   - Need explicit assertions verifying `pgvector` schema extension generation and Whisper/Rec worker configuration.

3. **Gap 3: Workbench Studio UI Integration (Updated R3)**
   - Existing studio tests verify WebSocket server message broadcasting and node state updates, but lack component/frontend integration tests for split-pane UI, tabbed terminal views, and code inspector rendering.

4. **Gap 4: Dual Runner Test Script Fragmentation**
   - Developers or CI pipelines running `npm test` only run 72 out of 269 tests.
   - The 197 Tier tests are executed only if `npx tsx --test tests/tier*.test.ts` is explicitly called.

---

## 6. Infrastructure Recommendations

1. **Unify `package.json` Test Scripts**:
   Update `zeroops-engine/package.json` scripts to run both test suites in `npm test`:
   ```json
   "scripts": {
     "start": "node src/server/index.js",
     "dev": "node --watch src/server/index.js",
     "verify": "node src/server/health-checker.js",
     "build": "npx tsc",
     "test": "npx vitest run && npx tsx --test tests/tier*.test.ts",
     "test:unit": "npx vitest run",
     "test:tier": "npx tsx --test tests/tier*.test.ts",
     "test:all": "npx vitest run && npx tsx --test tests/tier*.test.ts"
   }
   ```

2. **Add Dedicated Test Suites for Updated Requirements**:
   - `tests/auth-onboarding.test.ts`: Test session login, token receipt, and zcli client configuration per session.
   - `tests/template-library.test.ts`: Verify hydration and zero-stub compliance for AI Video Clipper, E-Commerce, and RAG Search Engine templates.
   - `tests/workbench-ui.test.ts`: Test Studio API endpoints for template selection and split-pane view state updates.

3. **Update Documentation**:
   - Correct `TEST_READY.md` to accurately state that full test execution requires running both Vitest and Node native test runner (or `npm test` with updated scripts), covering 269 total test cases.
