# Technical Analysis: Full-Stack Code & Schema Synthesizer (Milestone M2)

## Executive Summary
This document provides a comprehensive technical investigation and implementation blueprint for Milestone M2 of `zeroops-engine`.
The goal of M2 is to implement the full-stack code synthesis engine in `zeroops-engine/src/code-gen/`, consisting of:
1. `code-synthesizer.ts`: Multi-service code synthesizer orchestrating template synthesis across UI, API, Queue Worker, and SQL DB migrations based on `StackTopologySpec`.
2. `template-generator.ts`: Production-ready code generators producing Frontend UI components, REST/gRPC API route handlers, background queue consumers, and PostgreSQL schema migrations (`.sql` with real DDL).
3. `stub-validator.ts`: AST & regex zero-stub completeness validator that guarantees zero placeholders/TODOs/stubs exist in generated code artifacts.

---

## 1. Existing System & Architecture Survey

### 1.1 File Structure & Boundaries
- Project Root: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`
- Target Code Directory: `src/code-gen/` (currently uncreated)
- Target Test File: `tests/code-gen.test.ts`
- Engine Main Entry Point: `src/index.ts`
- Node/TS Configuration: ESM (`"type": "module"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`)
- Existing Dependencies in `package.json`:
  - `commander`: ^12.0.0 (CLI parsing)
  - `js-yaml`: ^4.1.0 (YAML generation)
  - `picocolors`: ^1.0.0 (Terminal formatting)
  - `zod`: ^3.22.4 (Validation schemas)
  - `typescript`: ^5.4.0 (TypeScript compiler & AST API)
  - `vitest`: ^1.4.0 (Test framework)

### 1.2 Data Flow & Contract Interfaces
The synthesis pipeline connects `StackTopologySpec` (from `src/synthesizer/types.ts`) to code generation artifacts:
```
[StackTopologySpec] -> code-synthesizer.ts -> template-generator.ts -> [Files Record<string, string>] -> stub-validator.ts -> [GeneratedCodeArtifacts]
```

Existing data contract interfaces defined in `tests/harness.ts` (lines 231-261):
```typescript
export interface GeneratedCodeArtifacts {
  files: Record<string, string>; // path -> content
  hasPlaceholders: boolean;
  astValid: boolean;
  stubsFound?: string[];
}

export interface ICodeSynthesizer {
  synthesizeCode(spec: StackTopologySpec): GeneratedCodeArtifacts;
  validateZeroStubs(files: Record<string, string>): { isClean: boolean; stubsFound: string[] };
}
```

---

## 2. Component Design Specifications

### 2.1 Component 1: `template-generator.ts`
The template generator must produce zero-stub, complete, production-ready code files for each component in a synthesized stack:

#### A. Frontend UI Component Generator (`generateFrontend`)
- **Supported Runtimes**: Node.js / Bun (`nodejs`, `bun`)
- **Generated File**: `src/frontend/App.tsx` (or `src/frontend/index.html` + `src/frontend/app.js`)
- **Key Features**:
  - React/TSX component with responsive dark-theme design.
  - Live API status fetch (`GET /health`) and private database connectivity state indicator.
  - Interactive item list display (`GET /api/items`) and form handler (`POST /api/items`).
  - Queue job submission trigger (`POST /api/tasks`).
  - Uses `API_URL` environment variable or relative fallback `/api`.

#### B. API Handler Generator (`generateApi`)
- **Supported Runtimes**: Go (`go`), Node.js (`nodejs`), Python (`python`), Rust (`rust`)
- **Generated File**: `src/api/server.ts` (Node), `src/api/main.go` (Go), `src/api/main.py` (Python), `src/api/main.rs` (Rust)
- **Key Features**:
  - Production HTTP server setup (Express/Fastify for Node, Gin/net/http for Go, FastAPI for Python, Actix/Axum for Rust).
  - `/health` endpoint returning `{ status: "ok", service: "api", timestamp: ISOString }`.
  - `/api/items` GET and POST endpoints querying PostgreSQL database using environment variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
  - `/api/tasks` POST endpoint pushing tasks into Valkey queue using `VALKEY_HOST` and `VALKEY_PORT`.
  - Full error handling, request logging, and CORS configuration.

#### C. Background Queue Consumer Generator (`generateWorker`)
- **Supported Runtimes**: Python (`python`), Node.js (`nodejs`), Go (`go`)
- **Generated File**: `src/worker/consumer.py` (Python), `src/worker/consumer.ts` (Node), `src/worker/consumer.go` (Go)
- **Key Features**:
  - Connects to Valkey cache/queue (`VALKEY_HOST:VALKEY_PORT`).
  - Implements continuous queue polling/popping (`BRPOP` / queue client loop).
  - Processes incoming task payloads and writes completion log / audit record to PostgreSQL (`DB_HOST:DB_PORT`).
  - Handles graceful OS signals (`SIGTERM`, `SIGINT`).

#### D. PostgreSQL Schema Migration Generator (`generateSqlMigrations`)
- **Supported Managed Service**: PostgreSQL (`postgresql`)
- **Generated File**: `migrations/001_init.sql`
- **Key Features**:
  - Valid PostgreSQL DDL script containing:
    - `CREATE TABLE IF NOT EXISTS users (...)`
    - `CREATE TABLE IF NOT EXISTS tasks (...)`
    - `CREATE TABLE IF NOT EXISTS audit_logs (...)`
    - Table constraints (`PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`, `DEFAULT`).
    - Performance indexes (`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`).
    - Seed data inserts (`INSERT INTO users ... ON CONFLICT DO NOTHING;`).

---

### 2.2 Component 2: `stub-validator.ts`
The validator checks generated source files for any incomplete stubs, TODO comments, or placeholder code.

#### A. Regex Pattern Scanner
Scans all generated file strings against regex rules:
1. **Comment Annotations**:
   - `/\/\/\s*(TODO|STUB|FIXME|XXX|HACK|PLACEHOLDER)/i`
   - `/\/\*\s*(TODO|STUB|FIXME|XXX|HACK|PLACEHOLDER)/i`
   - `/#\s*(TODO|STUB|FIXME|XXX|HACK|PLACEHOLDER)/i` (Python/Shell)
   - `/--\s*(TODO|STUB|FIXME|XXX|HACK|PLACEHOLDER)/i` (SQL)
