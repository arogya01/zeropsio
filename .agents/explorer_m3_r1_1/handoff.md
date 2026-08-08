# Handoff Report: Web Studio Server & Log Streamer Architecture (`src/studio/server.ts`)

**Agent**: `teamwork_preview_explorer` (explorer_m3_r1_1)  
**Milestone**: M3 — Web Studio & WebSocket Log Streamer  
**Target Sub-Component**: `src/studio/server.ts`, `src/studio/ws-logger.ts`, `src/studio/public/*`  
**Date**: 2026-08-08T18:05:00Z  

---

## 1. Observation

### 1.1 Existing Dependencies & Build Pipeline
- `zeroops-engine/package.json` contains all required dependencies:
  * `"express": "^4.19.2"`
  * `"ws": "^8.18.0"`
  * `"cors": "^2.8.5"`
  * `"dotenv": "^16.4.5"`
  * `"commander": "15.0.0"`
  * `"picocolors": "1.1.1"`
  * `"typescript": "5.9.3"`
  * `"vitest": "4.1.10"`
- Existing test suite executed via `npm test` (`npx vitest run`) passes 100% (47/47 tests across 7 test files).

### 1.2 Codebase Structure & Missing Studio Directory
- `zeroops-engine/src/index.ts` is the main CLI & programmatic entry point, exporting `synthesizeStack`, `injectPrivateNetEnv`, `generateZeropsConfigs`, `ZcpClient`, and `CodeSynthesizer`.
- Prototype CommonJS server exists at `src/server/index.js`, but TypeScript standard per `PROJECT.md` & `SCOPE.md` requires:
  * `src/studio/server.ts` (Express + `ws` server)
  * `src/studio/ws-logger.ts` (Real-time log streamer formatting ANSI logs for `xterm.js`)
  * `src/studio/public/` (Dark-mode Web Studio SPA: `index.html`, `app.js`, `topology-canvas.js`, `style.css`)
- `src/studio/` directory currently does not exist and needs to be created.

### 1.3 Interface Contracts (Adherence to `PROJECT.md`)
`PROJECT.md` specifies the exact interface contracts for studio log streaming and topology updates:
```typescript
interface LogStreamMessage {
  timestamp: string;
  service: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

interface TopologyNodeState {
  id: string;
  name: string;
  type: 'runtime' | 'database' | 'cache';
  status: 'HEALTHY' | 'BUILDING' | 'FAILED' | 'READY';
  privateIp?: string;
}
```

---

## 2. Logic Chain

From the observations, the implementation strategy for `src/studio/` is structured as follows:

### Step 1: `src/studio/ws-logger.ts` — Real-Time WebSocket Logger & ANSI Formatter
1. Define and export interfaces `LogStreamMessage`, `TopologyNodeState`, and `WsLogPayload`.
2. Class `WsLogger`:
   - Maintains a set of active WebSocket client connections (`clients: Set<WebSocket>`).
   - `addClient(ws: WebSocket)`: adds WS client and sends initial connection handshake message.
   - `removeClient(ws: WebSocket)`: removes client on close/disconnect.
   - `sendLog(wsOrAll: WebSocket | 'all', message: string, service?: string, stream?: 'stdout' | 'stderr' | 'system')`: formats payload as `{ type: 'log', timestamp, service, stream, message }` and sends JSON.
   - `sendState(wsOrAll: WebSocket | 'all', serviceId: string, status: TopologyNodeState['status'], privateIp?: string)`: sends `{ type: 'topology-update', serviceId, status, privateIp }`.
   - `sendComplete(wsOrAll: WebSocket | 'all', data: { liveUrl?: string; projectName: string; services: any[]; audit?: any })`: sends completion payload.
   - ANSI text helpers using `picocolors` or standard ANSI escape sequences for rich `xterm.js` rendering.

