# Deep Dive Architectural & Technical Analysis: WebSocket Log Streamer & Code Inspector UI

**Milestone**: M4 — Real-Time zcli Log Streaming & Workbench Studio UI  
**Investigator**: Explorer 2  
**Date**: 2026-08-09  
**Working Directory**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m4_r2/explorer_2`  
**Target Codebase**: `zeroops-engine` (`src/studio/ws-logger.ts`, `src/studio/server.ts`, `public/studio.html`, `public/studio.js`, `public/studio.css`)

---

## Executive Summary

A comprehensive investigation was conducted into the WebSocket real-time `zcli` log streamer (`/ws/logs`, `WsLogger`, xterm.js rendering) and the Code Inspector UI (file tree navigation & code preview pane).

While unit & server integration tests (`tests/workbench-ui.test.ts` and `tests/studio.test.ts`) currently pass 32/32 tests, our deep analysis revealed **5 major architectural bugs, missing frontend components, and integration gaps** that impact real browser usage and user experience:

1. **WebSocket Connection Endpoint Mismatch**: `public/studio.js` opens WebSocket connections to `ws://${location.host}` (root `/`) instead of `ws://${location.host}/ws/logs`, causing real browser client connections to fail upgrade against Express/WebSocket server configured on `/ws/logs`.
2. **Missing xterm.js Terminal Integration**: Although specification and backend `WsLogger` format strings with ANSI escape sequences (`\x1b[36m`, `\x1b[90m`, etc.), `public/studio.html` and `public/studio.js` do not include or initialize xterm.js. Raw ANSI escape codes are appended directly to `<pre>.textContent`, rendering unparsed escape text in the terminal pane.
3. **Topology Node CSS Class Status Mismatch**: `WsLogger` sends uppercase status strings (`BUILDING`, `HEALTHY`), but `studio.js` sets `node.className = 'topo-chip ' + data.status` without lowercasing, while `studio.css` targets `.topo-chip.building` and `.topo-chip.healthy`. Consequently, topology node indicators fail to update visually.
4. **Code Inspector Primitive Document Stacking**: `renderCodeFiles` in `studio.js` concatenates all multi-service files into a single vertical list of `<pre>` blocks instead of providing an interactive file tree sidebar with directory folding and a separate code preview viewer pane.
5. **Log History Replay Ignored**: `WsLogger` sends `{ type: 'history', logs: [...] }` upon client connection, but `studio.js` neglects to handle `data.type === 'history'`, ignoring buffered log history on page load/reconnection.

---

## Detailed Findings by Focus Area

### 1. WebSocket Real-Time zcli Log Streamer (`/ws/logs`, `WsLogger`, xterm.js)

#### 1.1 Endpoint URL Mismatch
- **Location**: `zeroops-engine/public/studio.js`, line 126 vs `zeroops-engine/src/studio/server.ts`, line 42.
- **Evidence**:
  - `server.ts` attaches `WsLogger`: `const wss = logger.attach(server, '/ws/logs');`
  - `studio.js` connects: `socket = new WebSocket(\`${proto}//\${location.host}\`);`
- **Impact**: In browser environments, WebSocket fails to connect to the dedicated `/ws/logs` handler because the path `/ws/logs` is omitted in `studio.js`. Tests pass only because test suites explicitly specify `ws://127.0.0.1:${port}/ws/logs`.

#### 1.2 xterm.js Terminal Integration Missing
- **Location**: `zeroops-engine/public/studio.html`, lines 207–210 & `zeroops-engine/public/studio.js`, lines 8, 132.
- **Evidence**:
  - HTML uses a raw text pre element: `<pre class="terminal" id="terminal">...`. No xterm.js CDN script or stylesheet is included in `<head>`.
  - JS appends raw text: `terminal.textContent += data.text + '\n';`.
  - `WsLogger` emits ANSI escape sequences like `\x1b[90m[2026-08-09T...]\x1b[0m \x1b[36m[web-frontend]\x1b[0m`.
- **Impact**: Terminal outputs string literals like `\x1b[90m[2026-08-09T01:12:00Z]\x1b[0m \x1b[36m[web-frontend]\x1b[0m` inside the DOM `<pre>` container instead of rendering colorized terminal text.

#### 1.3 Ignored Log History Frame
- **Location**: `zeroops-engine/src/studio/ws-logger.ts`, lines 57–62 & `zeroops-engine/public/studio.js`, lines 128–168.
- **Evidence**:
  - `ws-logger.ts` sends history frame on connect:
    ```ts
    ws.send(JSON.stringify({ type: 'history', logs: this.logBuffer }));
    ```
  - `studio.js` `socket.onmessage` checks for `data.type === 'log'`, `'topology-update'`, and `'complete'`, but ignores `'history'`.
- **Impact**: Reconnected users or users refreshing the page miss all existing deployment logs buffered in the ring buffer.

#### 1.4 Missing Service Log Filtering UI
- **Location**: `zeroops-engine/src/studio/ws-logger.ts`, lines 269–274 & `zeroops-engine/public/studio.js`.
- **Evidence**:
  - `WsLogger` implements client message handling for `subscribe` with service filter: `this.serviceFilters.set(ws, data.service)`.
  - Frontend UI has no filter selector/buttons for service logs (e.g. `All`, `web-frontend`, `api-gateway`, `ai-worker`, `db-postgres`, `cache-valkey`).
- **Impact**: Users cannot isolate logs for a single service during complex multi-container builds.