2. **Placeholder Error Throws & Panics**:
   - `/throw\s+new\s+Error\s*\(\s*['"`](Not implemented|TODO|stub|placeholder)/i`
   - `/raise\s+(NotImplementedError|Exception\s*\(\s*['"`]Not implemented)/i`
   - `/panic\s*\(\s*['"`](not implemented|todo|stub)/i`
3. **Dummy Value Strings**:
   - `/['"`](dummy_value|placeholder_string|todo_impl)['"`]/i`

#### B. AST Completeness Inspector (TypeScript/JavaScript)
Uses `typescript` compiler API (`ts.createSourceFile`):
- Parses JS/TS/TSX files into AST.
- Traverses AST nodes looking for:
  - Empty function bodies (`ts.isBlock` with 0 statements in non-trivial functions).
  - Functions containing only `throw new Error(...)` with stub messages.
  - Empty catch blocks without error handling.

#### C. Validation Result Interface
```typescript
export interface StubValidationResult {
  isClean: boolean;
  stubsFound: string[];
}
```

---

### 2.3 Component 3: `code-synthesizer.ts`
Orchestrates the entire code synthesis process:
1. Accepts `StackTopologySpec` and optional `CodeGenOptions`.
2. Iterates over `spec.runtimes` and invokes appropriate `TemplateGenerator` methods for Frontend, API, and Worker containers based on container type/runtime.
3. Iterates over `spec.managedServices` and generates PostgreSQL schema migrations.
4. Aggregates all generated files into `Record<string, string>`.
5. Runs `StubValidator.validateZeroStubs(files)`.
6. Checks syntax/AST validity (`astValid: true`).
7. Returns `GeneratedCodeArtifacts`.

---

## 3. Module Boundaries & Re-Exports
- `src/code-gen/code-synthesizer.ts`: Primary orchestrator.
- `src/code-gen/template-generator.ts`: Template rendering functions.
- `src/code-gen/stub-validator.ts`: Validation logic.
- Re-export in `src/index.ts`:
  ```typescript
  export { synthesizeCode } from './code-gen/code-synthesizer.js';
  export { generateCodeArtifacts } from './code-gen/template-generator.js';
  export { validateZeroStubs } from './code-gen/stub-validator.js';
  export type { GeneratedCodeArtifacts } from './code-gen/types.js';
  ```

---

## 4. Verification & Testing Strategy
- Unit test file: `zeroops-engine/tests/code-gen.test.ts`
- Command: `npm test` and `npm run test:unit`
- Test Coverage Matrix:
  - Frontend TSX/HTML generation with dark UI & API connection.
  - API handler generation for Node, Go, Python, Rust with `/health` and DB/Queue routes.
  - Worker consumer generation for Python/Node/Go with Valkey pop & Postgres audit write.
  - PostgreSQL schema migration DDL generation (`CREATE TABLE`, `INDEX`, `INSERT`).
  - Stub validator accuracy: passes clean code, rejects injected TODOs, panics, or dummy strings.
  - Integration with `StackTopologySpec` synthesized from `parsePromptToTopology`.
