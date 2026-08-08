# Technical Analysis & Implementation Design: ZCP Client, CLI Entrypoint, and M1 Test Suite

**Agent**: `explorer_m1_3`  
**Milestone**: M1 — ZCP Stack Synthesizer & Engine Core  
**Date**: 2026-08-08  
**Target Path**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`

---

## 1. Executive Summary & Architectural Overview

Milestone M1 establishes the core orchestration engine of **ZeroOps** (`zeroops-engine`). The engine takes natural language prompts and synthesizes a complete multi-container cloud infrastructure specification (`zerops-project-import.yml` and `zerops.yml`), injects private network topology mapping, and programmatically orchestrates deployment via the ZCP (Zerops Control Plane) API / `zcli`.

This analysis provides the technical implementation design for:
1. **`src/zcp/zcp-client.ts`**: Dual-mode (`real` and `mock`) ZCP API & `zcli` orchestration bridge.
2. **`src/index.ts`**: Executable CLI & programmatic engine entry point.
3. **Comprehensive Unit & Integration Test Design**: Full coverage plan across all M1 components (`stack-synthesizer`, `yaml-generator`, `private-net`, `zcp-client`, and `index.ts`).

### Data & Control Flow Architecture

```
                               ┌─────────────────────────┐
                               │   CLI Command / API     │
                               │ (`src/index.ts` entry)  │
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │    StackSynthesizer     │
                               │  (NL Prompt -> Spec)    │
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │   PrivateNetInjector    │
                               │ (Inject DB_HOST, IPs)   │
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │      YamlGenerator      │
                               │ (import.yml & zerops.yml)│
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │       ZcpClient         │
                               │  (Real API / Mock mode) │
                               └───────┬─────────┬───────┘
                                       │         │
                   ┌───────────────────┘         └───────────────────┐
                   ▼                                                 ▼
     ┌───────────────────────────┐                     ┌───────────────────────────┐
     │      Real Mode (ZCP)      │                     │         Mock Mode         │
     │ - REST API (fetch/axios)  │                     │ - Simulated Import        │
     │ - zcli child process      │                     │ - Mock IP Mapping         │
     │ - Real Zerops Cloud Stack │                     │ - Simulated Deployment    │
     └───────────────────────────┘                     └───────────────────────────┘
```

---

## 2. ZCP Client Architecture (`src/zcp/zcp-client.ts`)

The `ZcpClient` module bridges `zeroops-engine` with the Zerops Control Plane. It must operate deterministically in two distinct modes:
- **`real` mode**: Interacts directly with Zerops REST API endpoints or shells out to `zcli` binary when `ZEROPS_TOKEN` or `zcli` binary is available.
- **`mock` mode**: Simulates all cloud infrastructure operations in memory (project creation, service provisioning, IP mapping, build/deployment log streaming) to guarantee 100% testability and zero-dependency local execution.

### 2.1 Interface & Type Definitions (`src/zcp/types.ts` & `src/zcp/zcp-client.ts`)

```typescript
export type ZcpClientMode = 'real' | 'mock';

export interface ZcpClientConfig {
  mode?: ZcpClientMode;
  apiToken?: string;
  apiBaseUrl?: string; // default: 'https://api.zerops.io/v1'
  timeoutMs?: number;  // default: 30000
  zcliPath?: string;   // default: 'zcli'
}

export interface ZcpProjectInfo {
  id: string;
  name: string;
  orgId: string;
  status: 'CREATING' | 'READY' | 'ERROR';
  createdAt: string;
  services: ZcpServiceInfo[];
}

export interface ZcpServiceInfo {
  id: string;
  name: string;
  type: 'nodejs' | 'go' | 'python' | 'rust' | 'postgresql' | 'valkey';
  mode?: 'HA' | 'SINGLE';
  privateIp: string;
  ports: number[];
  status: 'BUILDING' | 'DEPLOYING' | 'RUNNING' | 'FAILED';
}

export interface ZcpDeploymentResult {
  deploymentId: string;
  serviceName: string;
  status: 'SUCCESS' | 'FAILED';
  publicUrl?: string;
  privateIp: string;
  logs: string[];
  durationMs: number;
}

