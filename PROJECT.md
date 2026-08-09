# Project: ZeroOps Studio — Multi-Tenant Cloud Engine

## Architecture
ZeroOps Studio is a multi-tenant cloud engine allowing developers to log in, onboard their own Zerops Personal Access Token (PAT), and provision/deploy multi-container cloud stacks (3 runtimes + 2 managed DBs) live on Zerops via `zcli` and ZCP APIs.

### Data & Control Flow
`User Login / PAT Onboarding` -> `Web Studio UI (Split Pane)` -> `1-Click Template Launcher / Prompt Synthesizer` -> `zerops-import.yml & zerops.yml Generator` -> `zcli project-import (with User PAT)` -> `Zerops Private VXLAN Cloud Stack` (Frontend + API Gateway + Worker + PostgreSQL + Valkey Cache) -> `WebSocket Log Streamer & Topology Canvas` -> `Automated Live Verification Suite` -> `Live Verified URL`

### Code Layout (`zeroops-engine`)
```
zeroops-engine/
├── package.json                     # Test & build scripts
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                     # CLI & library entry point
│   ├── server/                      # Multi-tenant auth & Studio server
│   │   ├── index.js                 # Express server & API routes
│   │   ├── health-checker.js        # Health audit runner
│   │   └── zcp-client.js            # zcli child process runner
│   ├── synthesizer/                 # Stack & YAML synthesizer
│   │   ├── stack-synthesizer.ts
│   │   ├── yaml-generator.ts
│   │   └── private-net.ts
│   ├── code-gen/                    # Multi-service code synthesizer
│   │   ├── code-synthesizer.ts
│   │   ├── template-generator.ts
│   │   └── stub-validator.ts
│   ├── studio/                      # Web Studio & WS log streamer
│   │   ├── server.ts
│   │   └── ws-logger.ts
│   ├── templates/                   # 3 Pre-built stack templates
│   │   ├── ai-video-clipper/
│   │   ├── ecommerce-platform/
│   │   └── rag-search-engine/
│   └── verifier/                    # Verification suite
│       └── live-auditor.ts
├── public/                          # Studio & Login SPA assets
│   ├── login.html
│   ├── studio.html
│   ├── studio.js
│   └── studio.css
└── tests/                           # Unit, Integration & Tier E2E tests
    ├── auth-onboarding.test.ts
    ├── template-library.test.ts
    ├── workbench-ui.test.ts
    ├── challenger-adversarial.test.ts
    ├── harness.ts
    ├── harness.test.ts
    └── tier1..tier4.test.ts
```

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Minimal Session Auth API & UI | Email/password login & signup UI and API routes | M2 | `ORIGINAL_REQUEST.md:50` |
| 2 | BYO Zerops PAT Onboarding | Modal overlay for user Zerops PAT storage per session | M2 | `ORIGINAL_REQUEST.md:51` |
| 3 | zcli PAT Token Injection | Injects user PAT into `zcli project-import` operations | M2 | `ORIGINAL_REQUEST.md:51,69` |
| 4 | AI Video Clipper Template | Next.js + Go REST + Python Whisper + PostgreSQL + Valkey | M3 | `ORIGINAL_REQUEST.md:55` |
| 5 | E-Commerce Platform Template | Bun + Go Order + Python Rec + PostgreSQL + Valkey | M3 | `ORIGINAL_REQUEST.md:56` |
| 6 | RAG Search Engine Template | React + FastAPI + Python Embedder + PostgreSQL pgvector + Valkey | M3 | `ORIGINAL_REQUEST.md:57` |
| 7 | Polyglot Code Synthesizer | Synthesizes full runnable multi-service source files | M3 | `ORIGINAL_REQUEST.md:15,37` |
| 8 | AST Zero-Stub Validator | Validates JS/TS/Go/Python/SQL code for zero placeholders | M3 | `ORIGINAL_REQUEST.md:16,37` |
| 9 | Bolt.new Split-Pane Studio UI | Left prompt/feed + Right tabbed Terminal/Yaml/Code Inspector | M4 | `ORIGINAL_REQUEST.md:59` |
| 10 | WebSocket zcli Log Streamer | Real-time xterm.js terminal log streaming via WebSockets | M4 | `ORIGINAL_REQUEST.md:60` |
| 11 | Persistent Topology Canvas | 2D node map of 5 services with animated health states | M4 | `ORIGINAL_REQUEST.md:60` |
| 12 | Live Public HTTP 200 Audit | Programmatic HTTP status 200 health check on provisioned URL | M5 | `ORIGINAL_REQUEST.md:62` |
| 13 | Private DB Connectivity Audit | Pings Postgres HA over Zerops internal private VXLAN IP | M5 | `ORIGINAL_REQUEST.md:63` |
| 14 | Private Valkey Queue Audit | Pings Valkey stream over Zerops internal private VXLAN IP | M5 | `ORIGINAL_REQUEST.md:63` |
| 15 | Live Verified URL Banner | Displays verified live HTTP URL upon 100% audit pass | M5 | `ORIGINAL_REQUEST.md:63,74` |
| 16 | Test Suite Unification | Unifies Vitest and Node native Tier test suites in `npm test` | M1 | Survey Findings |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Test Suite Unification & Coverage Setup | Unify `npm test` script, add dedicated tests for Auth, Templates, Studio UI, update `TEST_READY.md` | none | DONE |
| M2 | Session Auth & BYO PAT Onboarding | Verify & harden session auth, PAT overlay, and `zcli` PAT injection | M1 | DONE |
| M3 | Pre-Built Full-Stack Template Library | Verify 3 multi-container templates, zerops-import.yml generator, AST zero-stub validator | M1 | DONE |
| M4 | Real-Time Log Streaming & Split-Pane Studio | Verify split-pane UI, WebSocket zcli log streamer, zerops.yml viewer, Code Inspector, topology strip | M1, M2, M3 | DONE |
| M5 | Automated Live Verification & Health Audit | Verify HTTP 200 checker, private DB/Cache auditor, live URL presenter banner | M1, M2..M4 | IN_PROGRESS |
| M6 | Final E2E Suite & Adversarial Hardening | Pass 100% of unified test suite (350+ tests), Tier 5 white-box coverage hardening | M1..M5 | PLANNED |

