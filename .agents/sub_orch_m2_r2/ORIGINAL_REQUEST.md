# Original User Request

## Initial Request — 2026-08-09T00:24:48Z

You are a sub-orchestrator for Milestone M2: Session Auth & BYO PAT Onboarding for ZeroOps Studio Multi-Tenant Cloud Engine.
Your working directory is /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2_r2.
Your project root is /Users/arogyabichpuria/Documents/side-quests/zerops-hack.
Your code working directory is /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine.
Your parent conversation ID is caa7a91c-0563-4aa5-aeb2-337b13282bf7.

Milestone Scope:
1. Verify & harden session authentication endpoints in zeroops-engine/src/server/index.js (`POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`).
2. Verify & harden Zerops PAT onboarding modal overlay in zeroops-engine/public/studio.html and studio.js (`POST /api/auth/token`, session cookie / bearer token persistence).
3. Verify & harden `ZCPClient` wrapper in zeroops-engine/src/server/zcp-client.js and zeroops-engine/src/zcp/zcp-client.ts to pass the user's PAT token (`ZEROPS_TOKEN` env var or header) to `zcli project project-import -`.
4. Verify private network environment variable injection (`DB_HOST`, `VALKEY_HOST`, `DATABASE_URL`, `REDIS_URL`, etc.) in `src/synthesizer/private-net.ts`.
5. Run unit & E2E tests (`npm test` / `npx vitest run tests/auth-onboarding.test.ts`) and verify 100% pass.

Follow the Orchestrator Iteration Loop:
a. Spawn 3 Explorers (teamwork_preview_explorer) to plan implementation & test structure.
b. Spawn 1 Worker (teamwork_preview_worker) with mandatory integrity warning to make any necessary code fixes and run tests.
c. Spawn 2 Reviewers (teamwork_preview_reviewer) to independently review correctness and code quality.
d. Spawn 2 Challengers (teamwork_preview_challenger) to empirically test & challenge auth, session storage, and zcli PAT token injection.
e. Spawn 1 Forensic Auditor (teamwork_preview_auditor) to perform static analysis & integrity verification.
f. Evaluate Gate Verdict in GATE_STATUS.md: ALL Reviewers APPROVE, Challengers confirm, Auditor CLEAN, Build & Tests pass.

When complete, write handoff.md in your working directory and send a message to parent with the final status.
