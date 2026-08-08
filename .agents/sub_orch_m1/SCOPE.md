# Scope: Milestone M1 — ZCP Stack Synthesizer & Engine Core
Status: **COMPLETED**

## Scope Description
Initialize `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine` workspace, create `package.json`, `tsconfig.json`, build scripts, and implement:
1. `src/synthesizer/stack-synthesizer.ts`: Natural language prompt parser to stack topology specification.
2. `src/synthesizer/yaml-generator.ts`: `zerops-project-import.yml` and `zerops.yml` generator for 3+ runtimes (Node, Go, Python, Rust) and 2 managed services (PostgreSQL HA, Valkey Cache).
3. `src/synthesizer/private-net.ts`: Automatic injection of private IP environment variables (`DB_HOST=postgres`, `VALKEY_HOST=valkey`, `PORT`).
4. `src/zcp/zcp-client.ts`: ZCP API & `zcli` orchestration bridge (with real & mock execution modes).

## Interface Contracts
- Must implement `StackTopologySpec` and `GeneratedConfigs` interfaces from `PROJECT.md`.
- Must export runnable CLI / engine entry point in `src/index.ts`.

## Code Layout Ownership
- `zeroops-engine/package.json`
- `zeroops-engine/tsconfig.json`
- `zeroops-engine/src/index.ts`
- `zeroops-engine/src/synthesizer/*`
- `zeroops-engine/src/zcp/*`
