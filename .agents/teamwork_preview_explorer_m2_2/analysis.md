# Analysis Report: Milestone M2 — Template Synthesis & Code Generation Architecture

**Author**: Explorer 2 (Milestone M2)  
**Target Path**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/code-gen/`  
**Date**: 2026-08-08  

---

## 1. Executive Summary

Milestone M2 ("Full-Stack Code & Schema Synthesizer") introduces the code generation core for ZeroOps Engine. While Milestone M1 provisions the infrastructure layer (ZCP project import and `zerops.yml`), M2 generates the actual **runnable application source code and database migrations** that get deployed into those runtime containers.

The `src/code-gen/` module consists of three main typescript modules:
1. `src/code-gen/types.ts`: Shared interface definitions for code artifacts, entity models, template contexts, and synthesized code bundles.
2. `src/code-gen/template-generator.ts`: Domain-specific generators producing production-ready React/Tailwind UI components, Node/Express/TypeScript & gRPC API handlers, BullMQ queue workers, and syntactically valid PostgreSQL `.sql` DDL migrations.
3. `src/code-gen/code-synthesizer.ts`: Multi-service assembly engine that translates a `StackTopologySpec` into a complete, file-system-ready multi-container project layout containing all code, configuration files (`package.json`, `tsconfig.json`), and database scripts.

All generated output strictly complies with ZeroOps' **Zero-Stub Policy**: zero `// TODO` markers, zero empty handlers, zero placeholder stubs, and 100% functional implementations ready for production deployment.

---

## 2. Interface Contracts & Data Types (`src/code-gen/types.ts`)

```typescript
/**
 * src/code-gen/types.ts
 * Interfaces for Code Artifacts, Template Generators, and Synthesized Bundles.
 */

export type TargetLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'sql'
  | 'html'
  | 'css'
  | 'json'
  | 'proto';

export type ComponentCategory =
  | 'ui'
  | 'api-rest'
  | 'api-grpc'
  | 'worker-queue'
  | 'sql-migration'
  | 'config'
  | 'proto';

/**
 * Single generated file unit
 */
export interface CodeArtifact {
  filePath: string;       // Relative path within workspace (e.g. "services/api/src/routes/items.ts")
  content: string;        // Complete source code string
  language: TargetLanguage;
  category: ComponentCategory;
  description: string;
}

/**
 * Domain Field Definition for Entity Code Generation
 */
export interface EntityFieldSpec {
  name: string;           // e.g. "title", "status", "price"
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'uuid' | 'json';
  required: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  defaultValue?: string;
  validationRegex?: string;
}

/**
 * Domain Entity Definition (e.g. Task, Product, User, Order)
 */
export interface EntitySpec {
  name: string;           // Singular e.g. "Task"
  pluralName: string;     // Plural e.g. "tasks"
  tableName: string;      // Database table name e.g. "tasks"
  description: string;
  fields: EntityFieldSpec[];
}

/**
 * Context passed into template generators
 */
export interface TemplateContext {
  projectName: string;
  entities: EntitySpec[];
  apiPort?: number;
  frontendPort?: number;
  workerPort?: number;
  dbHostEnv?: string;
  dbPortEnv?: string;
  dbUserEnv?: string;
  dbPassEnv?: string;
  dbNameEnv?: string;
  valkeyHostEnv?: string;
  valkeyPortEnv?: string;
}

/**
 * Complete Multi-Service Generated Code Bundle
 */
export interface GeneratedCodeBundle {
  projectName: string;
  artifacts: CodeArtifact[];
  manifest: {
    totalFiles: number;
    totalLines: number;
    services: string[];   // e.g. ["frontend", "api", "worker", "db"]
    generatedAt: string;  // ISO timestamp
    hasZeroStubs: boolean;
  };
}

/**
 * Options for CodeSynthesizer invocation
 */
export interface CodeGenOptions {
  projectName?: string;
  prompt?: string;
  outputDir?: string;
  entities?: EntitySpec[];
  enableGrpc?: boolean;
  enableQueue?: boolean;
}
```

---

## 3. Template Generator Specifications (`template-generator.ts`)

`template-generator.ts` exposes functions targeting the four key application tiers:

### 3.1 Frontend UI Generator (`generateFrontendUI`)
- **Technology**: React (TSX/JSX) + Tailwind CSS + HTML5 + Fetch API.
- **Output Artifacts**:
  - `services/frontend/public/index.html`: Responsive HTML entry point with Tailwind CDN / link and root container.
  - `services/frontend/src/App.tsx`: Top-level application layout featuring Header navigation, Live System Status banner (pinging backend `/api/health`), Metric Summary Cards, Search & Filter controls, and Tabbed View.
  - `services/frontend/src/components/ItemManager.tsx`: Interactive CRUD view with dynamic state (`useState`, `useEffect`), asynchronous modal for creation, input validation, loading skeletons, and real-time refresh buttons.
  - `services/frontend/src/components/MetricsCard.tsx`: Reusable Tailwind card component displaying active tasks, completion rate, system status, and queue depth.