### Step 2: `src/studio/server.ts` — HTTP Server & REST API / WS Gateway
1. Server creation factory `createStudioServer(options?: { port?: number; host?: string; mock?: boolean })`:
   - Express app setup: `app.use(express.json())`, `app.use(cors())`.
   - Static file middleware: `app.use(express.static(path.join(__dirname, 'public')))` with fallback path check for `dist/studio/public`.
   - HTTP server created via `http.createServer(app)`.
   - WebSocket Server created via `new WebSocket.Server({ server, path: '/ws/logs' })`.
2. REST API Endpoints:
   - `GET /api/health`: Returns `{ status: 'ok', timestamp: string, version: '1.0.0' }`.
   - `POST /api/synthesize`: Accepts `{ prompt: string, projectName?: string }`. Calls `synthesizeStack`, `injectPrivateNetEnv`, `generateZeropsConfigs`, and `synthesizeCode`. Returns `{ success: true, projectName, topology, configs, codeArtifacts }`.
   - `POST /api/deploy`: Accepts `{ prompt: string, projectName?: string, mock?: boolean }`. Triggers full deployment workflow via `ZcpClient`. Stream logs to connected WebSocket clients. Returns `{ success: true, project, deployment, privateTopology }`.
   - `GET /api/topology`: Accepts `?projectId=...` or default project. Returns `PrivateTopologyMap`.
   - `POST /api/verify`: Triggers live health check (mock or real HTTP/DB check).
3. WebSocket Connection Handling (`/ws/logs`):
   - Listen on `wss.on('connection', (ws, req) => ...)`:
     * Registers client with `WsLogger`.
     * Listens for `ws.on('message', async (data) => ...)`:
       - `{ action: 'deploy', prompt, projectName }`: Triggers synthesis, emits state updates for all 5 services (`building`), calls `zcpClient.importProject` & `deployProject` streaming logs via `WsLogger.sendLog`, updates states to `healthy`/`READY`, and emits complete message with live URL (`https://${projectName}.zerops.app`).
       - `{ action: 'synthesize', prompt }`: Synthesizes stack and sends topology & code preview log.
       - `{ action: 'ping' }`: Sends `{ type: 'pong', timestamp }`.
4. Export `createStudioServer` and CLI self-execution guard (`if (process.argv[1]?.includes('server')) ...`).

### Step 3: `src/studio/public/` — Dark-Mode Web Studio SPA
1. `index.html`:
   - Dark mode slate theme (`#09090b` dark background, glowing neon green `#22c55e` and cyan `#06b6d4` highlights).
   - Prompt input form with pre-populated prompt examples.
   - Header bar displaying ZeroOps status badges, "Synthesize Stack" & "Deploy Stack" buttons.
   - Middle section: 2D/3D topology canvas container (`<canvas id="topologyCanvas">`).
   - Bottom section: `xterm.js` terminal log container (`<div id="terminal"></div>`).
   - Live URL display card with quick launch link upon deployment complete.
2. `app.js`:
   - Connects to WebSocket server (`ws://${window.location.host}/ws/logs`).
   - Instantiates `xterm.js` `Terminal` with dark theme (`background: '#09090b'`, `foreground: '#f4f4f5'`).
   - Listens for WebSocket events:
     * `type === 'log'` -> `term.writeln(msg.message)`.
     * `type === 'topology-update'` -> calls `topologyCanvas.updateNodeStatus(msg.serviceId, msg.status)`.
     * `type === 'complete'` -> updates UI badge and shows verified live URL link.
3. `topology-canvas.js`:
   - Renders 5 services: `frontend` (Node.js), `api` (Go), `worker` (Python), `postgres` (Managed DB), `valkey` (Managed Cache).
   - Animated packet particles moving along network connection lines between containers over private VXLAN network (`10.0.0.x`).
   - Color codes node states:
     * `HEALTHY` / `READY` -> Green `#22c55e` glow
     * `BUILDING` / `DEPLOYING` -> Yellow `#eab308` pulse
     * `FAILED` -> Red `#ef4444`
4. `style.css`:
   - Modern sleek dark UI with CSS grid layout, glassmorphism cards, glowing status pill tags.

