# ZeroOps Studio Specification & Requirement Mining Analysis

**Target Project**: ZeroOps Studio Multi-Tenant Cloud Engine  
**Authoritative Sources**: `ORIGINAL_REQUEST.md` (2026-08-08T18:40:32Z update), `zerops-challenge-brief.html`, `PROJECT.md`  
**Mining Scope**: Requirements R1, R2, R3, R4, Interface Contracts, Edge Cases, Acceptance Criteria.

---

## 1. Executive Summary & Context

ZeroOps Studio is a multi-tenant cloud factory engine designed for developers to log in, onboard their own Zerops Personal Access Token (PAT), and provision/deploy complex 5-container full-stack application architectures directly onto Zerops via `zcli` or Zerops Control Plane (ZCP) APIs.

The engine provides:
1. **Session Auth & Token Overlay (R1)**: User registration/login, session token binding, and Zerops PAT key management.
2. **1-Click Full-Stack Template Launcher (R2)**: 3 multi-container pre-built stacks (AI Video Clipper, Multi-Service E-Commerce, RAG Search Engine).
3. **Split-Pane Workbench Studio (R3)**: Left panel chat/pipeline feed + prompt input; right panel tabbed Terminal streaming `zcli` logs, `zerops.yml` viewer, Code Inspector; bottom persistent topology strip.
4. **Verification & Health Audit Suite (R4)**: Programmatic HTTP status 200 health checks, private network DB/cache verification, live URL output.

---

## 2. Detailed Requirement Specifications

### R1. Session Auth & BYO Zerops Token Onboarding

- **Authentication UI & API**:
  - Email & password registration (`POST /api/auth/signup`) and authentication (`POST /api/auth/login`).
  - Session state maintained via HTTP bearer token or session cookie per user session.
- **BYO Zerops Token Onboarding**:
  - Modal overlay / prompt during onboarding for users to paste their Zerops Personal Access Token (PAT).
  - Token stored securely per-session (in memory or encrypted session state) and injected as header/environment variable (`ZEROPS_TOKEN`) for `zcli` and ZCP operations.
- **`zcli` Integration**:
  - `zcli` commands (e.g. `zcli project project-import`, `zcli push`, `zcli service deploy`) execute using the authenticated user's PAT overlay.
  - Automatic fallback to mock mode if token is omitted or invalid.

### R2. 3 Pre-Built Full-Stack Template Library (1-Click Deploy)

Each template consists of **5 distinct containers** (3 runtimes + 2 managed databases):

1. **AI Video Clipper Stack**:
   - **Frontend**: Next.js / Bun Web Application (`webapp`, Port 3000)
   - **API Gateway**: Go REST API Gateway (`apigateway`, Port 8080)
   - **Background Worker**: Python Whisper AI Worker (`aiworker`, Port 8000)
   - **Managed Database**: PostgreSQL HA (`postgres`, Port 5432)
   - **Managed Cache/Queue**: Valkey Cache & Stream (`valkey`, Port 6379)

2. **Multi-Service E-Commerce Stack**:
   - **Frontend**: Bun Storefront Web Application (`webapp`, Port 3000)
   - **API Gateway**: Go Order & Payment REST API (`apigateway`, Port 8080)
   - **Background Worker**: Python Recommendation Worker (`aiworker`, Port 8000)
   - **Managed Database**: PostgreSQL HA (`postgres`, Port 5432)
   - **Managed Cache/Queue**: Valkey Cache (`valkey`, Port 6379)

3. **RAG Search Engine Stack**:
   - **Frontend**: React Web Application (`webapp`, Port 3000)
   - **API Gateway**: FastAPI Gateway (`apigateway`, Port 8080)
   - **Background Worker**: Python Embedder & Vector Worker (`aiworker`, Port 8000)
   - **Managed Database**: PostgreSQL with `pgvector` extension (`postgres`, Port 5432)
   - **Managed Cache/Queue**: Valkey Cache (`valkey`, Port 6379)

### R3. Real-Time zcli Log Streaming & Workbench Studio UI

- **Bolt.new-Inspired Split-Pane Layout**:
  - **Left Panel**:
    - Top: Interactive Chat & Build Pipeline Feed.
    - Bottom: Pinned Prompt Input Textarea, Project Name Field, Synthesize & Deploy Trigger Buttons, and Preset Template Pills.
  - **Right Panel (Tabbed Workbench)**:
    - **Tab 1: Terminal Log Streamer**: Real-time xterm.js console streaming live `zcli` stdout/stderr build & runtime log events via WebSocket (`ws://host/ws/logs`).
    - **Tab 2: zerops.yml Viewer**: Syntax-highlighted blueprint inspector showing generated `zerops-project-import.yml` and `zerops.yml`.
    - **Tab 3: Code Inspector**: Sidebar file tree + code viewer showing generated multi-service source files (UI components, REST/gRPC API handlers, background queue workers, SQL schema migrations).
  - **Bottom Topology Strip**:
    - Persistent 2D VXLAN canvas showing all 5 topology node chips (`webapp`, `apigateway`, `aiworker`, `postgres`, `valkey`).
    - Animated packet flows & live status badge transitions (`BUILDING` -> `DEPLOYING` -> `HEALTHY` / `FAILED`).

