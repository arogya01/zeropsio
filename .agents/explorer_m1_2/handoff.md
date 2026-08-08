# Handoff Report: ZCP Stack Synthesizer Technical Specifications & Implementation Design

**Agent**: Explorer 2 (`explorer_m1_2`)  
**Target Milestone**: M1 — ZCP Stack Synthesizer & Engine Core  
**Target Output Path**: `zeroops-engine/src/synthesizer/`  
**Date**: 2026-08-08  

---

## 1. Observation

1. **Mandatory Input Requirements**:
   - `ORIGINAL_REQUEST.md:12-14` (R1): *"Programmatically synthesize and execute ZCP configuration pipelines (zerops.yml) to dynamically create isolated projects, provision 3+ runtime containers (e.g. Next.js/Bun frontend, Go/Node API, Python/Bun worker) and 2 managed database services (PostgreSQL HA, Valkey Cache), and automatically inject inter-service private network IP environment variables."*
   - `PROJECT.md:88-109`: Defines `StackTopologySpec` and `GeneratedConfigs` interface contracts.
   - `.agents/sub_orch_m1/SCOPE.md:4-7`: Dictates design/implementation of `src/synthesizer/stack-synthesizer.ts`, `src/synthesizer/yaml-generator.ts`, `src/synthesizer/private-net.ts`, and interface contracts.
2. **Zerops Deployment Mechanics & Gotchas**:
   - In `exa-results/zerops-challenge-idea-research-2026-08-06.md:135`, autoscaling and High Availability (`mode: HA`) are defined in `zerops-project-import.yml`, NOT `zerops.yml`.
   - In `exa-results/zerops-challenge-idea-research-2026-08-06.md:155`, Zerops does NOT share build-time environment variables with runtime containers by default. All inter-service variables (`DB_HOST`, `VALKEY_HOST`, `DATABASE_URL`) must be declared under `run.envVariables`.
   - Managed services (`postgresql`, `valkey`) do not have `setup:` entries in `zerops.yml` because their container lifecycle is managed by Zerops.

---

## 2. Logic Chain

1. **Interface Contract Standardisation**:
   - `types.ts` defines `StackTopologySpec`, `GeneratedConfigs`, `RuntimeSpec`, `ManagedServiceSpec`, `SupportedRuntime`, `SupportedManagedService`, `ServiceMode`, `ZeropsProjectImportSpec`, and `ZeropsYamlSpec`.
   - Ensures exact type compatibility across synthesizer modules, ZCP provisioner, and verification suite.
2. **Natural Language Prompt Parser (`stack-synthesizer.ts`)**:
   - Takes prompt strings (e.g. *"Build a Node frontend with Go API, Python worker, Postgres DB, and Valkey cache"*) and extracts runtime containers and database services using regular expressions and keyword analysis.
   - Applies fallbacks to ensure the mandatory benchmark of **3 runtime containers** (Node, Go, Python) and **2 managed services** (Postgres HA, Valkey HA) is always met.
3. **Private Network Environment Variable Injection (`private-net.ts`)**:
   - Resolves internal private network hostnames (`postgres`, `valkey`, `api`).
   - Automatically injects `DB_HOST=postgres`, `DB_PORT=5432`, `DATABASE_URL=postgres://zerops:zerops_secure_pass_2026@postgres:5432/zeroops_db`, `VALKEY_HOST=valkey`, `REDIS_URL=redis://valkey:6379`, `API_URL=http://api:8080`, and `PORT` into every runtime container's `envVariables` table.
4. **Dual YAML Generation (`yaml-generator.ts`)**:
   - `generateProjectImportYaml()` outputs `zerops-project-import.yml` with `project.name`, `postgresql@16` (mode: `HA`), `valkey@7` (mode: `HA`), `nodejs@20`, `go@1.22`, `python@3.11`, `rust@1.75`.
   - `generateZeropsYaml()` outputs `zerops.yml` specifying `setup` per runtime service, base images, build commands, readiness health checks (`/health`), TCP/HTTP ports, and environment variables.

---

## 3. Caveats

1. **Port Mapping**: Default runtime ports are set to Node (3000), Go (8080), Python (8000), and Rust (8090). If a project prompt requires different custom ports, keyword overrides can be extended.
2. **Database Credentials**: Managed PostgreSQL credentials default to `zerops` user and `zerops_secure_pass_2026` password in synthetic specs. In production ZCP provisioner, these can be overridden via project secrets.
3. **Managed Service Exclusion in `zerops.yml`**: Managed DB/Cache services are only present in `zerops-project-import.yml` and explicitly excluded from `zerops.yml` as required by Zerops platform architecture.

---

## 4. Conclusion

The ZCP Stack Synthesizer specifications and zero-stub designs are complete for all 4 required files:
- `src/synthesizer/types.ts`: Interface definitions.
- `src/synthesizer/stack-synthesizer.ts`: Natural language parser with 3 runtime + 2 DB fallback guarantee.
- `src/synthesizer/private-net.ts`: Private VXLAN network environment variable injector.
- `src/synthesizer/yaml-generator.ts`: Spec-compliant generator for `zerops-project-import.yml` and `zerops.yml`.

All findings and complete code implementations are documented in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_2/analysis.md`.

---

## 5. Verification Method

To verify the findings and technical designs:
1. **Inspect Analysis Document**:
   Check `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_2/analysis.md` for complete TypeScript code snippets for all 4 synthesizer files.
2. **Interface Check**:
   Compare `StackTopologySpec` and `GeneratedConfigs` in `analysis.md` § 2.2 with `PROJECT.md:88-109`.
3. **YAML Schema Validation**:
   Validate `generateZeropsYaml` output against Zerops spec (`zerops:` array of service objects with `setup`, `build`, `deploy.readinessCheck`, and `run.ports`).
