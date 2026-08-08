# Milestone M2 — Stub Validation & Test Verification Analysis

## 1. Executive Summary & Scope

Milestone M2 ("Full-Stack Code & Schema Synthesizer") requires generating complete, production-ready, multi-service application code templates (Frontend UI components, REST/gRPC API handlers, background queue workers, and PostgreSQL SQL schema migrations) with **zero placeholder code or dummy stubs**.

This investigation focuses on two core deliverables for M2:
1. **`src/code-gen/stub-validator.ts`**: Designing an accurate polyglot zero-stub validator using the TypeScript Compiler API for AST-level inspection of TS/JS/TSX/JSX files, combined with robust AST-aware scanners for Python, Go, SQL, and UI templates.
2. **Test Suite Verification Structure**: Analyzing existing `zeroops-engine` test infrastructure (`npm test`, `vitest`, `tests/harness.ts`) to define unit and integration test strategies for `code-gen.test.ts`.

---

## 2. AST & Syntax Analysis for `stub-validator.ts`

### 2.1 Parser Selection Analysis

| Parser / Strategy | Supported Languages | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **TypeScript Compiler API (`import ts from 'typescript'`)** | `.ts`, `.tsx`, `.js`, `.jsx` | - Already installed (`typescript: ^5.4.0`) in `package.json`<br>- Native AST traversal with line/col maps<br>- Full node taxonomy (`ts.SyntaxKind`) | JS/TS ecosystem only | **PRIMARY** for TS, JS, TSX, JSX |
| **Babel / Acorn / SWC** | `.js`, `.jsx`, `.ts` | Wide parser support | Requires external dependencies not currently in `package.json` | Not needed (TS Compiler API is built-in) |
| **Tree-Sitter** | All languages | Multi-language AST | Native C bindings required; complex build setup | Overkill & unnecessary dependency overhead |
| **Regex & Pattern Scanners** | Python (`.py`), Go (`.go`), SQL (`.sql`), UI HTML | Fast, light weight, zero extra dependencies | Potential false positives if regex is too naive | **PRIMARY** for non-TS/JS files with line-context guardrails |

### 2.2 Complete Polyglot Zero-Stub Rule Set (10 Rules)

The `stub-validator.ts` engine must enforce the following 10 detection rules across all generated code artifacts:

#### Rule 1: Comment Stubs (All Languages)
- **Target Patterns**: `// TODO`, `/* TODO */`, `// STUB`, `/* STUB */`, `// FIXME`, `/* placeholder */`, `# TODO`, `# STUB`, `-- TODO`, `-- STUB`
- **Regex**: `/\b(TODO|STUB|FIXME|TEMP|PLACEHOLDER|NOT[_\s]IMPLEMENTED|UNIMPLEMENTED|DUMMY)\b/i`
- **Implementation Strategy**:
  - TS/JS: Token scanner (`ts.createScanner`) to isolate `SingleLineCommentTrivia` and `MultiLineCommentTrivia`.
  - Non-TS: Line-by-line comment extraction based on file extension (`#` for `.py`, `--` / `/* */` for `.sql`, `//` / `/* */` for `.go`).

#### Rule 2: Empty Function Bodies (TS / JS / TSX / JSX)
- **Target Construct**: Functions, arrow functions, or methods with no executable statements in their body block.
- **AST Node Kinds**: `FunctionDeclaration`, `FunctionExpression`, `ArrowFunction`, `MethodDeclaration`, `GetAccessor`, `SetAccessor`.
- **Inspection Logic**:
  - Node body is a `ts.Block`.
  - Check if `node.body.statements.length === 0` or if statements contain only `ts.EmptyStatement`.

#### Rule 3: Thrown "Not Implemented" Errors (TS / JS / TSX / JSX)
- **Target Construct**: `throw new Error("Not implemented")`, `throw new Error("TODO")`, `throw Error("Unimplemented")`.
- **AST Node Kind**: `ts.ThrowStatement`.
- **Inspection Logic**:
  - Inspect `throwStatement.expression`.
  - Check if expression is `NewExpression` or `CallExpression` targeting `Error` / `NotImplementedError`.
  - Extract text argument; match against `/not implemented|todo|stub|unimplemented/i`.

#### Rule 4: Explicit `any` Type Overuse (TS / TSX)
- **Target Construct**: Explicit `: any`, `as any`, `<any>`, `Array<any>`.
- **AST Node Kind**: `ts.SyntaxKind.AnyKeyword`, `ts.AsExpression`, `ts.TypeAssertion`.
- **Inspection Logic**:
  - Flag any explicit `any` type usage as lazy/stubbed typing violation (unless explicitly bypassed via option).