### R4. Verification & Health Audit Suite

- **Automated Programmatic Health Checks**:
  1. **Public HTTP 200 Check**: Pings public ingress URL (`GET https://<project>.zerops.app/api/health`) and verifies HTTP 200 status code and response payload.
  2. **API Gateway Health Check**: Pings `/api/health` to confirm gateway routing.
  3. **Private PostgreSQL Connectivity Audit**: Executes query (`SELECT 1`) over Zerops private VXLAN IP (e.g. `10.160.0.x:5432`) verifying private network routing.
  4. **Private Valkey Ping Audit**: Sends `PING` to Valkey cache over private VXLAN IP (e.g. `10.160.0.x:6379`).
- **Live URL Output**:
  - Upon 100% audit pass, displays verified live URL banner with one-click copy button and direct browser link.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth (R1) | Session Signup & Login API | Registers and authenticates developers per session | Email, Password | Session Token, User Profile | 400 Bad Request, 401 Unauthorized | `ORIGINAL_REQUEST.md:50` |
| 2 | Auth (R1) | BYO Zerops PAT Overlay | Onboarding UI component to input Personal Access Token | Zerops PAT string | Encrypted/Session Token Store | 400 Invalid PAT format | `ORIGINAL_REQUEST.md:50` |
| 3 | Auth (R1) | zcli Token Injection | Injects session PAT into `zcli` commands (`project-import`, `push`) | Session PAT | Executed zcli command with auth | Fallback to mock mode or zcli auth error | `ORIGINAL_REQUEST.md:51,69` |
| 4 | Templates (R2) | AI Video Clipper Preset | 1-click deployment for AI video processing stack | Template selection trigger | 5-container import spec & source code | Synthesis error if schema invalid | `ORIGINAL_REQUEST.md:55` |
| 5 | Templates (R2) | Multi-Service E-Commerce | 1-click deployment for microservices storefront | Template selection trigger | 5-container import spec & source code | Synthesis error if schema invalid | `ORIGINAL_REQUEST.md:56` |
| 6 | Templates (R2) | RAG Search Engine Preset | 1-click deployment for vector search stack | Template selection trigger | 5-container import spec & source code | Synthesis error if schema invalid | `ORIGINAL_REQUEST.md:57` |
| 7 | UI/Workbench (R3) | Split-Pane Studio Layout | Left chat/prompt feed + Right tabbed workbench UI | User interactions, window resize | Rendered split-pane web UI | Graceful UI collapse on small screen | `ORIGINAL_REQUEST.md:59` |
| 8 | UI/Workbench (R3) | WebSocket Log Terminal | Live streaming of zcli stdout/stderr via xterm.js | WS connection (`/ws/logs`) | Rendered terminal log lines | Auto-reconnect after 3s on disconnect | `ORIGINAL_REQUEST.md:60` |
| 9 | UI/Workbench (R3) | zerops.yml Blueprint Viewer | Code view of import & runtime zerops.yml configs | Synthesized YAML string | Formatted syntax view | Displays error message if YAML parse fails | `ORIGINAL_REQUEST.md:60` |
| 10 | UI/Workbench (R3) | Code Inspector & Tree | File tree navigation & viewer for generated code files | Synthesized file list object | Code preview pane | Displays empty state if no code available | `ORIGINAL_REQUEST.md:60` |
| 11 | UI/Workbench (R3) | Persistent Topology Canvas | 2D/3D map of 5 service chips with animated status | Topology state updates | Canvas rendering with packet flows | Shows default state if offline | `ORIGINAL_REQUEST.md:60` |
| 12 | Health/Audit (R4) | Live HTTP 200 Audit | Programmatic HTTP check of live deployed web URL | Live ingress URL | Status 200 OK + Latency | 502/504 Bad Gateway, Timeout | `ORIGINAL_REQUEST.md:62` |
| 13 | Health/Audit (R4) | Private DB Connectivity Audit | Pings Postgres HA over internal VXLAN IP (10.x.x.x) | Private IP (`10.x.x.x:5432`) | Success payload (`connected`) | Connection refused / Timeout | `ORIGINAL_REQUEST.md:63` |
| 14 | Health/Audit (R4) | Valkey Queue Audit | Pings Valkey stream/cache over internal VXLAN IP | Private IP (`10.x.x.x:6379`) | PONG response + memory state | Connection refused / Timeout | `ORIGINAL_REQUEST.md:63` |
| 15 | Health/Audit (R4) | Verified Live URL Banner | UI success card showing verified live HTTPS link | Deployment completion event | Clickable live link + copy button | Hidden if deployment or audit fails | `ORIGINAL_REQUEST.md:63,74` |

