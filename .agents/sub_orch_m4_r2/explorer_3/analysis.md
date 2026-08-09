# Milestone M4: Test Suite Architecture & Verification Gap Analysis

**Author**: Explorer 3  
**Target Component**: ZeroOps Web Studio UI, `zcli` Log Streamer & Test Suites  
**Repository Path**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`  
**Date**: 2026-08-09  

---

## 1. Executive Summary

An in-depth analysis of the test suite architecture for **Milestone M4: Real-Time zcli Log Streaming & Workbench Studio UI** was conducted across the `zeroops-engine` repository.

### Key Test Execution Metrics
- **Targeted Test Execution**: `npx vitest run tests/workbench-ui.test.ts tests/studio.test.ts`
  - **Result**: **PASS** (2 files passed, 32 total tests passed, 0 failures).
- **Full Repository Suite**: `npx vitest run`
  - **Result**: **PASS** (17 files passed, 209 total tests passed, 0 failures).

### Core Finding
While all 32 existing tests in `tests/workbench-ui.test.ts` (17 tests) and `tests/studio.test.ts` (15 tests) pass cleanly, **there is a 100% gap in DOM/UI-level testing**. The current test suites execute in Vitest's `node` environment, testing HTTP endpoints, WebSocket server protocol frames, and `WsLogger` ANSI string utilities. Neither `public/studio.html` nor `public/studio.js` (nor `src/studio/public/index.html` / `app.js`) is ever loaded into a simulated DOM environment (`jsdom` / `happy-dom`) during testing.

As a result, critical UI interactions—such as split-pane layout rendering, tab switching, form submission, topology chip status badge transitions (`BUILDING` → `HEALTHY`), log auto-scroll, keyboard shortcuts (`Ctrl+Enter`), and Code Inspector file tree navigation clicks—have **zero automated UI assertion coverage**.

---

## 2. Examination of Existing Test Suites

### 2.1 `tests/workbench-ui.test.ts` (17 Tests)
Located at: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/tests/workbench-ui.test.ts`

| Test Category | Description | Lines | Status | Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **REST API Contracts** | Tests `/api/health`, `/api/status`, `/api/topology`, `/api/synthesize` (400 validation & 200 payload), `/api/deploy`, `/studio` static route fallback | L25–L102 | PASS | Server REST endpoints only |
| **WebSocket Log Streamer** | Tests WS `/ws/logs` connection welcome message, `ping`/`pong`, `getHistory`, `subscribe` service filtering, raw non-JSON frame handling, `topology-update` broadcast, `complete` frame broadcast | L104–L251 | PASS | Server WS protocol & broadcasting |
| **WsLogger Unit Utilities** | Tests `sanitizeMessage` (stripping ASCII control chars 0x00-0x1F), `formatAnsi` (timestamp & service badge coloring), and ring buffer maximum bounds (e.g. maxBufferLength=5) | L253–L286 | PASS | Pure JS utility logic |

### 2.2 `tests/studio.test.ts` (15 Tests)
Located at: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/tests/studio.test.ts`

| Test Category | Description | Lines | Status | Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **REST API Endpoints** | Tests `/api/health`, `/api/status`, `/api/synthesize` (success & empty prompt 400), `/api/deploy` | L29–L95 | PASS | Server REST endpoints |
| **Static SPA File Serving** | Tests HTTP GET `/index.html`, `/style.css`, `/topology-canvas.js`, `/app.js` return 200 OK and expected substring markers | L97–L126 | PASS | Static asset HTTP delivery |
| **WebSocket Streamer** | Tests WS `/ws/logs` initial connection and `deploy` action pipeline log & topology streaming | L128–L183 | PASS | WS integration pipeline |
| **WsLogger Unit Suite** | Tests control character sanitization, ANSI formatting with service tags, ring buffer length (max 10), and `getLogs(service)` filtering | L185–L227 | PASS | Pure JS utility logic |

---

## 3. Test Setup & Environment Architecture Analysis

### 3.1 Vitest Configuration (`vitest.config.ts`)
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // <--- Node environment default
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/tier*.test.ts', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```
- **Environment**: Default environment is set to `'node'`. Standard browser APIs (`window`, `document`, `HTMLElement`, `CustomEvent`, `sessionStorage`, `WebSocket` in browser) are undefined unless mocked.
- **Dependencies**: `package.json` contains `vitest` (v4.1.10) but does NOT include `jsdom` or `happy-dom` in `devDependencies`.

