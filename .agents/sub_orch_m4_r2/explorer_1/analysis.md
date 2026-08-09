# Detailed Analysis & Recommendations: UI Layout & Topology Strip (Explorer 1)

**Milestone**: M4 — Real-Time zcli Log Streaming & Workbench Studio UI  
**Focus Area**: Split-Pane UI Layout & Persistent Bottom Topology Strip  
**Target Directory**: `zeroops-engine/public/` (`studio.html`, `studio.js`, `studio.css`, `index.html`)  
**Date**: 2026-08-09  

---

## 1. Executive Summary

This investigation analyzed the bolt.new-inspired split-pane UI layout and persistent bottom topology strip in `zeroops-engine/public/studio.html`, `studio.css`, and `studio.js`, alongside `src/studio/server.ts` and `src/studio/ws-logger.ts`.

While the current test suite (`workbench-ui.test.ts` and `studio.test.ts`) passes 32/32 tests, our static analysis revealed critical structural gaps, element ID omissions, CSS case-sensitivity bugs, missing animations, and potential runtime crashes under specific SPA entry conditions.

Key findings:
1. **Missing Spec Element IDs**: `#chat-feed` and `#prompt-bar` IDs are missing from `studio.html` and `index.html` (currently using `#pipeline-feed` and `.prompt-bar`).
2. **Topology Status Badge Transition Defect**: WebSocket status updates send uppercase strings (`BUILDING`, `DEPLOYING`, `HEALTHY`, `FAILED`), but `studio.css` selectors use case-sensitive lowercase classes (`.topo-chip.building`, `.topo-chip.healthy`). Furthermore, CSS styles for `deploying` and `failed` are completely absent.
3. **Static Packet Flows**: `.topo-arrow` elements lack CSS animation keyframes and active glow effects.
4. **Service ID Alias Mapping Gap**: Service lookup in `studio.js` only matches exact strings (`web-frontend`, `api-gateway`, `ai-worker`, `db-postgres`, `cache-valkey`). Short names (`webapp`, `apigateway`, `aiworker`, `postgres`, `valkey`) sent by custom stacks evaluate to `undefined`.
5. **SPA Entry Point Discrepancy & Infinite Redirect**: `public/index.html` lacks `#user-name` and `#onboarding` elements present in `public/studio.html`. Opening `index.html` causes `studio.js` to throw a `TypeError` when setting `userNameEl.textContent`, triggering an infinite redirect loop to `/`.

---

## 2. Split-Pane UI Layout Investigation

### 2.1 Left Panel (Chat & Pipeline Feed + Pinned Prompt Bar)
- **Current HTML (`studio.html` lines 95-191)**:
  - Container `<aside class="panel-left">` contains `<div class="panel-left__scroll">` for content scrolling and `<div class="prompt-bar">` pinned to the bottom via flexbox (`flex-shrink: 0`).
  - Welcome state: `<div class="chat-welcome" id="chat-welcome">` with preset cards.
  - Pipeline feed: `<div class="pipeline-feed hidden" id="pipeline-feed">` containing 4 step cards (`#feed-step-synth`, `#feed-step-net`, `#feed-step-lxd`, `#feed-step-health`) and success card (`#feed-success`).
- **Gaps & Omissions**:
  1. **Missing `#chat-feed` ID**: The prompt spec requires `#chat-feed` as the container ID for the left chat/pipeline feed. In `studio.html`, only `#pipeline-feed` exists.
  2. **Missing `#prompt-bar` ID**: The prompt spec requires `#prompt-bar`. `studio.html` line 174 uses `<div class="prompt-bar">` without `id="prompt-bar"`.

### 2.2 Right Panel (Tabbed Workbench & Code Inspector)
- **Current HTML (`studio.html` lines 194-258)**:
  - Container `<main class="panel-right">` contains tabs (`.wb-tabs`) with buttons: `Terminal` (`data-tab="wb-terminal"`), `zerops.yml` (`data-tab="wb-yaml"`), `Code` (`data-tab="wb-code"`).
  - Panes: `#wb-terminal` (`<pre id="terminal">`), `#wb-yaml` (`<pre id="yaml-view">`), `#wb-code` (`<div id="code-tree">`).