#### Rule 5: Hardcoded Mock / Dummy Return Objects (TS / JS)
- **Target Construct**: `return { status: "mocked" }`, `return "dummy"`, `res.json({ message: "mock response" })`.
- **AST Node Kind**: `ts.ReturnStatement`, `ts.CallExpression` (e.g. `res.json`).
- **Inspection Logic**:
  - Match string literals or object property values against `/mock|dummy|fake|sample|stub/i`.

#### Rule 6: Sole `console.log` Body (TS / JS)
- **Target Construct**: Functions whose body consists solely of `console.log("TODO...")` or `console.log("not implemented")`.
- **AST Inspection**: Single statement in block which is a `CallExpression` targeting `console.log` with stub text.

#### Rule 7: Python Empty / Pass Bodies & Raised Errors (`.py`)
- **Target Constructs**:
  - Function/Class body consisting solely of `pass` or `...`: `def\s+\w+\s*\([^)]*\)\s*:\s*(?:pass|\.\.\.|\s*#.*)*(?=\n\s*\S|\n\s*$|$)`
  - Raised errors: `raise\s+(?:NotImplementedError|Exception\s*\(\s*['"].*?(?:not implemented|todo|stub).*?['"]\s*\))`

#### Rule 8: Go Empty Functions & Panics (`.go`)
- **Target Constructs**:
  - Panics: `panic\s*\(\s*["'].*?(?:not implemented|todo|stub|unimplemented).*?["']\s*\)`
  - Empty functions: `func\s+(?:\([^)]+\)\s+)?\w+\s*\([^)]*\)[^{]*\{\s*\}`

