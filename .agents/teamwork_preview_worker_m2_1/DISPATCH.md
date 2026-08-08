## 2026-08-08T23:13:38Z
You are Worker 1 for Milestone M2.
Your working directory is `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_worker_m2_1`.

You MUST read the following files FIRST before writing any code:
1. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/ORIGINAL_REQUEST.md`
2. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/PROJECT.md`
3. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/sub_orch_m2/SCOPE.md`
4. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_explorer_m2_1/analysis.md`
5. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_explorer_m2_2/analysis.md`
6. `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_explorer_m2_3/analysis.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective:
Implement Milestone M2: Full-Stack Code & Schema Synthesizer in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/`.

Write ownership:
- `src/code-gen/stub-validator.ts`
- `src/code-gen/template-generator.ts`
- `src/code-gen/code-synthesizer.ts`
- `src/code-gen/index.ts`
- `src/index.ts` (re-export code-gen capabilities)
- `tests/code-gen.test.ts` (new unit/integration test suite)
- `package.json` (update test scripts to include `tests/code-gen.test.ts` if needed)

Detailed Implementation Requirements:
1. `stub-validator.ts`:
   - AST & regex zero-stub completeness validator that rejects placeholders/stubs.
   - Use TypeScript Compiler API (`import ts from 'typescript'`) for AST node inspection of JS/TS/TSX/JSX files.
   - Polyglot regex scanners for Python, Go, SQL, HTML, etc.
   - Must export `validateZeroStubs(files: Record<string, string>): { isClean: boolean; stubsFound: string[]; astValid: boolean }`.
   - Rejects `// TODO`, `/* stub */`, `# TODO`, `any` type, empty function bodies, `throw new Error("Not implemented")`, `pass`, `panic("not implemented")`, hardcoded mock returns, and empty SQL migrations.

2. `template-generator.ts`:
   - Production-ready code generators producing:
     a) Frontend UI components: React/Tailwind/TSX or HTML with responsive layout, metric cards, CRUD table, live API status badge, task queue trigger button.
     b) REST/gRPC API handlers: Express/Node/TypeScript or Go/Python/Rust exposing `/health`, `/api/items` (Postgres DB access), `/api/tasks` (Valkey/Redis queue push), and optional gRPC server setup.
     c) Background queue consumers: BullMQ/Valkey worker reading queue jobs, updating Postgres DB, pub/sub events, graceful shutdown.
     d) PostgreSQL schema migrations: `.sql` file with real DDL (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX`, primary/foreign keys, NOT NULL constraints, seed data).

3. `code-synthesizer.ts`:
   - Multi-service code synthesizer orchestrating template synthesis across UI, API, Queue Worker, and SQL DB migrations based on `StackTopologySpec`.
   - Must export `CodeSynthesizer` class and `synthesizeCode(spec: StackTopologySpec): GeneratedCodeArtifacts` conforming to `GeneratedCodeArtifacts` and `ICodeSynthesizer` from `tests/harness.ts`.
   - Integrates `validateZeroStubs` on generated artifacts to ensure zero placeholders/stubs.

4. `tests/code-gen.test.ts`:
   - Write comprehensive unit and integration tests covering synthesizer, template generator, and stub validator.
   - Ensure compatibility with both `npm test` and `vitest`.

Verification steps:
Run build, typecheck, unit tests, and full tier tests:
`cd /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine && npm run build && npm run typecheck && npm test`

Write your handoff report in `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/teamwork_preview_worker_m2_1/handoff.md` with build logs, test execution results, and summary of changes. Notify parent via `send_message` when done.