- **Styling Specs**:
  - Dark mode aesthetic (`bg-slate-900`, `text-slate-100`, `border-slate-800`, `accent-indigo-500`).
  - Active hover states, focus rings, disabled loading states.
- **Zero-Stub Enforcement**:
  - `fetch('/api/v1/items')` has complete `try / catch / finally` blocks setting `items` state or showing clear user-facing error banners.
  - Form submit handler parses formData, constructs JSON payload, calls `POST /api/v1/items`, and triggers list reload upon HTTP 201 response.

### 3.2 REST & gRPC API Handler Generator (`generateApiHandlers`)
- **Technology**: Node.js + TypeScript + Express + `pg` (Postgres Pool) + `ioredis` (Valkey Cache) + `@grpc/grpc-js`.
- **Output Artifacts**:
  - `services/api/src/server.ts`: Express application setup, CORS, JSON middleware, route mounting, central error handler, and HTTP server startup listening on port `8080`.
  - `services/api/src/db.ts`: PostgreSQL `Pool` initialization using environment variables injected by Zerops (`process.env.DB_HOST`, `process.env.DB_PORT`, etc.) with reconnection resilience.
  - `services/api/src/cache.ts`: Valkey/Redis client initialization (`process.env.VALKEY_HOST`) with fallback ping check.
  - `services/api/src/routes/health.ts`: Comprehensive health check endpoint (`GET /health`) checking DB `SELECT 1` and Valkey `PING`, returning HTTP 200 with latency telemetry.
  - `services/api/src/routes/items.ts`: Complete REST CRUD handler:
    * `GET /api/v1/items`: Checks Valkey cache (`items:all`). If cache miss, queries Postgres `SELECT * FROM items ORDER BY created_at DESC`, sets Valkey cache with TTL 60s, returns HTTP 200.
    * `GET /api/v1/items/:id`: Validates UUID parameter, queries DB, returns HTTP 200 or 404.
    * `POST /api/v1/items`: Validates body using Zod schema, executes `INSERT INTO items (...) VALUES (...) RETURNING *`, invalidates Valkey cache, enqueues background processing job to BullMQ queue, returns HTTP 201.
    * `PUT /api/v1/items/:id`: Executes `UPDATE items SET ... WHERE id = $1 RETURNING *`, invalidates cache, returns HTTP 200.
    * `DELETE /api/v1/items/:id`: Executes `DELETE FROM items WHERE id = $1`, invalidates cache, returns HTTP 204.
  - `services/api/src/grpc/items.proto`: Syntactically valid Protocol Buffers v3 schema definition.
  - `services/api/src/grpc/server.ts`: `@grpc/grpc-js` server implementing `GetItem`, `ListItem`, `CreateItem` RPC methods mapped directly to database pool queries.

### 3.3 Background Worker Queue Consumer Generator (`generateWorkerConsumer`)
- **Technology**: Node.js / TypeScript + BullMQ + Redis/Valkey + PostgreSQL pool.
- **Output Artifacts**:
  - `services/worker/src/worker.ts`: BullMQ `Worker` instance listening to queue name `task-processing-queue` connected to Valkey (`process.env.VALKEY_HOST`).
  - `services/worker/src/processor.ts`: Concrete async task processor logic:
    1. Extracts `job.data` payload (e.g. `{ itemId: "...", action: "PROCESS_METRICS" }`).
    2. Executes DB update via Postgres Pool (`UPDATE items SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`).
    3. Publishes event notification to Redis Pub/Sub channel (`events:item_updated`).
    4. Handles retries with exponential backoff and error logging.
  - `services/worker/src/health.ts`: Worker liveness heartbeat writer updating Valkey key `worker:heartbeat` every 10 seconds.
  - Process signal management: `SIGTERM` and `SIGINT` listeners executing `await worker.close()` for graceful shutdown.

### 3.4 PostgreSQL Schema Migrations Generator (`generateSqlMigrations`)
- **Technology**: PostgreSQL 16 compatible DDL (`.sql` scripts).
- **Output Artifacts**:
  - `db/migrations/001_initial_schema.sql`:
    * `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
    * `CREATE TYPE item_status AS ENUM ('pending', 'processing', 'completed', 'failed');`
    * `CREATE TABLE items (...)` with:
      - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
      - `title VARCHAR(255) NOT NULL`
      - `description TEXT`
      - `status item_status NOT NULL DEFAULT 'pending'`
      - `metadata JSONB DEFAULT '{}'::jsonb`
      - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
      - `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
      - Constraints: `CONSTRAINT chk_title_length CHECK (char_length(title) >= 1)`
  - `db/migrations/002_indexes_and_triggers.sql`:
    * `CREATE INDEX idx_items_status ON items(status);`
    * `CREATE INDEX idx_items_created_at ON items(created_at DESC);`
    * `CREATE INDEX idx_items_metadata ON items USING GIN(metadata);`
    * `CREATE OR REPLACE FUNCTION update_timestamp() RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql;`
    * `CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_timestamp();`
  - `db/migrations/003_seed_data.sql`:
    * Real, valid DDL `INSERT INTO items (id, title, description, status) VALUES (...) ON CONFLICT DO NOTHING;` to guarantee instant testability.

