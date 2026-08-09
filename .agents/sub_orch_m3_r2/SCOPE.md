# Scope: Milestone M3 — Pre-Built Full-Stack Template Library & Code Synthesizer

## Architecture
- Code synthesis engine (`zeroops-engine/src/code-gen/code-synthesizer.ts`) and template generator (`src/templates/template-generator.ts`).
- AST/syntax stub validator (`zeroops-engine/src/code-gen/stub-validator.ts`).
- 3 Pre-built multi-container templates (`zeroops-engine/src/templates/`):
  1. `ai-video-clipper` (Next.js webapp + Go apigateway + Python aiworker Whisper queue + PostgreSQL + Valkey)
  2. `ecommerce-platform` (Bun storefront webapp + Go Order API apigateway + Python Rec aiworker + PostgreSQL + Valkey)
  3. `rag-search-engine` (React webapp + FastAPI apigateway + Python Embedder aiworker + PostgreSQL pgvector + Valkey)
- Zerops config generation: `zerops-import.yml` and `zerops.yml` for all 3 templates defining 5 containers each.

## Feature Inventory
| # | Feature | Description | Scope | Source |
|---|---------|-------------|-------|--------|
| 1 | 5-Container Template Specifications | Verify & harden 3 templates defining 5 containers (webapp, apigateway, aiworker, postgres, valkey) | M3 | Dispatch |
| 2 | Zerops Config Generation | `zerops-import.yml` and `zerops.yml` generation for all 3 templates with pgvector & Whisper queue structures | M3 | Dispatch |
| 3 | CodeSynthesizer Completeness | Functional multi-service code synthesis without placeholders/dummy stubs | M3 | Dispatch |
| 4 | Stub Validator Verification | AST validator (TS/JS) & text syntax validator (Go, Python, SQL DDL) for zero stubs | M3 | Dispatch |
| 5 | Test Suite Execution | 100% pass on `tests/template-library.test.ts` & `tests/code-gen.test.ts` | M3 | Dispatch |

## Iteration Loop Plan
- Step a: Spawn 3 Explorers (`teamwork_preview_explorer`) to audit codebase and plan test/fix strategy.
- Step b: Spawn 1 Worker (`teamwork_preview_worker`) with mandatory integrity warning to implement fixes and run unit/template tests.
- Step c: Spawn 2 Reviewers (`teamwork_preview_reviewer`) to independently review code changes and template quality.
- Step d: Spawn 2 Challengers (`teamwork_preview_challenger`) to empirically test 1-click template hydration & zero-stub validation.
- Step e: Spawn 1 Forensic Auditor (`teamwork_preview_auditor`) to perform static analysis & integrity verification.
- Step f: Evaluate Gate Verdict in `GATE_STATUS.md`.