- **Gaps & Omissions**:
  1. **Code Inspector Tree Layout**: `renderCodeFiles(files)` in `studio.js` (lines 252-267) appends all files linearly into `#code-tree`. For multi-service projects, a split file tree sidebar (`.file-tree-sidebar`) + code viewer pane (`.code-preview`) provides better navigation for multi-service synthesized files.
  2. **Empty Guard**: `renderCodeFiles` lacks empty object/null checks.

### 2.3 `public/index.html` vs `public/studio.html` Divergence
- `server.ts` fallback route serves `index.html`.
- `public/index.html` lacks `<div class="onboarding-overlay" id="onboarding">` and `<span id="user-name"></span>`.
- In `studio.js` line 63: `userNameEl.textContent = currentUser.name;`
  When `userNameEl` is `null`, JS throws `TypeError: Cannot set properties of null`. The `catch` block on line 68 triggers `window.location.href = '/'`, creating a continuous page refresh loop.

---

## 3. Persistent Bottom Topology Strip (`.topo-strip`)

### 3.1 5 Container Node Chips & Alias Mapping
- **Current HTML (`studio.html` lines 225-257)**:
  ```html
  <div class="topo-chip" id="node-web-frontend">...</div>
  <div class="topo-chip" id="node-api-gateway">...</div>
  <div class="topo-chip" id="node-ai-worker">...</div>
  <div class="topo-chip topo-chip--db" id="node-db-postgres">...</div>
  <div class="topo-chip topo-chip--db" id="node-cache-valkey">...</div>
  ```
- **Service Lookup Defect in `studio.js`**:
  - `studio.js` lines 32-38 lookup elements by strict key (`web-frontend`, `api-gateway`, `ai-worker`, `db-postgres`, `cache-valkey`).
  - If WebSocket payload contains aliases (`webapp`, `apigateway`, `aiworker`, `postgres`, `valkey`), lookup returns `undefined` and chip status is untouched.

### 3.2 Status Badge Transitions & Case Sensitivity Defect
- **Status Payload**: `ws-logger.ts` emits `{ type: 'topology-update', serviceId: 'api-gateway', status: 'BUILDING' }` (uppercase).
- **JS Assignment**: `studio.js` line 153 does `node.className = 'topo-chip ' + data.status;` resulting in `class="topo-chip BUILDING"`.
- **CSS Selectors**: `studio.css` lines 494 & 500 define `.topo-chip.building` and `.topo-chip.healthy` (lowercase).
- **Defect**: CSS class matching is case-sensitive! `class="topo-chip BUILDING"` fails to match `.topo-chip.building`. The status indicator dot remains static gray.
- **Missing States**: `studio.css` has no rules for `deploying` or `failed`.

### 3.3 Animated Packet Flows
- **Current Styling (`studio.css` lines 522-527)**: `.topo-arrow` is static (`color: var(--text-3); opacity: 0.4`).
- **Defect**: No CSS animations or active state keyframes exist to visualize packet flow across topology nodes during active deployment or operational traffic.

### 3.4 Dynamic IP & Node Attribute Updating
- When `topology-update` messages deliver dynamic private IPs (`data.privateIp`), `studio.js` ignores `data.privateIp` and only alters `node.className`. The IP element `.topo-chip__ip` is never updated.

---

## 4. Identified Bugs & Risk Matrix

