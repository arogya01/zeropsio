/**
 * zeroops-engine/tests/challenger_m3_r2_2.test.ts
 * Empirical Challenge Suite for Milestone M3 Round 2 (Challenger 2)
 * Stress-tests AST Validator, Polyglot Text Syntax Validator, CodeSynthesizer, and Template Generator.
 */

import { describe, it, expect } from 'vitest';
import { validateZeroStubs, validateTsAst, validateNonTsFile, validateGoSyntax } from '../src/code-gen/stub-validator.js';
import { CodeSynthesizer, synthesizeCode } from '../src/code-gen/code-synthesizer.js';
import { generateTemplates, generateFrontend, generateApi, generateWorker, generateSqlMigrations } from '../src/code-gen/template-generator.js';
import { StackTopologySpec } from '../src/synthesizer/types.js';
import fs from 'fs';
import path from 'path';

describe('Empirical Challenger 2 M3 Stress Suite', () => {

  describe('1. AST & Comment Stub Edge Case Detection (TS/JS/TSX/JSX)', () => {

    it('detects comment stubs across case variations (TODO, todo, Stub, FIXME, xxx, HACK, placeholder)', () => {
      const code = `
        // todo: fix this later
        /* FIXME: broken logic */
        const x = 1; // HACK for now
        // PLACEHOLDER: code comes here
      `;
      const result = validateTsAst('test.ts', code);
      expect(result.violations.length).toBeGreaterThanOrEqual(4);
      expect(result.violations.every(v => v.rule === 'COMMENT_STUB')).toBe(true);
    });

    it('does NOT trigger COMMENT_STUB for comment-like strings inside code string literals', () => {
      const code = `
        const msg = "This string contains TODO inside text";
        const url = "https://example.com/api/v1/STUB/data";
      `;
      const result = validateTsAst('test.ts', code);
      // Scanner scans trivia. SingleLineCommentTrivia is only trivia comments.
      const commentViolations = result.violations.filter(v => v.rule === 'COMMENT_STUB');
      expect(commentViolations).toHaveLength(0);
    });

    it('detects AST empty function bodies for functions, methods, and arrow functions', () => {
      const code = `
        function standardFunc() {}
        async function asyncFunc() {}
        const arrowFunc = () => {};
        class Service {
          method() {}
          async asyncMethod() {}
        }
      `;
      const result = validateTsAst('test.ts', code);
      const emptyFuncs = result.violations.filter(v => v.rule === 'EMPTY_FUNCTION_BODY');
      expect(emptyFuncs.length).toBe(5);
    });

    it('does NOT trigger EMPTY_FUNCTION_BODY for arrow functions with concise expression body or non-empty block', () => {
      const code = `
        const identity = (x: number) => x;
        const getNull = () => null;
        function valid() { return 42; }
      `;
      const result = validateTsAst('test.ts', code);
      const emptyFuncs = result.violations.filter(v => v.rule === 'EMPTY_FUNCTION_BODY');
      expect(emptyFuncs).toHaveLength(0);
    });

    it('detects thrown NotImplementedError variations', () => {
      const code = `
        function f1() { throw new Error("Not implemented"); }
        function f2() { throw new Error("TODO: complete this"); }
        function f3() { throw new Error("This is a STUB function"); }
        function f4() { throw new Error("unimplemented method"); }
        function f5() { throw new Error("placeholder error"); }
      `;
      const result = validateTsAst('test.ts', code);
      const throwViolations = result.violations.filter(v => v.rule === 'THROW_NOT_IMPLEMENTED');
      expect(throwViolations.length).toBe(5);
    });

    it('detects explicit "any" type keyword in parameters, variables, return types, and type assertions', () => {
      const code = `
        let data: any = 10;
        function process(input: any): any {
          return input as any;
        }
        type AnyMap = Record<string, any>;
      `;
      const result = validateTsAst('test.ts', code);
      const anyViolations = result.violations.filter(v => v.rule === 'EXPLICIT_ANY_TYPE');
      expect(anyViolations.length).toBeGreaterThanOrEqual(4);
    });

    it('detects hardcoded mock return values', () => {
      const code = `
        function r1() { return "dummy_value"; }
        function r2() { return 'placeholder_string'; }
        function r3() { return \`todo_impl\`; }
        function r4() { return "mocked_return"; }
        function r5() { return "stub_data"; }
      `;
      const result = validateTsAst('test.ts', code);
      const mockViolations = result.violations.filter(v => v.rule === 'MOCK_RETURN_VALUE');
      expect(mockViolations.length).toBe(5);
    });

    it('detects TypeScript syntax errors and sets astValid = false', () => {
      const code = `
        const x: number = ;
        function broken( {
      `;
      const result = validateTsAst('test.ts', code);
      expect(result.astValid).toBe(false);
      expect(result.violations.some(v => v.rule === 'TS_SYNTAX_ERROR')).toBe(true);
    });
  });

  describe('2. Polyglot Text Syntax Validator Edge Cases', () => {

    it('Go: detects unterminated string literals (unescaped newline inside double quotes)', () => {
      const brokenGo = `package main
import "fmt"

func main() {
\tfmt.Println("Unterminated double quote
string across line")
}
`;
      const violations = validateGoSyntax('main.go', brokenGo);
      expect(violations.some(v => v.rule === 'GO_UNTERMINATED_STRING_LITERAL')).toBe(true);
    });

    it('Go: handles escaped quotes and valid multiline raw strings correctly without false positives', () => {
      const validGo = `package main
import "fmt"

func main() {
\tstr := "Hello \\"world\\" with escaped quote"
\traw := \`Raw string
spans multiple lines
safely in Go\`
\tfmt.Println(str, raw)
}
`;
      const violations = validateGoSyntax('main.go', validGo);
      expect(violations).toHaveLength(0);
    });

    it('Go: detects panic stubs and empty function declarations', () => {
      const goWithStubs = `package main

func emptyFunc() {}

func panicFunc() {
\tpanic("function not implemented yet")
}
`;
      const violations = validateNonTsFile('main.go', goWithStubs);
      expect(violations.some(v => v.rule === 'GO_EMPTY_FUNCTION')).toBe(true);
      expect(violations.some(v => v.rule === 'GO_PANIC_STUB')).toBe(true);
    });

    it('Python: detects pass statement in functions/classes and raise NotImplementedError', () => {
      const pyCode = `def task_handler():
    pass

class BaseWorker:
    def run(self):
        raise NotImplementedError("Work in progress")
`;
      const violations = validateNonTsFile('worker.py', pyCode);
      expect(violations.some(v => v.rule === 'PYTHON_PASS_STUB')).toBe(true);
      expect(violations.some(v => v.rule === 'PYTHON_RAISE_NOT_IMPLEMENTED')).toBe(true);
    });

    it('SQL: detects empty or comment-only SQL migrations without DDL statements', () => {
      const emptySql = `-- Only comments here\n-- TODO: add tables\n`;
      const violations = validateNonTsFile('migration.sql', emptySql);
      expect(violations.some(v => v.rule === 'EMPTY_SQL_MIGRATION')).toBe(true);
    });

    it('SQL: passes valid DDL migrations with CREATE TABLE and index definitions', () => {
      const validSql = `CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL); CREATE INDEX idx_users ON users(email);`;
      const violations = validateNonTsFile('migration.sql', validSql);
      expect(violations).toHaveLength(0);
    });

    it('UI: detects placeholder tags in HTML/JSX', () => {
      const htmlCode = `<div>\n  <h1>TODO</h1>\n  <p>Placeholder</p>\n  <span>Lorem ipsum</span>\n</div>`;
      const violations = validateNonTsFile('index.html', htmlCode);
      expect(violations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('3. CodeSynthesizer & Template Generator Completeness Verification', () => {

    const topologiesToTest: { name: string; spec: StackTopologySpec; options?: any }[] = [
      {
        name: 'Node.js Express + Python Worker Stack',
        spec: {
          projectName: 'node-py-stack',
          runtimes: [
            { name: 'frontend', runtime: 'nodejs', ports: [3000], envVariables: {} },
            { name: 'api', runtime: 'nodejs', ports: [8080], envVariables: {} },
            { name: 'worker', runtime: 'python', ports: [], envVariables: {} }
          ],
          managedServices: [
            { name: 'dbpostgres', type: 'postgresql', mode: 'HA' },
            { name: 'cachevalkey', type: 'valkey', mode: 'SINGLE' }
          ]
        }
      },
      {
        name: 'Go REST API + Go Worker Stack with gRPC Enabled',
        spec: {
          projectName: 'go-grpc-stack',
          runtimes: [
            { name: 'frontend', runtime: 'nodejs', ports: [3000], envVariables: {} },
            { name: 'api', runtime: 'go', ports: [8080], envVariables: {} },
            { name: 'worker', runtime: 'go', ports: [], envVariables: {} }
          ],
          managedServices: [
            { name: 'dbpostgres', type: 'postgresql', mode: 'HA' },
            { name: 'cachevalkey', type: 'valkey', mode: 'SINGLE' }
          ]
        },
        options: { enableGrpc: true }
      },
      {
        name: 'Python FastAPI API + Node.js Worker Stack',
        spec: {
          projectName: 'py-fastapi-stack',
          runtimes: [
            { name: 'frontend', runtime: 'nodejs', ports: [3000], envVariables: {} },
            { name: 'api', runtime: 'python', ports: [8000], envVariables: {} },
            { name: 'worker', runtime: 'nodejs', ports: [], envVariables: {} }
          ],
          managedServices: [
            { name: 'dbpostgres', type: 'postgresql', mode: 'HA' },
            { name: 'cachevalkey', type: 'valkey', mode: 'SINGLE' }
          ]
        }
      }
    ];

    topologiesToTest.forEach(({ name, spec, options }) => {
      it(`synthesizes 100% clean zero-stub code for topology: ${name}`, () => {
        const synthesizer = new CodeSynthesizer();
        const artifacts = synthesizer.synthesizeCode(spec, options);

        expect(artifacts.files).toBeDefined();
        expect(Object.keys(artifacts.files).length).toBeGreaterThanOrEqual(4);
        expect(artifacts.hasPlaceholders).toBe(false);
        expect(artifacts.astValid).toBe(true);
        expect(artifacts.stubsFound).toHaveLength(0);

        const validation = validateZeroStubs(artifacts.files);
        expect(validation.isClean).toBe(true);
        expect(validation.astValid).toBe(true);
        expect(validation.violations).toHaveLength(0);
      });
    });

    it('verifies that all pre-built stack templates on disk pass zero-stub AST validation', () => {
      const templatesDir = path.join(__dirname, '../src/templates');
      const stacks = ['ai-video-clipper', 'ecommerce-platform', 'rag-search-engine'];

      const allFiles: Record<string, string> = {};

      for (const stack of stacks) {
        const stackDir = path.join(templatesDir, stack);
        const readDirRecursive = (dir: string, base: string) => {
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.join(base, entry.name);
            if (entry.isDirectory()) {
              readDirRecursive(fullPath, relPath);
            } else if (entry.isFile() && !entry.name.endsWith('.yml')) {
              allFiles[relPath] = fs.readFileSync(fullPath, 'utf-8');
            }
          }
        };
        readDirRecursive(stackDir, stack);
      }

      expect(Object.keys(allFiles).length).toBeGreaterThanOrEqual(9);

      const result = validateZeroStubs(allFiles);
      expect(result.isClean).toBe(true);
      expect(result.astValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('4. Error Handling & Robustness Checks', () => {
    it('throws explicit error when CodeSynthesizer is passed invalid/null spec', () => {
      const synthesizer = new CodeSynthesizer();
      expect(() => synthesizer.synthesizeCode(null as any)).toThrow('Invalid StackTopologySpec');
      expect(() => synthesizer.synthesizeCode({} as any)).toThrow('Invalid StackTopologySpec');
    });
  });
});