export interface ZcpProjectStatus {
  projectId: string;
  name: string;
  status: 'CREATING' | 'READY' | 'DEPLOYING' | 'ACTIVE' | 'ERROR';
  services: Record<string, ZcpServiceInfo>;
}

export interface PrivateTopologyMap {
  [serviceName: string]: {
    privateIp: string;
    port: number;
    connectionString?: string;
  };
}
```

### 2.2 Mode Selection & Automatic Fallback Mechanism

```typescript
export class ZcpClient {
  private mode: ZcpClientMode;
  private apiToken: string | null;
  private apiBaseUrl: string;
  private timeoutMs: number;
  private zcliPath: string;

  // In-memory state for mock mode persistence
  private mockProjects: Map<string, ZcpProjectInfo> = new Map();
  private mockDeployments: Map<string, ZcpDeploymentResult> = new Map();

  constructor(config: ZcpClientConfig = {}) {
    this.apiToken = config.apiToken || process.env.ZEROPS_TOKEN || null;
    this.apiBaseUrl = config.apiBaseUrl || 'https://api.zerops.io/v1';
    this.timeoutMs = config.timeoutMs || 30000;
    this.zcliPath = config.zcliPath || 'zcli';

    // Auto-detect mode if not explicitly specified
    if (config.mode) {
      this.mode = config.mode;
    } else if (this.apiToken) {
      this.mode = 'real';
    } else {
      this.mode = 'mock';
    }

    // Safety fallback: if real mode requested but no token available, fallback to mock with warning
    if (this.mode === 'real' && !this.apiToken) {
      console.warn('[ZcpClient] WARN: Real mode requested but ZEROPS_TOKEN is missing. Falling back to mock mode.');
      this.mode = 'mock';
    }
  }

  public getMode(): ZcpClientMode {
    return this.mode;
  }
}
```

### 2.3 Core Methods Implementation Design

#### 1. `importProject(importYaml: string): Promise<ZcpProjectInfo>`
- **Real Mode Workflow**:
  1. Sends HTTP POST to `${this.apiBaseUrl}/project/import` with `Authorization: Bearer ${this.apiToken}` and content type `application/x-yaml`.
  2. Alternatively shells out via `child_process.execFile(this.zcliPath, ['project', 'import', tempYamlPath])`.
  3. Parses response JSON to extract project ID and created service list.
- **Mock Mode Workflow**:
  1. Uses `js-yaml` to parse `importYaml`.
  2. Extracts `project.name` and array of items under `services`.
  3. Generates deterministic mock project ID: `proj_${name}_${Date.now().toString(36)}`.
  4. Assigns synthetic private IPs on subnet `10.0.0.0/24`:
     - Database (`postgres`): `10.0.0.10:5432`
     - Cache (`valkey`): `10.0.0.11:6379`
     - API (`api`): `10.0.0.12:3000`
     - Frontend (`frontend`): `10.0.0.13:3000`
     - Worker (`worker`): `10.0.0.14:3000`
  5. Saves project record in `this.mockProjects` map and returns `ZcpProjectInfo`.

#### 2. `deployService(serviceName: string, zeropsYaml: string): Promise<ZcpDeploymentResult>`
- **Real Mode Workflow**:
  1. Prepares deployment archive (tar.gz/zip) or passes `zerops.yml` to `zcli push <serviceName>`.
  2. Returns deployment ID for status tracking.
- **Mock Mode Workflow**:
  1. Creates mock deployment ID `dep_${serviceName}_${Math.random().toString(36).substring(2, 8)}`.
  2. Generates public URL for frontend/gateway runtimes: `https://${serviceName}-${Math.random().toString(36).substring(2, 6)}.zerops.app`.
  3. Generates build logs sequence:
     ```
     [system] Initializing build pipeline for service: ${serviceName}
     [system] Parsing zerops.yml build commands...
     [build] Running npm install / go build / pip install...
     [build] Build completed successfully in 1.4s.
     [deploy] Container image pushed to Zerops registry.
     [deploy] Provisioning container slot on private network...
     [system] Service ${serviceName} is live and HEALTHY.
     ```
  4. Stores result in `this.mockDeployments` and returns `ZcpDeploymentResult`.