---

## Interface Contracts

### 1. User Session & PAT Contract (`src/server/index.js`)
```typescript
interface UserSession {
  userId: string;
  email: string;
  token: string;
  zeropsPat?: string;
  createdAt: string;
}
```

### 2. Stack Template Contract (`src/server/index.js`)
```typescript
interface StackTemplate {
  id: 'ai-video-clipper' | 'ecommerce-platform' | 'rag-search-engine';
  name: string;
  description: string;
  services: Array<{
    name: string;
    type: 'webapp' | 'apigateway' | 'aiworker' | 'postgres' | 'valkey';
    runtime: 'nodejs' | 'go' | 'python' | 'postgresql' | 'valkey';
    port: number;
  }>;
  zeropsProjectImportYaml: string;
  zeropsYaml: string;
}
```

### 3. Log Streamer & Topology WebSocket Contract (`src/studio/ws-logger.ts`)
```typescript
interface WsLogMessage {
  type: 'log' | 'topology-update' | 'complete' | 'history' | 'error';
  service?: string;
  message?: string;
  status?: 'BUILDING' | 'DEPLOYING' | 'HEALTHY' | 'FAILED';
  privateIp?: string;
  liveUrl?: string;
}
```

### 4. Verification & Audit Contract (`src/server/health-checker.js`)
```typescript
interface AuditResult {
  success: boolean;
  auditsPassed: number;
  auditsTotal: number;
  score: string;
  details: {
    publicHttp: { passed: boolean; statusCode: number };
    apiGateway: { passed: boolean; statusCode: number };
    postgresPrivateDb: { passed: boolean; connected: boolean };
    valkeyPrivateCache: { passed: boolean; connected: boolean };
  };
  liveUrl: string;
}
```
