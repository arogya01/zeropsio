# Dispatch Assignment — worker_m3_r1

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Working directory: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/worker_m3_r1
- Parent Orchestrator: sub_orch_m3

## Task
Implement Milestone M3: Web Studio & WebSocket Log Streamer in `zeroops-engine/src/studio/` and tests in `zeroops-engine/tests/studio.test.ts`.

## Context Files to Read
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/PROJECT.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m3/SCOPE.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m3_r1_1/handoff.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m3_r1_2/handoff.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m3_r1_3/handoff.md

## Exclusive File Ownership
You own and have exclusive write permission to:
- `zeroops-engine/src/studio/ws-logger.ts`
- `zeroops-engine/src/studio/server.ts`
- `zeroops-engine/src/studio/public/index.html`
- `zeroops-engine/src/studio/public/app.js`
- `zeroops-engine/src/studio/public/topology-canvas.js`
- `zeroops-engine/src/studio/public/style.css`
- `zeroops-engine/src/index.ts` (adding studio exports & CLI command)
- `zeroops-engine/tests/studio.test.ts`

## Mandatory Requirements
1. `src/studio/ws-logger.ts`:
   - Implement `WsLogger` class & `LogStreamMessage` interface matching `PROJECT.md` contracts.
   - Ring buffer management (up to 1,000 items), ANSI escape formatting for `xterm.js`, control character sanitization.
   - Attach to HTTP server on path `/ws/logs`.
   - Support `emit(service, stream, message)`, `updateTopology(serviceId, status, privateIp)`, `complete(liveUrl, projectName, services, audit)`, and client subscriptions.

2. `src/studio/server.ts`:
   - Implement `createStudioServer(options?)` returning Express `app`, HTTP `server`, and WebSocketServer `wss`.
   - Serve static files from `src/studio/public/` (with fallback path resolution for dev & compiled dist execution).
   - REST endpoints: `GET /api/health`, `GET /api/status`, `POST /api/synthesize`, `POST /api/deploy`.
   - WebSocket `/ws/logs` connection handling.

3. `src/studio/public/`:
   - `index.html`: Dark-mode Web Studio SPA with prompt input, topology canvas container, `xterm.js` log terminal container, zero-downtime deployment trigger buttons, and success banner.
   - `style.css`: Sleek slate/zinc dark-mode palette (`#09090b` / `#0f172a`), neon status indicators (`#22c55e` healthy, `#eab308` building, `#ef4444` failed).
   - `topology-canvas.js`: HTML5 2D Canvas container topology map with 5 container nodes, particle packet flows along network connections, state glowing pulses, node click details.
   - `app.js`: SPA client script connecting to WebSocket `/ws/logs`, initializing `xterm.js` terminal, handling deploy triggers, updating canvas states.

4. `src/index.ts`:
   - Export `createStudioServer` from `./studio/server.js`.
   - Add `studio` command to CLI (`zeroops studio --port 3000`).

5. `tests/studio.test.ts`:
   - Vitest test suite testing server startup, static asset delivery, REST APIs (`/api/health`, `/api/synthesize`, `/api/deploy`), and WebSocket `/ws/logs` streaming.

6. Build & Test Verification:
   - Run `cd zeroops-engine && npx vitest run` (or `npm test`) to ensure ALL tests pass 100% (both existing and new studio tests).

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Handoff Output
Write your detailed implementation report to `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/worker_m3_r1/handoff.md`. Include exact build and test output commands and results.
