# Scope: Milestone M2 — Session Auth & BYO PAT Onboarding

## Architecture
Multi-tenant Session Authentication & Bring-Your-Own Personal Access Token (PAT) Onboarding for ZeroOps Studio Cloud Engine.

## Scope Inventory
| # | Feature / Component | File Locations | Description | Status |
|---|---------------------|----------------|-------------|--------|
| 1 | Session Auth Endpoints | zeroops-engine/src/server/index.js | `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | DONE |
| 2 | Zerops PAT Onboarding Modal | zeroops-engine/public/studio.html, zeroops-engine/public/studio.js | `POST /api/auth/token`, session cookie / bearer token persistence | DONE |
| 3 | ZCPClient Wrapper PAT Injection | zeroops-engine/src/server/zcp-client.js, zeroops-engine/src/zcp/zcp-client.ts | Pass user's PAT token (`ZEROPS_TOKEN` env/header) to `zcli project project-import -` | DONE |
| 4 | Private Net Env Var Injection | zeroops-engine/src/synthesizer/private-net.ts | Inject `DB_HOST`, `VALKEY_HOST`, `DATABASE_URL`, `REDIS_URL`, etc. | DONE |
| 5 | Auth & Onboarding Tests | zeroops-engine/tests/auth-onboarding.test.ts | Unit & E2E tests for auth, onboarding, session storage, zcli PAT token injection | DONE |

## Iteration Status
Current iteration: 1 / 32
Gate Status: PASS
