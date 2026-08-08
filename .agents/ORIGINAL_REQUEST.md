# Original User Request

## 2026-08-08T17:26:56Z

ZeroOps is a full-stack autonomous cloud factory that synthesizes application code from natural language prompts and programmatically provisions, wires, builds, and deploys a multi-container cloud stack (Frontend + API Gateway + Worker + Managed PostgreSQL + Valkey Cache) live on Zerops via ZCP (Zerops Control Plane) with streaming terminal logs and live health verification.

Working directory: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine
Integrity mode: demo

## Requirements

### R1. Autonomous Multi-Container Stack Orchestration via ZCP
Programmatically synthesize and execute ZCP (Zerops Control Plane) configuration pipelines (zerops.yml) to dynamically create isolated projects, provision 3+ runtime containers (e.g. Next.js/Bun frontend, Go/Node API, Python/Bun worker) and 2 managed database services (PostgreSQL HA, Valkey Cache), and automatically inject inter-service private network IP environment variables.

### R2. Full-Stack Code & Schema Synthesizer
Generate complete, functional, multi-service application code templates (UI components, REST/gRPC API routes, background queue consumers, database schema migrations) tailored to the user's prompt request without placeholders or dummy stubs.

### R3. Real-Time Interactive Studio & Log Streaming Studio
Provide a sleek dark-mode Web Studio featuring a live 3D/2D container topology canvas, real-time WebSocket build/runtime terminal log streaming (xterm.js), and instant zero-downtime deployment triggers.

### R4. Automated Live Verification & Health Auditing
Execute programmatic health checks against live provisioned Zerops URLs, verifying HTTP status 200 responses, database connectivity over the internal private network, and queue processing end-to-end.

## Acceptance Criteria

### Infrastructure & ZCP Integration
- [ ] Successfully calls ZCP API / MCP tools to import, configure, and provision projects.
- [ ] Generates valid zerops.yml files defining at least 3 runtimes and 2 managed services.
- [ ] Configures internal private network environment variables (DB_HOST, VALKEY_HOST) for isolated service communication.

### Web Studio & Developer Experience
- [ ] Interactive studio UI renders real-time build logs via WebSockets/terminal.
- [ ] Displays live animated container topology map showing service health states.
- [ ] Returns a verified live HTTP URL upon successful deployment.

### Quality & Code Completeness
- [ ] All synthesized frontend, API, worker, and SQL migration files are complete and runnable.
- [ ] Automated health-check suite verifies live HTTP 200 response and database read/write on Zerops.
- [ ] Includes project documentation and a demo video storyboard script.

## 2026-08-08T18:40:32Z

ZeroOps Studio Multi-Tenant Cloud Engine allows developers to log in, connect their own Zerops account via Personal Access Token, and deploy multi-container cloud stacks (Next.js/Bun, Go API, Python Worker, PostgreSQL, Valkey Cache) to their own infrastructure from pre-built templates or prompts.

Working directory: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine
Integrity mode: demo

## Requirements

### R1. Minimal Session Auth & BYO Zerops Token Onboarding
Provide simple session authentication (email/password login/signup) and an onboarding overlay where users paste their Zerops Personal Access Token. Store the token per-session and use it for all subsequent zcli deployment operations.

### R2. Pre-Built Full-Stack Template Library (1-Click Deploy)
Provide a 1-click template launcher with 3 complete multi-container stacks:
1. AI Video Clipper (Next.js + Go REST API + Python Whisper worker + PostgreSQL + Valkey)
2. Multi-Service E-Commerce (Bun storefront + Go Order API + Python Rec worker + PostgreSQL + Valkey)
3. RAG Search Engine (React + FastAPI + Python Embedder + PostgreSQL pgvector + Valkey)

### R3. Real-Time zcli Log Streaming & Workbench Studio UI
Maintain the bolt.new-inspired split-pane UI: left panel with chat/pipeline feed and bottom-pinned prompt input; right panel with tabbed Terminal (streaming real zcli stdout/stderr), zerops.yml viewer, and Code Inspector, with a persistent bottom topology strip.

### R4. Verification & Health Audit Suite
Programmatically execute automated HTTP health checks against provisioned endpoints upon deployment completion, verifying container readiness and returning live URLs.

## Acceptance Criteria

### Auth & Token Management
- [ ] Users can sign up / log in and input their Zerops Personal Access Token.
- [ ] zcli project project-import executes using the user's specific token.

### Template & Studio Functionality
- [ ] 3 templates render in the Studio and trigger 5-container imports.
- [ ] WebSocket streams live zcli terminal output to the workbench console.
- [ ] All 5 topology chips transition from building to healthy state upon completion.
