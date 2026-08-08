# Project: ZeroOps — Full-Stack Autonomous Cloud Factory

## Architecture
ZeroOps is a full-stack autonomous cloud factory. It takes natural language prompts and programmatically synthesizes, provisions, wires, builds, deploys, and verifies multi-container cloud applications live on Zerops via ZCP (Zerops Control Plane).

### Data & Control Flow
`User Prompt / Web Studio` -> `ZeroOps Synthesizer Engine` -> `zerops-project-import.yml & zerops.yml` -> `ZCP / Zerops REST API / zcli` -> `Zerops Private VXLAN Cloud Stack` (Frontend + API Gateway + Worker + PostgreSQL HA + Valkey Cache) -> `Real-Time WebSocket Log Streamer & Topology Canvas` -> `Automated Live Verification Suite`

### Code Layout (`zeroops-engine`)
```
zeroops-engine/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                     # Main Engine CLI & Server entry point
│   ├── synthesizer/                 # ZCP YAML & Stack Synthesizer (R1)
│   │   ├── stack-synthesizer.ts
│   │   ├── yaml-generator.ts
│   │   └── types.ts
│   ├── code-gen/                    # Multi-Service Code & Schema Synthesizer (R2)
│   │   ├── code-synthesizer.ts
│   │   ├── template-generator.ts
│   │   └── stub-validator.ts
│   ├── zcp/                         # ZCP API & zcli Orchestration Bridge
│   │   ├── zcp-client.ts
│   │   ├── runner.ts
│   │   └── logger.ts
│   ├── studio/                      # Web Studio UI & WebSocket Log Streamer (R3)
│   │   ├── server.ts
│   │   ├── ws-logger.ts
│   │   └── public/                  # Dark-mode Web Studio SPA (xterm.js + 3D/2D Topology Canvas)
│   │       ├── index.html
│   │       ├── app.js
│   │       ├── topology-canvas.js
│   │       └── style.css
│   └── verifier/                    # Automated Live Verification Suite (R4)
│       ├── live-auditor.ts
│       ├── http-checker.ts
│       ├── db-auditor.ts
│       └── queue-auditor.ts
└── docs/                            # Project Documentation & Demo Video Script
    ├── AI-USAGE.md
    └── DEMO_STORYBOARD.md
```

---

