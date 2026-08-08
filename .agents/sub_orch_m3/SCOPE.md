# Scope: Milestone M3 — Web Studio & WebSocket Log Streamer

## Scope Description
Implement the Web Studio UI and real-time log streaming server in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/studio/`:
1. `src/studio/server.ts`: Express/Fastify/HTTP & WebSocket server hosting Web Studio REST APIs and WebSocket endpoints (`/ws/logs`).
2. `src/studio/ws-logger.ts`: Real-time WebSocket log streamer outputting ANSI-formatted build and runtime logs to `xterm.js`.
3. `src/studio/public/`: Dark-mode Web Studio SPA with:
   - Live 3D/2D Container Topology Canvas (`topology-canvas.js` displaying container nodes, packet flow animations, and color-coded health states green/yellow/red).
   - Real-time `xterm.js` terminal log viewer connected via WebSocket.
   - Zero-downtime deployment triggers and stack synthesis controls.

## Code Layout Ownership
- `zeroops-engine/src/studio/*`
- `zeroops-engine/tests/studio.test.ts`
