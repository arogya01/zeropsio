# Project: ZeroOps Studio Multi-Tenant Cloud Engine

## Architecture
Multi-tenant full-stack cloud engine with BYO PAT onboarding, template launcher (3 multi-container stacks), split-pane workbench UI with WebSocket real-time log streaming, and automated health verification suite.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Test Suite Unification | Vitest runner & test organization | M1 | survey |
| 2 | Minimal Session Auth | Email/password login/signup & auth middleware | M2 | ORIGINAL_REQUEST |
| 3 | BYO PAT Onboarding | Onboarding overlay & per-session PAT storage | M2 | ORIGINAL_REQUEST |
| 4 | Template Launcher | 3 pre-built full-stack stacks | M3 | ORIGINAL_REQUEST |
| 5 | zcli Config Generator | zerops.yml synthesis for 5-container stacks | M3 | ORIGINAL_REQUEST |
| 6 | Workbench Studio UI | Split-pane UI with chat, terminal, code viewer | M4 | ORIGINAL_REQUEST |
| 7 | Real-Time Log Streaming | WebSocket streaming of zcli output to xterm.js | M4 | ORIGINAL_REQUEST |
| 8 | Automated Health Checker | HTTP, DB, Cache, Queue health probes | M5 | ORIGINAL_REQUEST |
| 9 | Live URL Presenter | Verified HTTP URL presenter banner in Studio | M5 | ORIGINAL_REQUEST |
| 10| E2E Testing & Hardening | Opaque-box E2E test suite & adversarial coverage | M6 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Test Suite Unification | Vitest setup & coverage | None | DONE |
| M2 | Session Auth & PAT Onboarding | Auth API, PAT storage, overlay | M1 | DONE |
| M3 | Pre-Built Template Library | 3 templates, zcli import generator | M2 | DONE |
| M4 | Real-Time Log Streaming UI | Studio UI, WebSocket log streaming | M3 | DONE |
| M5 | Automated Health Audit Suite | Live Auditor, health-checker, UI banner | M4 | IN_PROGRESS |
| M6 | E2E Test Suite & Hardening | Phase 3 E2E tests & Tier 5 hardening | M5 | PLANNED |

## Interface Contracts
- `AuthService`: `signup(email, password)`, `login(email, password)`, `storePat(session, pat)`
- `TemplateEngine`: `getTemplates()`, `renderZeropsYml(templateId)`
- `LogStreamer`: WebSocket endpoint `/api/logs/stream`
- `IVerificationSuite`: `auditHttp(url)`, `auditDb(host, port)`, `auditCache(host, port)`, `auditQueueE2E()`, `runFullAudit()`
