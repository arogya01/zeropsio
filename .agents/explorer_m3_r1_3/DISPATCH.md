# Dispatch Assignment — explorer_m3_r1_3

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Working directory: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m3_r1_3
- Parent Orchestrator: sub_orch_m3

## Task
Investigate codebase and design implementation strategy for `src/studio/public/` (Dark-mode Web Studio SPA) and test suite `tests/studio.test.ts`.

## Context Files to Read
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/PROJECT.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m3/SCOPE.md
- /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/package.json
- Existing files in `zeroops-engine/src/` and `zeroops-engine/tests/`

## Requirements
1. Design `src/studio/public/`:
   - `index.html`: Sleek dark-mode SPA layout with header, prompt input / trigger controls, 3D/2D topology canvas container, and `xterm.js` log terminal container. CDN links or bundle setups for `xterm.js` and Canvas 2D/Three.js if applicable.
   - `style.css`: Professional dark-mode design baseline (slate/zinc palette, glassmorphism card containers, neon status indicators for HEALTHY/BUILDING/FAILED).
   - `topology-canvas.js`: Interactive container topology rendering nodes (Frontend, API, Worker, Postgres, Valkey), animated packet flows/particles along connections, node click selection, and color-coded health state updates.
   - `app.js`: Connects to `/ws/logs` via WebSocket, attaches log stream to `xterm.js` Terminal instance, handles zero-downtime deployment trigger REST API calls, updates topology state based on status events.
2. Design unit/integration tests in `zeroops-engine/tests/studio.test.ts`:
   - Test server startup and static file serving
   - Test REST API endpoints (`/api/deploy`, `/api/status`, `/api/health`)
   - Test WebSocket connection to `/ws/logs` and log broadcast streaming
3. Provide step-by-step recommendations for Worker.
4. Write handoff report to `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m3_r1_3/handoff.md`.