#### 3. `pollDeploymentStatus(deploymentId: string, timeoutMs?: number, onLog?: (msg: string) => void): Promise<ZcpDeploymentResult>`
- **Real Mode Workflow**:
  1. Repeatedly GETs `${this.apiBaseUrl}/deployment/${deploymentId}` every 2 seconds until status is `SUCCESS` or `FAILED`.
  2. Calls `onLog` callback with newly fetched log lines.
- **Mock Mode Workflow**:
  1. Simulates progress steps with `await new Promise(res => setTimeout(res, stepDelay))`.
  2. Fires `onLog` callback for each simulated log chunk.
  3. Resolves with stored `ZcpDeploymentResult`.

#### 4. `getPrivateTopology(projectId: string): Promise<PrivateTopologyMap>`
- **Mock & Real Mode Output Structure**:
  ```json
  {
    "postgres": {
      "privateIp": "10.0.0.10",
      "port": 5432,
      "connectionString": "postgresql://root:password@10.0.0.10:5432/appdb"
    },
    "valkey": {
      "privateIp": "10.0.0.11",
      "port": 6379,
      "connectionString": "redis://10.0.0.11:6379"
    },
    "api": {
      "privateIp": "10.0.0.12",
      "port": 3000
    },
    "frontend": {
      "privateIp": "10.0.0.13",
      "port": 3000
    },
    "worker": {
      "privateIp": "10.0.0.14",
      "port": 3000
    }
  }
  ```

---

## 3. Engine CLI Entrypoint Architecture (`src/index.ts`)

`src/index.ts` is both an executable bin entry point (with `#!/usr/bin/env node`) and a library export file.

### 3.1 CLI Options & Command Design

Using `commander` library:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { StackSynthesizer } from './synthesizer/stack-synthesizer';
import { YamlGenerator } from './synthesizer/yaml-generator';
import { PrivateNetInjector } from './synthesizer/private-net';
import { ZcpClient } from './zcp/zcp-client';

const program = new Command();

program
  .name('zeroops-engine')
  .description('ZeroOps Autonomous Cloud Factory Engine & ZCP Orchestrator')
  .version('1.0.0');

// Global Options
program
  .option('--mock', 'Force mock mode execution', false)
  .option('-o, --output <dir>', 'Output directory for generated YAML and code files', './output')
  .option('--json', 'Output results formatted as JSON to stdout', false)
  .option('--verbose', 'Enable verbose logging output', false);
```

### 3.2 CLI Commands Workflow

#### Command 1: `synthesize <prompt>`
- **Usage**: `zeroops-engine synthesize "Build Next.js app with Go API, Python worker, Postgres, and Valkey" -o ./dist-app --json`
- **Execution Flow**:
  1. `StackSynthesizer.synthesize(prompt)` -> parses prompt to `StackTopologySpec`.
  2. `PrivateNetInjector.inject(spec)` -> populates `DB_HOST`, `VALKEY_HOST`, `PORT` in runtime env specs.
  3. `YamlGenerator.generate(spec)` -> produces `zeropsProjectImportYaml` and `zeropsYaml`.
  4. Writes YAML files to output directory: `<outputDir>/zerops-project-import.yml` and `<outputDir>/zerops.yml`.
  5. If `--json` flag is present: outputs JSON payload `{ success: true, spec, configs, filesWritten: [...] }`.
  6. Otherwise prints human-readable ANSI colored summary table to stdout.

#### Command 2: `deploy <project-name>`
- **Usage**: `zeroops-engine deploy my-app --output ./dist-app --mock`
- **Execution Flow**:
  1. Reads `zerops-project-import.yml` and `zerops.yml` from `--output` directory (or prompts synthesize if missing).
  2. Instantiates `ZcpClient({ mode: options.mock ? 'mock' : undefined })`.
  3. Calls `zcpClient.importProject(importYaml)`.
  4. Iterates through services and calls `zcpClient.deployService(serviceName, zeropsYaml)`.
  5. Polls deployment status while streaming logs to stdout (or buffer if `--json`).
  6. Fetches private topology via `zcpClient.getPrivateTopology(projectId)`.
  7. Outputs final deployment result object containing verified live URL and private IP topology map.

#### Command 3: `import <yaml-path>`
- **Usage**: `zeroops-engine import ./zerops-project-import.yml --mock --json`
- **Execution Flow**:
  1. Validates that `<yaml-path>` exists on disk.
  2. Reads file contents.
  3. Instantiates `ZcpClient`.
  4. Calls `zcpClient.importProject(content)`.
  5. Outputs imported project metadata (`ZcpProjectInfo`).

### 3.3 Programmatic API Exports (`src/index.ts` Library Exports)

```typescript
// Export modules for programmatic consumption by Web Studio server or tests
export { StackSynthesizer } from './synthesizer/stack-synthesizer';
export { YamlGenerator } from './synthesizer/yaml-generator';
export { PrivateNetInjector } from './synthesizer/private-net';
export { ZcpClient } from './zcp/zcp-client';
export * from './synthesizer/types';
export * from './zcp/types';