---

## 4. Edge Cases & Observed Behaviors

| # | Feature | Input / Condition | Observed Behavior |
|---|---------|-------------------|-------------------|
| 1 | Auth & PAT Overlay | Invalid or expired Zerops PAT entered | zcli API calls fail with 401; system logs warning and offers mock fallback mode. |
| 2 | Auth & PAT Overlay | Omitted PAT during onboarding | Engine defaults to mock simulation mode (`mode: 'mock'`), allowing complete preview without live credentials. |
| 3 | zcli Log Streamer | WebSocket disconnect during heavy log stream | Client catches `onclose` event, displays "Disconnected" indicator, and attempts auto-reconnect every 3 seconds while buffering missed logs. |
| 4 | Template Launcher | Simultaneous trigger of multiple 1-click templates | System queues deployment pipeline per project ID, preventing project name collisions. |
| 5 | Private Network Wiring | Service environment variable lookup before container boot | Private IPs (`10.160.0.x`) are pre-allocated during `zerops-project-import.yml` synthesis and injected as static env vars (`DB_HOST`, `VALKEY_HOST`). |
| 6 | Verification Suite | Deployed service slow to warm up (cold start delay) | Health checker retries HTTP/DB ping up to 5 attempts before marking audit state as `FAILED`. |
| 7 | zerops.yml Generation | Complex multi-runtime build timeout | Generates `build.cache` directives and splits `prepareCommands` vs `buildCommands` per Zerops specification recommendations. |

---

## 5. Interface Contracts & Data Schemas

### 1. User Session & PAT Contract (`src/auth/types.ts`)
```typescript
export interface UserSession {
  userId: string;
  email: string;
  token: string;
  zeropsPat?: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  sessionToken?: string;
  error?: string;
}
```

### 2. Full-Stack Template Contract (`src/templates/types.ts`)
```typescript
export interface StackTemplate {
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
export type LogMessageType = 'log' | 'topology-update' | 'complete' | 'history' | 'error';

export interface WsLogMessage {
  type: LogMessageType;
  service?: string;
  serviceId?: string;
  text?: string;
  message?: string;
  status?: 'BUILDING' | 'DEPLOYING' | 'HEALTHY' | 'FAILED';
  privateIp?: string;
  liveUrl?: string;
  projectName?: string;
  logs?: WsLogMessage[];
}
```

### 4. Verification & Audit Contract (`src/verifier/health-auditor.ts`)
```typescript
export interface HealthCheckResult {
  success: boolean;
  auditsPassed: number;
  auditsTotal: number;
  score: string; // e.g. "100%"
  details: {
    publicHttp: { passed: boolean; statusCode: number; latencyMs: number };
    apiGateway: { passed: boolean; statusCode: number };
    postgresPrivateDb: { passed: boolean; connectionString: string; pingMs: number };
    valkeyPrivateCache: { passed: boolean; pingMs: number };
  };
  liveUrl: string;
}
```

---

## 6. Acceptance Criteria Matrix

| Criterion ID | Requirement | Description | Target Verification Method |
|--------------|-------------|-------------|----------------------------|
| AC-1.1 | R1 (Auth) | Users can sign up / log in and input their Zerops Personal Access Token | POST `/api/auth/signup`, POST `/api/auth/login`, PAT overlay test |
| AC-1.2 | R1 (Auth) | `zcli project project-import` executes using the user's specific token | Execute `zcli` wrapper with mock/real token header check |
| AC-2.1 | R2 (Templates) | 3 templates render in the Studio UI | Inspect DOM / API output for 3 pre-built preset buttons |
| AC-2.2 | R2 (Templates) | Clicking template triggers 5-container import | Verify synthetic `zerops-project-import.yml` has 5 defined services |
| AC-3.1 | R3 (Studio UI) | WebSocket streams live `zcli` terminal output to xterm.js console | WebSocket client listener test on `/ws/logs` |
| AC-3.2 | R3 (Studio UI) | All 5 topology chips transition from `building` to `healthy` state | Canvas state assertion during simulated deployment |
| AC-4.1 | R4 (Verification) | Programmatically ping live provisioned URLs & return HTTP 200 | Execute `HealthChecker.runAudit()` against live endpoint |
| AC-4.2 | R4 (Verification) | Verify DB read/write & Valkey cache over private network | Verify private IP ping logs (Postgres HA & Valkey PONG) |
| AC-4.3 | R4 (Verification) | Display verified live URL banner upon audit completion | UI assertion for `#success-banner` element & live link |
