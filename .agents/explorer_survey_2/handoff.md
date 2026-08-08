# Handoff Report: Zerops Integration, ZCP, `zerops.yml`, Topology & Wiring Survey

**Agent**: Explorer Survey 2 (`explorer_survey_2`)  
**Target Working Directory**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`  
**Date**: 2026-08-08T17:28:45Z  

---

## 1. Observation

### 1.1 Project Mandate & Core Requirements
From `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md`:
- **Line 5**: *"ZeroOps is a full-stack autonomous cloud factory that synthesizes application code from natural language prompts and programmatically provisions, wires, builds, and deploys a multi-container cloud stack (Frontend + API Gateway + Worker + Managed PostgreSQL + Valkey Cache) live on Zerops via ZCP (Zerops Control Plane) with streaming terminal logs and live health verification."*
- **Line 12-14 (R1)**: *"Programmatically synthesize and execute ZCP (Zerops Control Plane) configuration pipelines (zerops.yml) to dynamically create isolated projects, provision 3+ runtime containers (e.g. Next.js/Bun frontend, Go/Node API, Python/Bun worker) and 2 managed database services (PostgreSQL HA, Valkey Cache), and automatically inject inter-service private network IP environment variables."*
- **Line 26-29**: Acceptance criteria require valid `zerops.yml` files defining at least 3 runtimes and 2 managed services, private IP environment variable configuration (`DB_HOST`, `VALKEY_HOST`), and ZCP API / MCP tool calls.

From `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/orchestrator_r1/context.md`:
- **Line 6**: Engine working directory is `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`.

### 1.2 Zerops Control Plane (ZCP) & API Integration Specifications
From `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/exa-results/zerops-challenge-idea-research-2026-08-06.md`:
- **Line 96-100**: Zerops manages 12 database/storage services (`PostgreSQL`, `MariaDB/MySQL`, `Valkey`, `KeyDB`, `Elasticsearch`, `Typesense`, `Meilisearch`, `Qdrant`, `NATS`, `Kafka`, `ClickHouse`, `S3 Object Storage`) all addressable over a private network by setup hostname (e.g. `db:5432`, `valkey:6379`).
- **Line 102**: Supports 13 runtimes (`Node.js`, `PHP`, `Python`, `Go`, `.NET`, `Rust`, `Java`, `Deno`, `Bun`, `Elixir`, `Gleam`, `Ruby`, `Nginx/Static`) plus `Ubuntu`, `Alpine`, and `Docker` Incus system containers with root access.
- **Line 116**: Zerops REST API endpoint: `https://api.app-prg1.zerops.io/api/rest/public` using Bearer PAT. Published OpenAPI spec at `github.com/zeropsio/openapi` and Go SDK at `github.com/zeropsio/zerops-go`.
- **Line 140-142**: ZCP (`github.com/zeropsio/zcp`, docs at `docs.zerops.io/zcp`) is Zerops' MCP server. Runs as `zcp@1` service in project or locally over VPN (`zcli vpn up`). Supports Claude Code, Codex, Antigravity, Grok Build for deploy/logs/events/env/scale/verify ops.

### 1.3 `zerops.yml` and Project Import Specification
From `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/exa-results/zerops-challenge-idea-research-2026-08-06.md`:
- **Line 126-135**: Exact schema structure for `zerops.yml`:
  ```yaml
  zerops:
    - setup: <hostname> # required
      extends: <other-service>
      build:
        base: <runtime-base>
        os: <ubuntu|alpine>
        prepareCommands: [...]
        buildCommands: [...]
        deployFiles: [...]
        cache: [...]
        addToRunPrepare: [...]
        envVariables: {}
      deploy:
        temporaryShutdown: false
        readinessCheck:
          httpGet:
            path: /health
            port: 8080
      run:
        base: <runtime-base>
        os: <ubuntu|alpine>
        ports:
          - port: 8080
            protocol: TCP
            httpSupport: true
        prepareCommands: [...]
        initCommands: [...]
        start: <command>
        startCommands: [...]
        documentRoot: public
        siteConfigPath: nginx.conf
        envVariables: {}
        envReplace: []
        routing: []
        healthCheck: {}
        crontab: []
  ```
- **Line 135**: Crucial architectural finding: Autoscaling (`verticalAutoscaling`, `horizontalAutoscaling`) and High Availability (HA mode) are **NOT** keys inside `zerops.yml`. They are defined in the **project import YAML** (`zerops-project-import.yml`) or via REST API/GUI calls.

### 1.4 Zerops CLI (`zcli`) Capabilities
From `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/exa-results/zerops-challenge-idea-research-2026-08-06.md`:
- **Line 183**: Key `zcli` commands verified:
  - `zcli login <token>`: Authenticates session.
  - `zcli project import zerops-project-import.yml`: Provisions isolated infrastructure topologies.
  - `zcli push`: Triggers build and zero-downtime deploy based on `zerops.yml`.
  - `zcli service deploy <serviceName> archive.zip`: Directly deploys build artifacts to a target service.
  - `zcli vpn up`: Connects local host via WireGuard directly into project's private VXLAN.
  - `zcli log <serviceName>`: Streams build and runtime logs.

