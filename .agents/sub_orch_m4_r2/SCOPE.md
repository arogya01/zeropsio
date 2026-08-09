# Scope: Milestone M4 - Real-Time zcli Log Streaming & Workbench Studio UI

## Overview
Sub-orchestration scope for Milestone M4 under ZeroOps Studio Multi-Tenant Cloud Engine.

## Architecture & Components
- **Split-pane Workbench UI**: `zeroops-engine/public/studio.html`, `public/studio.js`, `public/studio.css`
  - Left panel: `#chat-feed` (chat/pipeline stream) + `#prompt-bar` (pinned at bottom).
  - Right panel: `#wb-terminal` (xterm.js zcli log streamer), `#wb-yaml` (zerops.yml viewer), `#wb-code` (Code Inspector with file tree & preview).
- **Persistent Topology Strip**: `.topo-strip`
  - 5 container node chips: `webapp`, `apigateway`, `aiworker`, `postgres`, `valkey`.
  - Animated packet flow indicators.
  - Status badge transitions: `BUILDING` -> `DEPLOYING` -> `HEALTHY` / `FAILED`.
- **WebSocket Log Streaming Engine**: `src/studio/ws-logger.ts`, `src/studio/server.ts`
  - Route `/ws/logs` handling zcli stdout/stderr stream broadcast.
  - `WsLogger` with ANSI color formatting & xterm.js integration.
- **Code Inspector**: File tree navigation & file content preview pane.
- **Verification Test Suites**:
  - `npx vitest run tests/workbench-ui.test.ts`
  - `npx vitest run tests/studio.test.ts`

## Iteration Checklist
- [ ] Explorers analysis & plan
- [ ] Worker fixes & execution
- [ ] Reviewers evaluation
- [ ] Challengers stress testing
- [ ] Auditor integrity check
- [ ] Gate verdict evaluation
