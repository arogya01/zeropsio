# Scope: Milestone M1 — Test Suite Unification & Coverage Setup for ZeroOps Studio Multi-Tenant Cloud Engine

## Architecture & Code Boundaries
- **Project Root**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack`
- **Engine Working Directory**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`
- **Test Directory**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/tests/`
- **Documentation**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/TEST_READY.md`

## Feature Inventory & Requirements
| # | Feature / Component | Description | Target File / Area | Status |
|---|---------------------|-------------|-------------------|--------|
| 1 | Unified Test Runner Scripts | Update `package.json` scripts: `npm test` runs vitest and node native tier tests. Add `test:unit`, `test:tier`, `test:all`. | `zeroops-engine/package.json` | DONE |
| 2 | Auth & Onboarding Tests | Session signup/login (`/api/auth/signup`, `/api/auth/login`), PAT overlay storage (`/api/auth/token`), ZCP token passing. | `zeroops-engine/tests/auth-onboarding.test.ts` | DONE |
| 3 | Template Library Tests | Template catalog (`/api/templates`), `zerops-import.yml` synthesis for 3 pre-built stacks, zero-stub AST validator on template files. | `zeroops-engine/tests/template-library.test.ts` | DONE |
| 4 | Workbench UI & Streamer Tests | Studio APIs (`/api/synthesize`, `/api/deploy`), WebSocket log streamer broadcasting (`/ws/logs`), topology state updates. | `zeroops-engine/tests/workbench-ui.test.ts` | DONE |
| 5 | Test Suite Documentation | Update `TEST_READY.md` with unified test runner setup, 269+ test case count breakdown, execution commands. | `TEST_READY.md` | DONE |

## Gate Status History
*(Will be updated per iteration)*