## Feature Inventory
Every feature extracted during Phase 0 survey is cataloged and assigned to a milestone below.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Natural Language Stack Synthesizer | Parses prompt to construct multi-service stack topology & generates YAMLs | M1 | `ORIGINAL_REQUEST.md:12` |
| 2 | ZCP Project Provisioner | Calls ZCP API / MCP tools to create isolated Zerops projects | M1 | `ORIGINAL_REQUEST.md:12,27` |
| 3 | 3+ Container Runtime Deployment | Deploys Frontend, API Gateway, and Worker containers | M1 | `ORIGINAL_REQUEST.md:13,28` |
| 4 | 2 Managed Service Provisioner | Spins up Managed PostgreSQL HA cluster and Valkey Cache | M1 | `ORIGINAL_REQUEST.md:13,28` |
| 5 | Private Network IP/Env Injector | Automatically injects `DB_HOST`, `VALKEY_HOST` inter-service IP env vars | M1 | `ORIGINAL_REQUEST.md:14,29` |
| 6 | Multi-Service Code Synthesizer | Generates complete UI, REST/gRPC API, queue worker, & SQL migrations | M2 | `ORIGINAL_REQUEST.md:15,37` |
| 7 | Zero-Stub Code Validator | Enforces complete runnable implementations with zero placeholder stubs | M2 | `ORIGINAL_REQUEST.md:16,37` |
| 8 | Dark-Mode Web Studio UI | Dark-themed Web Studio interface for prompt input, build & monitor | M3 | `ORIGINAL_REQUEST.md:18,31` |
| 9 | 3D/2D Container Topology Canvas | Interactive topology map showing nodes, packet flow animations, and health | M3 | `ORIGINAL_REQUEST.md:18,33` |
| 10 | WebSocket xterm.js Log Streamer | Real-time terminal log viewer streaming build/runtime logs via WebSocket | M3 | `ORIGINAL_REQUEST.md:18,32` |
| 11 | Zero-Downtime Deployment Trigger | One-click instant redeployment and zero-downtime rolling update trigger | M3 | `ORIGINAL_REQUEST.md:19` |
| 12 | Live HTTP 200 Health Checker | Programmatically pings live provisioned Zerops URLs for HTTP 200 | M4 | `ORIGINAL_REQUEST.md:21,38` |
| 13 | Private DB & Cache Connectivity Auditor | Verifies PostgreSQL read/write & Valkey ping over internal private network | M4 | `ORIGINAL_REQUEST.md:21,38` |
| 14 | End-to-End Queue Processing Auditor | Pushes test message API -> Valkey -> Worker -> Postgres and verifies | M4 | `ORIGINAL_REQUEST.md:22,38` |
| 15 | Verified Live URL Presenter | Generates and displays verified live HTTP URL upon successful health check | M4 | `ORIGINAL_REQUEST.md:22,34` |
| 16 | AI-Usage & Project Documentation | Generates transparent `AI-USAGE.md`, `README.md`, & architecture docs | M5 | `ORIGINAL_REQUEST.md:39` |
| 17 | Demo Video Storyboard Generator | Scripts a 30-60s vertical 9:16 video storyboard showing live deployment | M5 | `ORIGINAL_REQUEST.md:39` |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | ZCP Stack Synthesizer & Engine Core | `zeroops-engine` scaffold, `zerops.yml` + project import generator, 3+ runtimes, 2 managed DBs, private IP env injector | none | DONE |
| M2 | Full-Stack Code & Schema Synthesizer | Multi-service code generation (UI, API, Worker, SQL migrations), AST zero-stub validator | M1 | DONE |
| M3 | Web Studio & WebSocket Log Streamer | Dark-mode Web Studio UI, 3D/2D container topology canvas, WebSocket `xterm.js` log streamer, deploy triggers | M1, M2 | DONE |
| M4 | Automated Live Verification Suite | Live HTTP 200 checker, private DB/Cache auditor, E2E queue processing auditor, live URL presenter | M1, M2, M3 | PLANNED |
| M5 | Documentation & Demo Storyboard | `AI-USAGE.md`, `README.md`, architecture documentation, 30-60s 9:16 vertical video storyboard script | M1..M4 | PLANNED |
| M6 | Final E2E Suite & Adversarial Hardening | Pass 100% of E2E test suite (Tiers 1-4), Tier 5 white-box adversarial coverage hardening | M1..M5 | PLANNED |

---

## Interface Contracts

### 1. Synthesizer ↔ ZCP Provisioner Contract
```typescript
interface StackTopologySpec {
  projectName: string;
  runtimes: Array<{
    name: string; // e.g. 'frontend', 'api', 'worker'
    runtime: 'nodejs' | 'go' | 'python' | 'rust';
    ports: number[];
    envVariables: Record<string, string>;
  }>;
  managedServices: Array<{
    name: string; // e.g. 'postgres', 'valkey'
    type: 'postgresql' | 'valkey';
    mode: 'HA' | 'SINGLE';
  }>;
}

interface GeneratedConfigs {
  zeropsProjectImportYaml: string;
  zeropsYaml: string;
}
```

### 2. Studio ↔ WebSocket Log Streamer Contract
```typescript
interface LogStreamMessage {
  timestamp: string;
  service: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

interface TopologyNodeState {
  id: string;
  name: string;
  type: 'runtime' | 'database' | 'cache';
  status: 'HEALTHY' | 'BUILDING' | 'FAILED';
  privateIp?: string;
}
```

### 3. Verification Suite Contract
```typescript
interface HealthAuditResult {
  passed: boolean;
  httpStatus: number;
  liveUrl: string;
  privateDbConnected: boolean;
  privateCacheConnected: boolean;
  queueE2EPassed: boolean;
  latencyMs: number;
  errors: string[];
}
```