// High-level engine runner functions
export async function runSynthesis(prompt: string, outputDir: string): Promise<any>;
export async function runDeployment(projectName: string, outputDir: string, isMock: boolean): Promise<any>;
export async function runImport(yamlPath: string, isMock: boolean): Promise<any>;
```

---

## 4. Comprehensive Unit & Integration Test Design for M1

To ensure 100% test coverage and zero regression, test suites are designed using `vitest` (or `jest`). All test cases use isolated test environments, mock fixtures, and clean setup/teardown hooks.

### 4.1 `tests/synthesizer/stack-synthesizer.test.ts`

| Test Case ID | Scenario / Input | Expected Output / Assertion |
|--------------|------------------|-----------------------------|
| `TC-SYN-01` | Full prompt: *"Build a Next.js frontend with Go API gateway, Python background worker, Postgres DB, and Valkey cache"* | Parses `runtimes`: [Node.js, Go, Python] and `managedServices`: [PostgreSQL HA, Valkey]. Total 5 services. |
| `TC-SYN-02` | Minimal/Vague prompt: *"Create a simple web app"* | Triggers default fallback spec containing Node.js frontend, Go API, Python worker, PostgreSQL HA, Valkey Cache. |
| `TC-SYN-03` | Multi-runtime variations: prompt specifying Rust API and Bun frontend | Parses `rust` API runtime and `bun`/`nodejs` frontend runtime correctly. |
| `TC-SYN-04` | Invalid/empty prompt string `""` | Does not crash; applies default valid stack topology spec with warning. |
| `TC-SYN-05` | Custom ports specification in prompt | Successfully extracts custom port mappings (e.g. `8080`, `5000`) if mentioned in prompt. |

### 4.2 `tests/synthesizer/yaml-generator.test.ts`

| Test Case ID | Scenario / Input | Expected Output / Assertion |
|--------------|------------------|-----------------------------|
| `TC-YML-01` | Generate `zerops-project-import.yml` from 5-service `StackTopologySpec` | Parsed with `js-yaml.load()`. `project.name` matches spec. Contains 3 runtime setups and 2 managed service setups (`postgresql` with `mode: HA` and `valkey` with `mode: SINGLE`). |
| `TC-YML-02` | Generate `zerops.yml` for Node, Go, Python, Rust runtimes | Parsed with `js-yaml.load()`. Contains valid `build` and `run` commands for each runtime key. |
| `TC-YML-03` | Validate YAML formatting and syntax | Ensures no trailing syntax errors, invalid indentation, or unescaped characters occur. |
| `TC-YML-04` | Port and Environment Variable bindings | `zerops.yml` includes designated port definitions and environment variable placeholders. |

### 4.3 `tests/synthesizer/private-net.test.ts`

| Test Case ID | Scenario / Input | Expected Output / Assertion |
|--------------|------------------|-----------------------------|
| `TC-NET-01` | Inject private network env vars into `StackTopologySpec` | Adds `DB_HOST=postgres`, `VALKEY_HOST=valkey`, `DB_PORT=5432`, `VALKEY_PORT=6379` to runtime `envVariables`. |
| `TC-NET-02` | Connection string construction | Injects `DATABASE_URL=postgresql://root:password@postgres:5432/appdb` and `VALKEY_URL=redis://valkey:6379`. |
| `TC-NET-03` | Idempotency verification | Executing `PrivateNetInjector.inject()` twice on the same spec results in identical, non-duplicated environment variable maps. |
| `TC-NET-04` | Multi-runtime env mapping | Verifies all runtimes (Frontend, API, Worker) receive identical DB and Cache private hostnames. |