### 3.2 Implication for Milestone M4 Scope
Milestone M4 explicitly requires verification of the front-end user experience:
1. Bolt.new-inspired split-pane UI layout in `public/studio.html` & `public/studio.js`.
2. Persistent bottom topology strip (`.topo-strip`) status badge transitions (`BUILDING` → `DEPLOYING` → `HEALTHY` / `FAILED`).
3. Real-time `zcli` log streaming rendering (ANSI output & pipeline step advancement).
4. Code Inspector file tree navigation & code preview pane.

Because all existing tests run against Node HTTP/WS servers without mounting HTML into a DOM runner, **none of these 4 client-side features are currently asserted in automated tests**.

---

## 4. Verification Gap Analysis by Feature Area

### Feature 1: Bolt.new-Inspired Split-Pane UI Layout
- **Implementation**: `public/studio.html` (L92–L259) defines a two-column flex layout (`.main-layout`):
  - **Left Panel (`.panel-left`)**: Scrollable feed (`.panel-left__scroll`) containing `#chat-welcome` (welcome hero + template grid), `#pipeline-feed` (steps 01-04 + success card), and bottom-pinned `#prompt-bar` (`#prompt-form`, `#prompt-input`, `#deploy-btn`).
  - **Right Panel (`.panel-right`)**: Tabbed Workbench containing `.wb-tabs` (`wb-terminal`, `wb-yaml`, `wb-code`), `.wb-pane` elements (`#wb-terminal`, `#wb-yaml`, `#wb-code`), and persistent `.topo-strip`.
- **Gap**:
  - No test mounts `public/studio.html` to verify element presence (`#chat-welcome`, `#pipeline-feed`, `#prompt-bar`, `#wb-terminal`, `#wb-yaml`, `#wb-code`).
  - No test verifies initial view state (`#chat-welcome` visible, `#pipeline-feed` hidden).
  - No test verifies view switching when a prompt is submitted (`#chat-welcome` becomes `.hidden`, `#pipeline-feed` removes `.hidden`).

### Feature 2: Persistent Bottom Topology Strip & Status Transitions
- **Implementation**:
  - `public/studio.html` (L225–L257): `.topo-strip` contains 5 container node chips (`#node-web-frontend`, `#node-api-gateway`, `#node-ai-worker`, `#node-db-postgres`, `#node-cache-valkey`).
  - `public/studio.js` (L150–L157): On `topology-update` WS frame, updates element className to `topo-chip ${data.status}`.
  - `src/studio/public/index.html` & `app.js` (L129–L132): Canvas topology canvas updates status via `topologyCanvas.updateNodeStatus(msg.serviceId, msg.status, msg.privateIp)`.
- **Gap**:
  - No test verifies DOM element class changes on status updates (e.g. `topo-chip building` → `topo-chip healthy`).
  - No test verifies that all 5 required container types (`web-frontend`/`webapp`, `api-gateway`/`apigateway`, `ai-worker`/`aiworker`, `db-postgres`/`postgres`, `cache-valkey`/`valkey`) are updated when `runDeploymentPipeline` runs.
  - No test verifies private IP string rendering (`topo-chip__ip`).

