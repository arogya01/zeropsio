## 2026-08-08T17:29:36Z
You are Explorer 2 for Milestone M1 (ZCP Stack Synthesizer & Engine Core).
Your working directory is `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_2`. Please create files only in your working directory.

MANDATORY INPUTS TO READ:
1. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md`
2. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/PROJECT.md`
3. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m1/SCOPE.md`

Your Task:
Investigate specifications and design implementation for the Stack Synthesizer module:
- `src/synthesizer/types.ts`: Define `StackTopologySpec`, `RuntimeSpec`, `ManagedServiceSpec`, `GeneratedConfigs`, and related types adhering strictly to `PROJECT.md` § Interface Contracts.
- `src/synthesizer/stack-synthesizer.ts`: Natural language prompt parser. Convert prompts (e.g. "Build a Node frontend with Go API, Python worker, Postgres DB, and Valkey cache") into `StackTopologySpec`. Support prompt keyword analysis, default fallbacks, multi-container detection (Node, Go, Python, Rust runtimes; PostgreSQL HA, Valkey Cache managed services).
- `src/synthesizer/yaml-generator.ts`: Generate valid `zerops-project-import.yml` (project name, service topologies with setup types, high-availability mode for Postgres) and `zerops.yml` (service build and run configurations, ports, env variables) for at least 4 runtimes (nodejs, go, python, rust) and 2 managed services (postgresql, valkey).
- `src/synthesizer/private-net.ts`: Inject inter-service private network IP environment variables (`DB_HOST=postgres`, `VALKEY_HOST=valkey`, `PORT=...`, DB connection strings) automatically into service environment specs.

Write your findings and technical implementation design to `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_2/analysis.md` and deliver your handoff in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/explorer_m1_2/handoff.md`.
Send a message back to parent when complete.