---

## 4. Code Synthesizer Specification (`code-synthesizer.ts`)

`code-synthesizer.ts` integrates the individual generators and orchestrates file tree creation.

### 4.1 Assembly Algorithm & Pipeline
1. **Context Extraction**: Accepts user prompt or `StackTopologySpec`. Identifies entities (or infers default entity like `Task` / `Item` if unspecified).
2. **Template Invocation**: Calls `generateFrontendUI()`, `generateApiHandlers()`, `generateWorkerConsumer()`, and `generateSqlMigrations()`.
3. **Configuration Generation**: Generates supporting build and runtime configuration files for each container service:
   - `services/frontend/package.json`, `services/frontend/tsconfig.json`
   - `services/api/package.json`, `services/api/tsconfig.json`
   - `services/worker/package.json`, `services/worker/tsconfig.json`
   - `.env.example` documenting Zerops private IP env vars (`DB_HOST`, `DB_PORT`, `VALKEY_HOST`, `VALKEY_PORT`).
4. **Zero-Stub Audit Pass**: Passes all synthesized code artifacts through `stub-validator.ts` to confirm 100% stub compliance.
5. **Bundle Construction**: Packages artifacts into `GeneratedCodeBundle`.
6. **Disk Emission (Optional)**: If `outputDir` is specified, writes all files to disk preserving relative directory hierarchy.

### 4.2 File Emission Tree Structure

```
<outputDir>/
├── services/
│   ├── frontend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── public/
│   │   │   └── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── index.css
│   │       └── components/
│   │           ├── ItemManager.tsx
│   │           └── MetricsCard.tsx
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── db.ts
│   │       ├── cache.ts
│   │       ├── queue.ts
│   │       ├── routes/
│   │       │   ├── health.ts
│   │       │   └── items.ts
│   │       └── grpc/
│   │           ├── items.proto
│   │           └── server.ts
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── worker.ts
│           ├── processor.ts
│           └── health.ts
└── db/
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_indexes_and_triggers.sql
        └── 003_seed_data.sql
```

---

## 5. Zero-Stub Audit Integration (`stub-validator.ts` Contract)

To ensure generated code is production-ready, `stub-validator.ts` will audit generated `CodeArtifact` contents against regex rules:

| Category | Pattern / Rule | Description |
|---|---|---|
| TODO Markers | `/\/\/\s*TODO/i`, `/\/\*\s*TODO/i` | Flags incomplete tasks |
| FIXME Markers | `/\/\/\s*FIXME/i` | Flags temporary hacks |
| Placeholder Errors | `throw new Error\(.*not implemented.*\)/i` | Flags unimplemented stubs |
| Python Stubs | `pass`, `raise NotImplementedError` | Flags Python placeholders |
| Empty Callbacks | `\(\)\s*=>\s*\{\s*\}` | Flags empty arrow functions in JSX/TSX |
| Stub Strings | `"stub"`, `"placeholder"`, `"dummy"` | Flags fake data placeholders |

`validateBundleStubs(bundle: GeneratedCodeBundle)` returns:
```typescript
export interface StubValidationResult {
  valid: boolean;
  violations: Array<{
    filePath: string;
    lineNumber: number;
    pattern: string;
    snippet: string;
  }>;
}
```

---

## 6. Recommended Implementation Strategy for Implementer

1. **File 1**: Create `src/code-gen/types.ts` defining `CodeArtifact`, `EntitySpec`, `TemplateContext`, `GeneratedCodeBundle`, `CodeGenOptions`.
2. **File 2**: Create `src/code-gen/template-generator.ts` exporting:
   - `generateFrontendUI(context: TemplateContext): CodeArtifact[]`
   - `generateApiHandlers(context: TemplateContext): CodeArtifact[]`
   - `generateWorkerConsumer(context: TemplateContext): CodeArtifact[]`
   - `generateSqlMigrations(context: TemplateContext): CodeArtifact[]`
3. **File 3**: Create `src/code-gen/code-synthesizer.ts` exporting:
   - `synthesizeCodeBundle(spec: StackTopologySpec, options?: CodeGenOptions): GeneratedCodeBundle`
   - `writeBundleToDisk(bundle: GeneratedCodeBundle, targetDir: string): void`
4. **File 4**: Create `src/code-gen/stub-validator.ts` exporting `validateCodeArtifact()` and `validateBundleStubs()`.
5. **File 5**: Update `src/index.ts` to export code-gen functions and register CLI commands if applicable.
6. **Tests**: Create `tests/code-gen.test.ts` covering UI generation, API handlers, worker consumer, SQL DDL validity, and zero-stub validation.

---

## 7. Verification Method

To verify the M2 implementation once built:
1. Run unit test suite:
   ```bash
   npm run test
   ```
2. Verify synthesized output has 0 stub violations and valid file paths.
3. Validate SQL syntax of generated migrations by checking for `CREATE TABLE`, `PRIMARY KEY`, `FOREIGN KEY`, and index declarations.