### Step 4: Integration with `src/index.ts` & `package.json`
- Add `export { createStudioServer } from './studio/server.js'` to `src/index.ts`.
- Add `zeroops studio` command in Commander CLI in `src/index.ts`:
  ```typescript
  program
    .command('studio')
    .description('Launch ZeroOps Web Studio HTTP & WebSocket Log Streaming server')
    .option('-p, --port <number>', 'Port to run Web Studio server', '3000')
    .action(async (options: any) => {
      const port = parseInt(options.port, 10) || 3000;
      const studio = createStudioServer({ port });
      await studio.listen();
    });
  ```
- Add `"dev:studio": "node --watch dist/studio/server.js"` or `"studio": "node dist/index.js studio"` to `package.json` scripts.

### Step 5: Integration Tests — `tests/studio.test.ts`
Write Vitest test suite `tests/studio.test.ts` covering:
1. REST API endpoint pings (`GET /api/health`, `POST /api/synthesize`, `POST /api/deploy`, `GET /api/topology`).
2. WebSocket connection & log streaming (`ws.send({ action: 'deploy' })` -> receives `log` & `topology-update` messages).
3. Server startup & teardown cleanup.

---

## 3. Caveats

1. **Port Conflicts**: Default server port is `3000` (or `process.env.PORT`). `createStudioServer` must accept dynamic port assignments so tests can run on dynamic ephemeral ports (e.g. port 0 or 3099) to avoid collisions.
2. **Path Resolution for Static Public Directory**: When compiled to `dist/studio/server.js`, `__dirname` will be `dist/studio`. The static public path should check both `path.join(__dirname, 'public')` and `path.join(__dirname, '../../src/studio/public')` to support both dev and dist execution.
3. **xterm.js Script Loading**: In browser SPA (`index.html`), load `xterm.js` and `xterm.css` via CDN (`unpkg` or `cdnjs`) with an inline fallback canvas terminal if CDN is unreadable.
4. **WebSocket Connection Readiness**: Client WS reconnection logic should automatically attempt reconnecting if WS drops during long build operations.

---

## 4. Conclusion

The architecture for `src/studio/server.ts` and `src/studio/ws-logger.ts` is fully specified and aligned with `PROJECT.md` and `SCOPE.md`. 

### Key Modules to Create:
1. `zeroops-engine/src/studio/ws-logger.ts`
2. `zeroops-engine/src/studio/server.ts`
3. `zeroops-engine/src/studio/public/index.html`
4. `zeroops-engine/src/studio/public/app.js`
5. `zeroops-engine/src/studio/public/topology-canvas.js`
6. `zeroops-engine/src/studio/public/style.css`
7. `zeroops-engine/tests/studio.test.ts`

### Recommended Action Plan for Implementer:
- **Phase 1**: Create `src/studio/ws-logger.ts` with WebSocket log formatting & broadcasting methods.
- **Phase 2**: Create `src/studio/server.ts` with Express REST API routes and `/ws/logs` WebSocket handler.
- **Phase 3**: Create `src/studio/public/` SPA files (`index.html`, `app.js`, `topology-canvas.js`, `style.css`).
- **Phase 4**: Wire studio server into `src/index.ts` (`zeroops studio` command).
- **Phase 5**: Create `tests/studio.test.ts` and run `npm test` to verify 100% test pass rate.

---

## 5. Verification Method

To verify the implementation independently once built:

1. **Run Unit & Integration Test Suite**:
   ```bash
   cd /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine
   npx vitest run tests/studio.test.ts
   ```
   *Pass Condition*: `tests/studio.test.ts` passes all tests verifying `/api/health`, `/api/synthesize`, `/api/deploy`, `/api/topology`, and WebSocket `/ws/logs` messaging.

2. **Run Entire Engine Test Suite**:
   ```bash
   npm test
   ```
   *Pass Condition*: All test files pass with 0 failures.

3. **Verify Web Studio Server Execution**:
   ```bash
   npx tsc
   node dist/index.js studio --port 3099
   ```
   Test REST API via curl:
   ```bash
   curl http://localhost:3099/api/health
   # Expected output: {"status":"ok","version":"1.0.0",...}
   ```