#### Rule 9: SQL Migration Completeness & Validity (`.sql`)
- **Target Constructs**:
  - Empty migration file (0 bytes or comments only).
  - Lack of valid DDL statements (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE TYPE`, `ADD CONSTRAINT`).
  - Dummy table names like `CREATE TABLE dummy`, `CREATE TABLE test_table`.

#### Rule 10: UI Component Dummy Text (`.tsx`, `.jsx`, `.html`)
- **Target Constructs**: JSX elements or HTML containing literal text like `<div>TODO</div>`, `<h1>Placeholder Component</h1>`, `<p>Lorem ipsum</p>`.

---

## 3. Recommended Architecture for `src/code-gen/stub-validator.ts`

### 3.1 Interface Contract

```typescript
export interface StubViolation {
  file: string;
  line?: number;
  column?: number;
  rule: string;
  message: string;
  snippet: string;
}

export interface StubValidationResult {
  isClean: boolean;
  violations: StubViolation[];
  stubsFound: string[]; // Formatted violation strings for backward compatibility
}

export interface ValidateOptions {
  allowAny?: boolean;
  allowConsoleLog?: boolean;
}

export function validateZeroStubs(
  files: Record<string, string>,
  options?: ValidateOptions
): StubValidationResult;

export function validateSingleFile(
  filePath: string,
  content: string,
  options?: ValidateOptions
): StubViolation[];
```

### 3.2 Implementation Design (TypeScript Compiler API Integration)

```typescript
import ts from 'typescript';

export function validateTsAst(filePath: string, content: string, options?: ValidateOptions): StubViolation[] {
  const violations: StubViolation[] = [];
  const isJsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  const scriptKind = isJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

  // 1. Scan for comment stubs using ts.createScanner
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, content);
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      const commentText = scanner.getTokenText();
      if (/\b(TODO|STUB|FIXME|TEMP|PLACEHOLDER|NOT[_\s]IMPLEMENTED|DUMMY)\b/i.test(commentText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(scanner.getTokenPos());
        violations.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          rule: 'COMMENT_STUB',
          message: `Detected placeholder comment: ${commentText.trim()}`,
          snippet: commentText.trim()
        });
      }
    }
    token = scanner.scan();
  }

  // 2. Walk AST nodes
  function visit(node: ts.Node) {
    // Rule 2: Empty Function Bodies
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      if (node.body && ts.isBlock(node.body)) {
        if (node.body.statements.length === 0) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: filePath,
            line: line + 1,
            rule: 'EMPTY_FUNCTION_BODY',
            message: 'Detected empty function body with zero statements',
            snippet: node.getText(sourceFile)
          });
        }
      }
    }

    // Rule 3: Thrown Not Implemented Error
    if (ts.isThrowStatement(node)) {
      const exprText = node.expression.getText(sourceFile);
      if (/not implemented|todo|stub|unimplemented/i.test(exprText)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          file: filePath,
          line: line + 1,
          rule: 'THROW_NOT_IMPLEMENTED',
          message: 'Detected throw statement with Not Implemented error',
          snippet: node.getText(sourceFile)
        });
      }
    }

    // Rule 4: Explicit 'any' Type Usage
    if (!options?.allowAny && node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({
        file: filePath,
        line: line + 1,
        rule: 'EXPLICIT_ANY_TYPE',
        message: 'Detected explicit "any" type usage',
        snippet: node.parent?.getText(sourceFile) || node.getText(sourceFile)
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}
```

---

## 4. Test Verification Requirements & Existing Test Architecture

### 4.1 Review of Existing Test Setup in `zeroops-engine`

- **Execution Engines**:
  - `npm test`: Runs `tsx --test tests/harness.test.ts tests/tier*.test.ts` (using Node.js native `node:test`).
  - `npm run test:unit`: Runs `vitest run tests/cli.test.ts tests/private-net.test.ts tests/yaml-generator.test.ts tests/zcp-client.test.ts`.
- **Harness Bridge (`tests/harness.ts`)**:
  - Defines `describe`, `it`, `expect`, `assert` dynamically compatible with both Vitest and `node:test`.
  - Defines contract driver interfaces (`ICodeSynthesizer`, `IStackSynthesizer`, `IZcpApiClient`, etc.) and mock classes (`MockCodeSynthesizer`).

### 4.2 Test Plan for Milestone M2 (`tests/code-gen.test.ts`)

A new test file `zeroops-engine/tests/code-gen.test.ts` must be created with three primary test suites:

#### Suite 1: `TemplateGenerator` Unit Tests
1. **Frontend UI**: Generates functional React/Next.js `.tsx` component with full JSX markup, hooks/props, zero `TODO` comments.
2. **REST/gRPC API**: Generates complete API handlers (`.ts` and `.go`) with request validation and status response codes.
3. **Background Worker**: Generates worker consumer (`.py` and `.ts`) with Valkey queue consumer loop and SIGTERM handling.
4. **PostgreSQL Migration**: Generates valid `.sql` file with DDL (`CREATE TABLE`, `PRIMARY KEY`, `FOREIGN KEY`, `INDEXES`).

#### Suite 2: `StubValidator` Unit Tests
1. Detects `// TODO`, `/* STUB */`, `/* placeholder */` in TS/JS files.
2. Detects AST empty function bodies (`function handle() {}`).
3. Detects AST thrown errors (`throw new Error("Not implemented")`).
4. Detects AST explicit `: any` type annotations.
5. Detects hardcoded mock returns (`return { status: "mocked" }`).
6. Detects Python `pass` body stubs and `raise NotImplementedError`.
7. Detects Go empty `func` and `panic("not implemented")`.
8. Detects invalid SQL files (missing DDL or `-- TODO` comments).
9. Passes clean full-stack generated files with `isClean: true` and 0 violations.

#### Suite 3: `CodeSynthesizer` Integration Tests
1. Synthesizes multi-service application code artifacts from `StackTopologySpec`.
2. Validates that all generated files pass zero-stub validation automatically (`hasPlaceholders: false`, `astValid: true`).
3. Ensures missing entry point or stubbed template generation throws an error.

### 4.3 `package.json` Updates Required
To ensure M2 tests are run in CI/CD and local development:
- Update `scripts.test`: `"tsx --test tests/harness.test.ts tests/code-gen.test.ts tests/tier*.test.ts"`
- Update `scripts["test:unit"]`: `"vitest run tests/cli.test.ts tests/private-net.test.ts tests/yaml-generator.test.ts tests/zcp-client.test.ts tests/code-gen.test.ts"`

---

## 5. Summary of Recommended Actions for Implementation Team

1. Implement `src/code-gen/stub-validator.ts` using TypeScript Compiler API (`import ts from 'typescript'`) for JS/TS AST checks and polyglot scanners for Python/Go/SQL/UI templates.
2. Implement `src/code-gen/template-generator.ts` with complete, non-stubbed templates for UI, API, Worker, and SQL migrations.
3. Implement `src/code-gen/code-synthesizer.ts` combining template generation with zero-stub validation.
4. Create `tests/code-gen.test.ts` covering unit and integration scenarios for all M2 components.
5. Update `package.json` test scripts to include `tests/code-gen.test.ts`.