#### 1.5 Topology Node Status CSS Class Case Mismatch
- **Location**: `zeroops-engine/src/studio/ws-logger.ts`, lines 303, 323 vs `zeroops-engine/public/studio.js`, line 153 vs `zeroops-engine/public/studio.css`, lines 494, 500.
- **Evidence**:
  - `ws-logger.ts` calls `this.updateTopology(s, 'BUILDING')` and `this.updateTopology(s, 'HEALTHY')`.
  - `studio.js` sets: `node.className = 'topo-chip ' + data.status;` resulting in `<div class="topo-chip BUILDING">`.
  - `studio.css` defines rules: `.topo-chip.building .topo-chip__dot` and `.topo-chip.healthy .topo-chip__dot`.
- **Impact**: Node chips do not turn yellow (`building`) or green (`healthy`) when receiving WS topology events because class names do not match CSS selectors.

---

### 2. Code Inspector File Tree Navigation & Code Preview Pane

#### 2.1 Missing Split File Tree & Code Preview Layout
- **Location**: `zeroops-engine/public/studio.html`, lines 218–222 & `zeroops-engine/public/studio.js`, lines 252–267.
- **Evidence**:
  - HTML pane `#wb-code` contains a single container `#code-tree`.
  - JS function `renderCodeFiles(files)` loops over file map and appends `.code-tree__file` items containing `<div class="code-tree__filename">` and `<pre class="code-tree__content">` stacked sequentially.
- **Impact**: Multi-service syntheses with 10–20 generated files (`zerops.yml`, `services/web/src/App.tsx`, `services/api/main.go`, `services/db/schema.sql`, etc.) produce a single mega-scrolling document instead of an IDE-style Code Inspector.

#### 2.2 Lack of Active File Selection & Directory Tree Hierarchy
- **Location**: `zeroops-engine/public/studio.js`, lines 252–267.
- **Evidence**:
  - `files` keys are file path strings (`zerops.yml`, `web-frontend/src/App.ts`, etc.).
  - There is no tree view parser to group files into directories, no click-to-select event listener, no active file state, and no separate preview window.
- **Impact**: Poor usability when inspecting synthesized code artifacts for multi-container stacks.

#### 2.3 Missing Utility Actions (Copy & Export)
- **Location**: `zeroops-engine/public/studio.html` & `zeroops-engine/public/studio.js`.
- **Evidence**:
  - Code view pane lacks "Copy Code", "Copy zerops.yml", or "Download Project Zip/Files" buttons.
- **Impact**: Impairs developer workflow when attempting to export generated configurations to local dev environments.

---

## Verification Matrix & Test Coverage Analysis

| Component / Feature | Backend Implementation (`ws-logger.ts`, `server.ts`) | Frontend Implementation (`studio.html`, `studio.js`) | Test Suite Coverage (`workbench-ui.test.ts`, `studio.test.ts`) | Verification Status |
|-------------------|------------------------------------------------|--------------------------------------------------|------------------------------------------------------------|--------------------|
| WS Path Endpoint | `/ws/logs` | `ws://${location.host}` (Missing `/ws/logs`) | Tested with explicit `/ws/logs` URL | ⚠️ **FAIL in Frontend** |
| xterm.js ANSI Rendering | Emits ANSI strings | Raw `<pre>.textContent` (No xterm.js script/CSS) | Verified string content only | ⚠️ **FAIL in Frontend** |
| WS Replay History | Sends `type: 'history'` | Ignored in `onmessage` | Tested backend message | ⚠️ **FAIL in Frontend** |
| Topology Status Transition | Emits `'BUILDING'`, `'HEALTHY'` | Sets `className = 'topo-chip ' + status` | Tested JSON frame payload | ⚠️ **FAIL in Frontend CSS** |
| Code Inspector UI | Synthesizes `codeFiles` map | Stacked `<pre>` list (No file tree / viewer split) | Tested object keys count | ⚠️ **DEFICIENT UI** |

---

## Recommended Strategy & Action Plan

### Strategy for Explorer 1 / Worker Implementation Phase

1. **Harden WebSocket Connection & Event Handling in `studio.js`**:
   - Change `new WebSocket(...)` URL to include path `/ws/logs`.
   - Add handler for `data.type === 'history'` to populate initial terminal logs.
   - Lowercase `data.status` in `topology-update` handler: `node.className = 'topo-chip ' + data.status.toLowerCase()`.
   - Disable deploy button and display connection warnings when WS is disconnected.

2. **Integrate xterm.js Terminal Viewer**:
   - Add xterm.js CDN script and CSS link in `studio.html` (or lightweight ANSI HTML parser fallback).
   - Initialize `const term = new Terminal({ theme: { background: '#0c0c0f' }, convertEol: true })` on element `#terminal`.
   - Write incoming log texts via `term.write(data.text + '\r\n')`.

3. **Add Terminal Service Log Filter Bar**:
   - Add filter tabs/buttons above terminal (`All`, `web-frontend`, `api-gateway`, `ai-worker`, `db-postgres`, `cache-valkey`).
   - On selection, clear terminal and send `{ action: 'subscribe', service: selectedService }` over WebSocket.

4. **Refactor Code Inspector Layout (`#wb-code`)**:
   - Update `#wb-code` HTML structure into a split layout:
     - Left `.code-tree-sidebar`: Tree view listing synthesized files organized by directory path with selection highlights and filter input.
     - Right `.code-preview-pane`: Code viewer showing path breadcrumb, copy button, line numbers, and formatted code content of selected file.
   - Default selected file to `zerops.yml` or the first synthesized file.

5. **Enhance Unit & Integration Test Suites**:
   - Add frontend contract assertion tests in `tests/workbench-ui.test.ts` for lowercased topology status strings, WS path URLs, and file tree structure output format.
