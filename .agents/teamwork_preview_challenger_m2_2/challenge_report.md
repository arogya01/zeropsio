# Challenge Report — Milestone M2 Empirical Challenger 2

## Challenge Summary

**Overall risk assessment**: HIGH

Empirical verification of Milestone M2 (`zeroops-engine/src/code-gen/`) revealed a syntax corruption flaw in generated Go worker templates and a validation gap in the polyglot zero-stub auditor. PostgreSQL migrations and React/Tailwind UI components passed empirical validation.

---

## Challenges

### [High] Challenge 1: Unescaped String Literal Newlines in Generated Go Queue Worker (`src/worker/consumer.go`)

- **Assumption challenged**: `generateWorker` generates syntactically valid, runnable code across all supported runtime languages (Node, Python, Go).
- **Attack scenario**: Synthesizing a stack with a Go background worker (`runtime: 'go'`) invokes `generateWorker()` in `template-generator.ts`. Lines 782 and 784 write `fmt.Printf("[Worker] Processing queue task #%d\n", id)` within a TypeScript template literal backtick block. TS transpiles `\n` into a raw line break in JavaScript string output. Consequently, the synthesized `src/worker/consumer.go` contains literal multiline line breaks inside Go double-quoted string literals:
  ```go
  fmt.Printf("[Worker] Processing queue task #%d
  ", id)
  ```
- **Blast radius**: `gofmt -e` and `go build` fail with `string literal not terminated` and `syntax error`. Any synthesized project using Go queue workers will fail to compile and build on Zerops.
- **Mitigation**: Escape backslashes in `src/code-gen/template-generator.ts` (use `\\n` instead of `\n` inside template strings).

---

### [Medium] Challenge 2: Polyglot Zero-Stub Validator Bypasses Language Syntax Errors (`src/code-gen/stub-validator.ts`)

- **Assumption challenged**: `validateZeroStubs` guarantees generated code is clean and runnable.
- **Attack scenario**: When `validateZeroStubs` evaluated the syntactically invalid `consumer.go`, it returned `isClean: true` and `astValid: true`. `validateTsAst` only inspects TS/JS ASTs, while `validateNonTsFile` scans lines for stub keywords (`TODO`, `panic("not implemented")`), missing structural language syntax checks.
- **Blast radius**: Syntax errors in generated Go, Python, or SQL files escape detection by the synthesizer's self-validation step.
- **Mitigation**: Add multiline string literal regex validation for Go files or integrate compiler dry-run checks in non-TS validator routines.

---

## Stress Test Results

| Scenario / Test Case | Target Artifact | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| PostgreSQL DDL Syntax & Constraints | `migrations/001_init.sql` | Valid DDL with PK, FK/relations, indexes, check constraints | Idempotent ENUM, UUID PK, CHECK constraint, indexes created cleanly | PASS |
| Express Node.js API Route Handlers | `src/api/server.ts` | Complete routes for `/health`, `/api/items`, `/api/tasks` | Full Express app with pg pool, error handler, fallback | PASS |
| Python FastAPI & Worker | `src/api/main.py`, `src/worker/consumer.py` | Valid Python 3 syntax & signal handling | `python3 -m py_compile` passed with zero syntax errors | PASS |
| React/Tailwind TSX Components | `src/frontend/App.tsx`, `ItemManager.tsx` | Valid TSX structure, state-driven handlers, no empty callbacks | TS AST valid, fetch handlers implemented, zero empty callback placeholders | PASS |
| Go REST API Handler | `src/api/main.go` | Valid Go HTTP server syntax | `gofmt -e` passed with 0 errors | PASS |
| Go Background Queue Worker | `src/worker/consumer.go` | Valid Go consumer with channel select & signal handling | `gofmt -e` failed: `string literal not terminated` on multiline string | FAIL |
| Polyglot AST/Stub Validation | `src/code-gen/stub-validator.ts` | Rejects syntax-corrupted or stubbed polyglot files | Passed corrupted `consumer.go` as `isClean: true`, `astValid: true` | FAIL |

---

## Unchallenged Areas

- **ZCP Private IP Injection (M1)** — Out of scope for M2 code generator verification (validated in M1).
- **Web Studio UI & WebSocket Log Streamer (M3)** — Planned for Milestone M3.