### Feature 3: Real-Time `zcli` WebSocket Log Streaming & ANSI Assertions
- **Implementation**:
  - `src/studio/ws-logger.ts` (L125–L143): `formatAnsi` wraps timestamps in `\x1b[90m`, service names in service-specific colors (`\x1b[36m` cyan for API, `\x1b[34m` blue for frontend, `\x1b[35m` magenta for worker, `\x1b[33m` yellow for DB, `\x1b[31m` red for cache), and stream badges (`\x1b[32m[stdout]\x1b[0m`, `\x1b[31m[stderr]\x1b[0m`, `\x1b[33m[system]\x1b[0m`).
  - `public/studio.js` (L131–L149): Appends log line to `terminal.textContent` and inspects line keywords (`synthesiz`, `subnet`, `lxd`, `health`) to advance pipeline steps (`#feed-step-synth`, `#feed-step-net`, `#feed-step-lxd`, `#feed-step-health`) state (`active` / `done`).
- **Gap**:
  - While `formatAnsi` is unit-tested in `tests/workbench-ui.test.ts` (L261–L272) for general output, there are **no assertions checking stderr vs stdout color codes** (e.g. `\x1b[31m[stderr]\x1b[0m`).
  - No test asserts client-side auto-advancement of pipeline step statuses (`#feed-step-synth` → `active` → `done`) triggered by log text parsing.

### Feature 4: Code Inspector File Tree Navigation & Preview Pane
- **Implementation**:
  - `public/studio.js` (L252–L267): `renderCodeFiles` populates `#code-tree` with filename headers and pre blocks.
  - `src/studio/public/app.js` (L298–L337): `renderFileTree` populates `#file-tree-list` with `<li>` elements, handles click event to activate file, and calls `showCodeFile(filePath, content)` updating `#selected-file-path` and `#code-viewer`.
- **Gap**:
  - No test verifies file tree HTML structure generation when `codeFiles` dictionary is passed from `/api/synthesize`.
  - No test simulates DOM `click` events on file tree list items to verify `#selected-file-path` header and `#code-viewer` content updates.
  - No test checks empty state rendering (`No files synthesized`).

### Feature 5: UI Form & Event Handling
- **Implementation**:
  - `public/studio.js` (L106–L111): `Ctrl+Enter` / `Cmd+Enter` keyboard shortcut listener on `promptInput`.
  - `public/studio.js` (L114–L121): Workbench tab buttons `.wb-tab` click listener toggles `.active` class.
  - `public/studio.js` (L175–L241): Form submit listener disables `#deploy-btn`, changes text to 'Deploying…', and sends WS message.
  - `public/studio.html` (L58–L68) & `studio.js` (L270–L313): Token onboarding overlay modal (`#onboarding`) and `saveToken()` validation.
- **Gap**:
  - Keyboard shortcut (`Ctrl+Enter`) handling is untested.
  - Tab button click switching is untested.
  - Token onboarding modal display, validation error display (`#token-error`), and `sessionStorage` token saving are untested.

---

## 5. Summary Matrix of Required vs Existing Assertions

| Scope Area | Required Feature | Existing Backend/Server Test | Existing DOM/UI Test | Gap Severity |
| :--- | :--- | :---: | :---: | :---: |
| **Split-Pane UI** | Left chat/feed & right Workbench panes | ❌ None | ❌ None | **HIGH** |
| **Split-Pane UI** | Pinned `#prompt-bar` & `#deploy-btn` state | ❌ None | ❌ None | **HIGH** |
| **Workbench Tabs**| Tab button click switching (`wb-terminal`, `wb-yaml`, `wb-code`) | ❌ None | ❌ None | **HIGH** |
| **Topology Strip**| 5 container chips (`webapp`, `apigateway`, `aiworker`, `postgres`, `valkey`) | ❌ None | ❌ None | **HIGH** |
| **Topology Strip**| Badge status transitions (`BUILDING` → `HEALTHY`) | ✅ WS broadcast test | ❌ No DOM test | **MEDIUM** |
| **Log Streamer**  | `WsLogger` ANSI color formatting & sanitization | ✅ Unit tests pass | ❌ No UI test | **LOW** |
| **Log Streamer**  | `stderr` vs `stdout` stream color assertions | ❌ Incomplete unit | ❌ No UI test | **MEDIUM** |
| **Log Streamer**  | Client pipeline step status auto-advancement | ❌ None | ❌ None | **HIGH** |
| **Code Inspector**| Synthesized multi-service file tree rendering | ✅ API returns files | ❌ No DOM test | **HIGH** |
| **Code Inspector**| File selection click & code preview update | ❌ None | ❌ None | **HIGH** |
| **Auth/Onboarding**| Token onboarding overlay show/hide & validation | ❌ None | ❌ None | **MEDIUM** |