### 4.4 `tests/zcp/zcp-client.test.ts`

| Test Case ID | Scenario / Input | Expected Output / Assertion |
|--------------|------------------|-----------------------------|
| `TC-ZCP-01` | Mock mode `importProject(importYaml)` | Returns `ZcpProjectInfo` with deterministic project ID, status `READY`, and assigned private IPs (`10.0.0.10` - `10.0.0.14`). |
| `TC-ZCP-02` | Mock mode `deployService("frontend", zeropsYaml)` | Returns `ZcpDeploymentResult` with status `SUCCESS`, live mock Zerops URL (`https://frontend-xxx.zerops.app`), and build log array. |
| `TC-ZCP-03` | Mock mode `pollDeploymentStatus(deploymentId, 5000, onLog)` | Invokes `onLog` callback multiple times with log messages and resolves with `SUCCESS`. |
| `TC-ZCP-04` | Real mode fallback when `ZEROPS_TOKEN` missing | Instantiating `new ZcpClient({ mode: 'real' })` without token logs warning and sets `getMode()` to `'mock'`. |
| `TC-ZCP-05` | Real mode REST API call mocking | Mocks `fetch` to `${apiBaseUrl}/project/import`. Verifies `Authorization` header and payload formatting. |
| `TC-ZCP-06` | `getPrivateTopology(projectId)` | Returns `PrivateTopologyMap` with matching IP/port mapping for all services in project. |

### 4.5 `tests/cli/index.test.ts` (CLI Integration Tests)

| Test Case ID | Scenario / Command Execution | Expected Output / Assertion |
|--------------|------------------------------|-----------------------------|
| `TC-CLI-01` | `zeroops-engine synthesize "Build blog platform" --mock --json -o ./tmp-test-1` | Exit code 0. Standard output contains valid JSON object with `success: true`. Files `zerops-project-import.yml` and `zerops.yml` created in `./tmp-test-1`. |
| `TC-CLI-02` | `zeroops-engine deploy my-blog --output ./tmp-test-1 --mock --json` | Exit code 0. JSON output contains `deploymentId`, `liveUrl`, and `topology`. |
| `TC-CLI-03` | `zeroops-engine import ./tmp-test-1/zerops-project-import.yml --mock --json` | Exit code 0. Output contains imported `projectId` and `services`. |
| `TC-CLI-04` | Invalid command `zeroops-engine invalid-cmd` | Exit code 1 (or 2 for commander usage error). Stderr contains error message. |
| `TC-CLI-05` | `--help` flag execution | Exit code 0. Stdout prints usage information and list of commands. |

---

## 5. Verification Method

To verify this implementation design:
1. **Module Contract Verification**: Ensure types in `src/zcp/types.ts` and `src/synthesizer/types.ts` align with `PROJECT.md` § Interface Contracts.
2. **Mock Mode Verification**: Verify `ZcpClient` in `mock` mode generates valid synthetic private IP topology (`10.0.0.x`) and public Zerops URLs without requiring active network connectivity or ZCP credentials.
3. **CLI Options Verification**: Validate that `synthesize`, `deploy`, and `import` CLI commands accept `--mock`, `--output`, and `--json` flags and operate predictably.
4. **Test Suite Verification**: Run `npm test` once implementers create the test files to verify all 22 test cases pass cleanly.