| # | Component | Defect Description | Severity | Impact |
|---|---|---|---|---|
| B1 | Left Panel | Missing `id="chat-feed"` and `id="prompt-bar"` in HTML | Medium | Spec/test selector failure |
| B2 | Topology Strip | CSS case-sensitivity mismatch (`BUILDING` vs `.building`) | High | Status dot stays gray during deployments |
| B3 | Topology Strip | Missing CSS rules for `deploying` and `failed` states | Medium | Visual glitch on deploy/failure |
| B4 | Topology Strip | Service ID alias lookup returns `undefined` for short names | High | Topology updates ignored for short node names |
| B5 | Topology Strip | Static packet flow arrows (`.topo-arrow` lacks keyframe animation) | Low | Missing visual feature requirement |
| B6 | Topology Strip | `data.privateIp` ignored during topology updates | Medium | Outdated IP addresses displayed in chips |
| B7 | Auth / SPA | `public/index.html` missing `#user-name` causes crash & redirect loop | High | Page load breakage when opening root `/` |
| B8 | WS Streamer | `studio.js` ignores `type: 'history'` WebSocket messages | Medium | Initial/reconnected logs lost in UI |
| B9 | Form Handler | Deploy button remains disabled permanently if POST fails | Medium | UI stuck in deploying state on network error |

---

## 5. Recommended Implementation Fix Strategy

### Step 1: HTML Alignment (`public/studio.html` & `public/index.html`)
1. Add `id="chat-feed"` to `<div class="pipeline-feed hidden" id="pipeline-feed" id="chat-feed">` or wrap `#chat-welcome` and `#pipeline-feed` in a `#chat-feed` container inside `panel-left__scroll`.
2. Add `id="prompt-bar"` to `<div class="prompt-bar" id="prompt-bar">`.
3. Synchronize `public/index.html` with `public/studio.html` so both contain `#onboarding`, `#token-error`, and `#user-name`.

### Step 2: Topology Chip & Status Normalization (`public/studio.js`)
1. Create a service ID mapping helper in `studio.js`:
   ```javascript
   function getNodeElement(serviceId) {
     const aliasMap = {
       'webapp': 'web-frontend',
       'web': 'web-frontend',
       'apigateway': 'api-gateway',
       'api': 'api-gateway',
       'aiworker': 'ai-worker',
       'worker': 'ai-worker',
       'postgres': 'db-postgres',
       'db': 'db-postgres',
       'valkey': 'cache-valkey',
       'cache': 'cache-valkey'
     };
     const targetId = aliasMap[serviceId] || serviceId;
     return nodes[targetId] || document.getElementById('node-' + targetId);
   }
   ```
2. In `topology-update` message handler, normalize status string to lower-case:
   ```javascript
   const status = (data.status || '').toLowerCase();
   node.className = 'topo-chip ' + status;
   ```
3. Update `.topo-chip__ip` text content if `data.privateIp` is present:
   ```javascript
   if (data.privateIp) {
     const ipEl = node.querySelector('.topo-chip__ip');
     if (ipEl) ipEl.textContent = data.privateIp.split(':')[0];
   }
   ```

### Step 3: Topology CSS Styling & Packet Animations (`public/studio.css`)
1. Add status classes for uppercase and lowercase variants in `studio.css`:
   - `.topo-chip.building`, `.topo-chip.BUILDING` -> amber yellow dot + pulse animation.
   - `.topo-chip.deploying`, `.topo-chip.DEPLOYING` -> blue dot + pulse animation.
   - `.topo-chip.healthy`, `.topo-chip.HEALTHY`, `.topo-chip.done` -> emerald green dot.
   - `.topo-chip.failed`, `.topo-chip.FAILED` -> red dot + flash animation.
2. Add animated packet flow keyframes for `.topo-arrow`:
   ```css
   @keyframes packet-pulse {
     0%, 100% { opacity: 0.3; transform: scale(1); }
     50% { opacity: 1; color: var(--accent); transform: scale(1.2); }
   }
   .topo-arrow.active {
     animation: packet-pulse 1.2s ease-in-out infinite;
   }
   ```

### Step 4: Robustness & WS History Handling (`public/studio.js`)
1. Safely guard `userNameEl`: `if (userNameEl) userNameEl.textContent = currentUser.name;`.
2. Handle `type === 'history'` in WebSocket `onmessage`:
   ```javascript
   if (data.type === 'history' && Array.isArray(data.logs)) {
     data.logs.forEach(log => {
       terminal.textContent += (log.text || log.message) + '\n';
     });
     terminal.scrollTop = terminal.scrollHeight;
   }
   ```
3. Re-enable `deployBtn` in `catch` block on POST `/api/synthesize` failure.

---