### 1.5 System Environment Verification
- Execution of `which zcli` returned `zcli not found in PATH` on local system.
- Available system runtimes verified via terminal command:
  - Node.js: `v24.11.1`
  - Bun: `1.3.0`
  - Go: `go1.25.0 darwin/arm64`
  - Python: `3.9.6`
  - Rust: `rustc 1.95.0`

---

## 2. Logic Chain

1. **Observed Need**: R1 and R3 require synthesizing multi-container topology specs (`zerops.yml` + project import YAML), injecting private network environment variables, communicating over ZCP/REST API/`zcli`, streaming logs, and executing zero-downtime deployments.
2. **Topology Structure**:
   - Zerops organizes applications into **Projects → Services → Containers**.
   - Each project has an isolated private VXLAN network. Hostnames assigned under `setup` in `zerops.yml` or service names in import YAML (e.g. `frontend`, `api`, `worker`, `postgres`, `valkey`) resolve directly via DNS inside the VXLAN.
3. **Synthesis Separation**:
   - **Infrastructure Provisioning**: Must generate `zerops-project-import.yml` (defining service types like `postgresql@16` with `mode: HA`, `valkey@7` with `mode: HA`, and runtime services like `nodejs@20`, `go@1.22`, `python@3.11`, `rust@1.75`).
   - **Build & Deployment Contract**: Must generate `zerops.yml` containing the build pipeline, run commands, ports, readiness probes, and runtime environment variables for each application container.
4. **Private IP Environment Variable Wiring**:
   - Environment variables must be injected into runtime services via `run.envVariables` in `zerops.yml` or via import secrets.
   - Example wiring for inter-service communication:
     - `DB_HOST: postgres` (resolves to private IP of PostgreSQL HA cluster on port `5432`)
     - `VALKEY_HOST: valkey` (resolves to private IP of Valkey Cache on port `6379`)
     - `API_HOST: api` (resolves to private IP of API service on port `8080`)
5. **Zero-Downtime Deployment Mechanism**:
   - When `zcli push` or REST API deploy is triggered, Zerops spins up parallel container instances, runs `build.buildCommands`, extracts `deployFiles`, starts the runtime process, and probes `deploy.readinessCheck` / `run.healthCheck`.
   - Traffic switches seamlessly to new containers only after HTTP 200 is verified on readiness probes, eliminating downtime.
6. **Engine Architecture Recommendation for `zeroops-engine`**:
   - `zeroops-engine` should include a dedicated `zerops-synthesizer` module that generates both `zerops.yml` and `zerops-project-import.yml`.
   - It should support a mock/simulator mode for `zcli` and ZCP API when running locally without active `zcli` binaries or live Zerops tokens, while providing real HTTP/REST API bindings for production execution.

---

## 3. Caveats

1. **`zcli` Binary Presence**: `zcli` is not pre-installed in the default shell PATH on this machine. The engine must either download/bundle `zcli` CLI binary dynamically, execute via direct Zerops REST API (`https://api.app-prg1.zerops.io/api/rest/public`), or use a Node.js/Go API wrapper.
2. **Build vs. Run Environment Variables**: Zerops does NOT share build-time environment variables (`build.envVariables`) with runtime containers by default. Every variable needed at runtime must be explicitly duplicated under `run.envVariables`.
3. **Scale-to-Zero Absence**: Zerops containers do NOT scale to zero; they run continuously, which ensures zero cold starts for WebSockets and background queue consumers.

---

## 4. Conclusion

Zerops integration for ZeroOps requires a 2-tier YAML synthesis strategy:
1. **`zerops-project-import.yml`**: Provisions project topology (PostgreSQL HA, Valkey HA, Node/Go/Python/Rust runtime containers, CPU/RAM autoscaling limits).
2. **`zerops.yml`**: Configures multi-stage build scripts, run commands, TCP/HTTP ports, readiness checks, and internal private network environment variables (`DB_HOST=postgres`, `VALKEY_HOST=valkey`).

ZeroOps should expose an API client / `zcli` wrapper module in `zeroops-engine` that handles project creation, build pushing, log streaming via WebSockets/REST, and automated health verification.

---

## 5. Verification Method

To verify these findings and synthesized specifications:
1. Inspect `ORIGINAL_REQUEST.md` lines 12-14 (R1) & lines 26-30.
2. Inspect `exa-results/zerops-challenge-idea-research-2026-08-06.md` lines 126-135 (`zerops.yml` syntax) and lines 96-102 (managed services & runtimes).
3. Validate synthesized `zerops.yml` schema against official Zerops documentation at `https://docs.zerops.io/zerops-yaml/specification`.
4. Run validation check on generated YAML files using standard YAML parser (`js-yaml` or `yaml` in Node/Bun).