---

## 6. Recommendations for 100% Verification

To achieve 100% verification and close all identified gaps, the implementation worker should create a dedicated DOM/UI Vitest suite (e.g. `tests/workbench-ui-dom.test.ts`) using a lightweight DOM simulation (JSDOM / Happy-DOM or Node DOM environment) to test `public/studio.html` and `public/studio.js`.

### Recommended Test Cases to Add

1. **Split-Pane DOM Layout & Visibility Test**:
   - Parse `public/studio.html` into DOM environment.
   - Assert `#chat-welcome`, `#pipeline-feed`, `#prompt-bar`, `.wb-tabs`, `#wb-terminal`, `#wb-yaml`, `#wb-code`, and `.topo-strip` exist.
   - Assert `#chat-welcome` is initially visible and `#pipeline-feed` has `.hidden` class.

2. **Workbench Tab Switching UI Event Test**:
   - Simulate `click` event on `.wb-tab[data-tab="wb-yaml"]`.
   - Assert `wb-yaml` tab and `#wb-yaml` pane receive `.active` class while `wb-terminal` loses `.active`.

3. **Topology Strip Node Status Transition Test**:
   - Verify all 5 container node chips (`#node-web-frontend`, `#node-api-gateway`, `#node-ai-worker`, `#node-db-postgres`, `#node-cache-valkey`) exist.
   - Simulate incoming `topology-update` message (`serviceId: 'api-gateway'`, `status: 'BUILDING'`).
   - Assert `#node-api-gateway` className updates to `'topo-chip BUILDING'`.
   - Simulate status update to `'HEALTHY'`.
   - Assert className updates to `'topo-chip HEALTHY'`.

4. **`zcli` Log Streamer ANSI & Stream Distinction Test**:
   - Assert `WsLogger.formatAnsi` includes `\x1b[31m[stderr]\x1b[0m` for `stderr` streams and `\x1b[32m[stdout]\x1b[0m` for `stdout` streams.
   - Simulate WebSocket log messages containing keywords (`synthesize`, `network`, `lxd`, `health`) and assert `#feed-step-synth`, `#feed-step-net`, etc. receive `active` and `done` classes.

5. **Code Inspector File Tree Navigation & Preview Test**:
   - Execute `renderCodeFiles({ 'webapp/package.json': '{ "name": "web" }', 'apigateway/main.go': 'package main' })`.
   - Assert `#code-tree` or `#file-tree-list` renders 2 file items.
   - Simulate `click` event on `'apigateway/main.go'`.
   - Assert `#selected-file-path` header displays `'apigateway/main.go'` and preview pane displays `'package main'`.

6. **Prompt Bar Form Submission & Shortcut Test**:
   - Dispatch `keydown` with `ctrlKey: true, key: 'Enter'` on `#prompt-input`.
   - Assert `#prompt-form` submit handler is triggered, view switches from welcome to pipeline feed, `#deploy-btn` is disabled with text `'Deploying…'`, and nodes are set to `'building'`.

---

## 7. Conclusion

The server-side REST API and WebSocket logging backend of ZeroOps Studio are solid and achieve a 100% pass rate across all 32 targeted unit tests. However, to fulfill Milestone M4's goal of verifying and hardening the Workbench Studio UI, client-side DOM assertions must be introduced for split-pane layout, topology strip status transitions, pipeline feed step advancement, and Code Inspector file tree navigation.
