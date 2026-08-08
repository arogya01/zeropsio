/**
 * tests/code-gen.test.ts
 * Comprehensive unit and integration test suite for Milestone M2:
 * Full-Stack Code & Schema Synthesizer, Template Generator, and Zero-Stub AST Validator.
 */

import { describe, it, expect, assert } from './harness.js';
import { synthesizeStack } from '../src/synthesizer/stack-synthesizer.js';
import { CodeSynthesizer, synthesizeCode } from '../src/code-gen/code-synthesizer.js';
import {
  generateTemplates,
  generateFrontend,
  generateApi,
  generateWorker,
  generateSqlMigrations
} from '../src/code-gen/template-generator.js';
import {
  validateZeroStubs,
  validateTsAst,
  validateNonTsFile
} from '../src/code-gen/stub-validator.js';
import { StackTopologySpec } from '../src/synthesizer/types.js';

const mockSpec: StackTopologySpec = {
  projectName: 'test-ecommerce-app',
  runtimes: [
    {
      name: 'frontend',
      runtime: 'nodejs',
      ports: [3000],
      envVariables: { PORT: '3000', API_URL: 'http://api:8080' }
    },
    {
      name: 'api',
      runtime: 'nodejs',
      ports: [8080],
      envVariables: { PORT: '8080', DB_HOST: '10.0.1.20', VALKEY_HOST: '10.0.1.21' }
    },
    {
      name: 'worker',
      runtime: 'python',
      ports: [],
      envVariables: { DB_HOST: '10.0.1.20', VALKEY_HOST: '10.0.1.21' }
    }
  ],
  managedServices: [
    { name: 'postgres', type: 'postgresql', mode: 'HA' },
    { name: 'valkey', type: 'valkey', mode: 'SINGLE' }
  ]
};

describe('Milestone M2: Stub Validator (AST & Polyglot Scanners)', () => {
  it('passes clean synthesized code artifacts with 0 stubs and valid AST', () => {
    const files = generateTemplates(mockSpec);
    const result = validateZeroStubs(files);

    expect(result.isClean).toBe(true);
    expect(result.astValid).toBe(true);
    expect(result.stubsFound).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  it('detects single-line and multi-line comment stubs in TS/JS files', () => {
    const dirtyFiles = {
      'src/api/handler.ts': `// TODO: Implement user authentication\nexport function auth() { return true; }`,
      'src/api/utils.ts': `/* STUB: Temporary helper */\nexport function help() { return 'ok'; }`
    };

    const result = validateZeroStubs(dirtyFiles);
    expect(result.isClean).toBe(false);
    expect(result.stubsFound.length).toBeGreaterThanOrEqual(2);
    expect(result.stubsFound[0]).toContain('COMMENT_STUB');
  });

  it('detects AST empty function bodies in TS/JS files', () => {
    const dirtyFiles = {
      'src/components/Empty.tsx': `export function doNothing() {}\nexport const arrowEmpty = () => {};`
    };

    const result = validateZeroStubs(dirtyFiles);
    expect(result.isClean).toBe(false);
    expect(result.violations.some((v) => v.rule === 'EMPTY_FUNCTION_BODY')).toBe(true);
  });

  it('detects throw statement Not Implemented errors in AST', () => {
    const dirtyFiles = {
      'src/services/pay.ts': `export function pay() { throw new Error("Not implemented yet"); }`
    };

    const result = validateZeroStubs(dirtyFiles);
    expect(result.isClean).toBe(false);
    expect(result.violations.some((v) => v.rule === 'THROW_NOT_IMPLEMENTED')).toBe(true);
  });

  it('detects explicit "any" type keywords in TS/TSX AST', () => {
    const dirtyFiles = {
      'src/types/bad.ts': `export function parse(data: any): any { return data; }`
    };

    const result = validateZeroStubs(dirtyFiles);
    expect(result.isClean).toBe(false);
    expect(result.violations.some((v) => v.rule === 'EXPLICIT_ANY_TYPE')).toBe(true);
  });

  it('detects Python pass statements and raise NotImplementedError stubs', () => {
    const pythonStubs = {
      'src/worker/tasks.py': `def handle_task():\n    pass\n\ndef failed_task():\n    raise NotImplementedError("TODO")`
    };

    const result = validateZeroStubs(pythonStubs);
    expect(result.isClean).toBe(false);
    expect(result.violations.some((v) => v.rule === 'PYTHON_PASS_STUB')).toBe(true);
    expect(result.violations.some((v) => v.rule === 'PYTHON_RAISE_NOT_IMPLEMENTED')).toBe(true);
  });

  it('detects Go panic stubs and empty func declarations', () => {
    const goStubs = {
      'src/api/main.go': `package main\nfunc emptyFunc() {}\nfunc panicFunc() { panic("not implemented") }`
    };

    const result = validateZeroStubs(goStubs);
    expect(result.isClean).toBe(false);
    expect(result.violations.some((v) => v.rule === 'GO_PANIC_STUB' || v.rule === 'GO_EMPTY_FUNCTION')).toBe(true);
  });

  it('detects empty or invalid SQL migration files', () => {
    const invalidSql = {
      'migrations/001_empty.sql': `-- TODO: write migrations\n`
    };

    const result = validateZeroStubs(invalidSql);
    expect(result.isClean).toBe(false);
    expect(result.violations.some((v) => v.rule === 'EMPTY_SQL_MIGRATION' || v.rule === 'POLYGLOT_STUB_TEXT')).toBe(
      true
    );
  });

  it('detects UI component placeholder text tags in HTML/JSX', () => {
    const uiStubs = {
      'src/frontend/App.tsx': `export function App() { return <div>TODO</div>; }`,
      'src/frontend/index.html': `<div><h1>Placeholder Component</h1></div>`
    };

    const result = validateZeroStubs(uiStubs);
    expect(result.isClean).toBe(false);
    expect(result.violations.some((v) => v.rule === 'UI_PLACEHOLDER_TEXT')).toBe(true);
  });

  it('validates clean Go code and detects unterminated string literals in Go files', () => {
    const validGo = {
      'src/worker/consumer.go': `package main\nimport "fmt"\nfunc main() {\n\tfmt.Printf("Hello %s\\n", "world")\n}\n`
    };
    const validResult = validateZeroStubs(validGo);
    expect(validResult.isClean).toBe(true);
    expect(validResult.astValid).toBe(true);

    const invalidGo = {
      'src/worker/consumer.go': `package main\nimport "fmt"\nfunc main() {\n\tfmt.Printf("Hello \n world")\n}\n`
    };
    const invalidResult = validateZeroStubs(invalidGo);
    expect(invalidResult.isClean).toBe(false);
    expect(invalidResult.astValid).toBe(false);
    expect(invalidResult.violations.some((v) => v.rule === 'GO_UNTERMINATED_STRING_LITERAL')).toBe(true);
  });

  it('detects TypeScript syntax parsing errors via parseDiagnostics', () => {
    const invalidTs = {
      'src/api/broken.ts': `export const x = ;`
    };
    const result = validateZeroStubs(invalidTs);
    expect(result.isClean).toBe(false);
    expect(result.astValid).toBe(false);
    expect(result.violations.some((v) => v.rule === 'TS_SYNTAX_ERROR')).toBe(true);
  });
});

describe('Milestone M2: Template Generator', () => {
  it('generates complete Frontend UI components with responsive dark theme layout', () => {
    const frontend = generateFrontend(mockSpec);

    expect(frontend['src/frontend/App.tsx']).toBeDefined();
    expect(frontend['src/frontend/components/MetricsCard.tsx']).toBeDefined();
    expect(frontend['src/frontend/components/ItemManager.tsx']).toBeDefined();
    expect(frontend['src/frontend/components/StatusBadge.tsx']).toBeDefined();

    // Verify key UI features
    const appTsx = frontend['src/frontend/App.tsx'];
    expect(appTsx).toContain('/api/health');
    expect(appTsx).toContain('/api/items');
    expect(appTsx).toContain('test-ecommerce-app');
    expect(appTsx).not.toContain('TODO');
  });

  it('generates Express Node.js API handlers exposing /health, /api/items, and /api/tasks', () => {
    const api = generateApi(mockSpec);
    const serverTs = api['src/api/server.ts'];

    expect(serverTs).toBeDefined();
    expect(serverTs).toContain('/health');
    expect(serverTs).toContain('/api/items');
    expect(serverTs).toContain('/api/tasks');
    expect(serverTs).toContain('process.env.DB_HOST');
  });

  it('generates Go REST API handler when Go runtime is specified', () => {
    const goSpec: StackTopologySpec = {
      ...mockSpec,
      runtimes: [
        { name: 'api', runtime: 'go', ports: [8080], envVariables: {} }
      ]
    };
    const api = generateApi(goSpec);
    expect(api['src/api/main.go']).toBeDefined();
    expect(api['src/api/main.go']).toContain('package main');
    expect(api['src/api/main.go']).toContain('/health');
    expect(api['src/api/main.go']).toContain('/api/items');
  });

  it('generates Python FastAPI handler when Python runtime is specified', () => {
    const pySpec: StackTopologySpec = {
      ...mockSpec,
      runtimes: [
        { name: 'api', runtime: 'python', ports: [8080], envVariables: {} }
      ]
    };
    const api = generateApi(pySpec);
    expect(api['src/api/main.py']).toBeDefined();
    expect(api['src/api/main.py']).toContain('FastAPI');
    expect(api['src/api/main.py']).toContain('/health');
  });

  it('generates gRPC handler and .proto file when gRPC option is enabled', () => {
    const api = generateApi(mockSpec, { enableGrpc: true });
    expect(api['src/api/grpc/items.proto']).toBeDefined();
    expect(api['src/api/grpc/server.ts']).toBeDefined();
    expect(api['src/api/grpc/items.proto']).toContain('syntax = "proto3";');
  });

  it('generates Python background queue consumer with signal handling and Valkey loop', () => {
    const worker = generateWorker(mockSpec);
    const consumerPy = worker['src/worker/consumer.py'];

    expect(consumerPy).toBeDefined();
    expect(consumerPy).toContain('VALKEY_HOST');
    expect(consumerPy).toContain('SIGTERM');
    expect(consumerPy).not.toContain('pass');
  });

  it('generates Node.js background queue consumer with Valkey and Postgres pool', () => {
    const nodeWorkerSpec: StackTopologySpec = {
      ...mockSpec,
      runtimes: [
        { name: 'worker', runtime: 'nodejs', ports: [], envVariables: {} }
      ]
    };
    const worker = generateWorker(nodeWorkerSpec);
    const consumerTs = worker['src/worker/consumer.ts'];

    expect(consumerTs).toBeDefined();
    expect(consumerTs).toContain('VALKEY_HOST');
    expect(consumerTs).toContain('DB_HOST');
    expect(consumerTs).toContain('SIGTERM');
  });

  it('generates Go background queue consumer with valid Go string literal syntax', () => {
    const goWorkerSpec: StackTopologySpec = {
      ...mockSpec,
      runtimes: [
        { name: 'worker', runtime: 'go', ports: [], envVariables: {} }
      ]
    };
    const worker = generateWorker(goWorkerSpec);
    const consumerGo = worker['src/worker/consumer.go'];

    expect(consumerGo).toBeDefined();
    expect(consumerGo).toContain('package main');
    expect(consumerGo).toContain('VALKEY_HOST');
    expect(consumerGo).toContain('processTask(counter)');
    expect(consumerGo).toContain('fmt.Printf("[Worker] Processing queue task #%d\\n", id)');
    expect(consumerGo).toContain('fmt.Printf("[Worker] Task #%d processed successfully.\\n", id)');

    // Verify there are no multiline unescaped string quote breaks
    expect(consumerGo).not.toMatch(/fmt\.Printf\("[^"\n]*\n[^"]*"\)/);

    const validation = validateZeroStubs(worker);
    expect(validation.isClean).toBe(true);
    expect(validation.astValid).toBe(true);
    expect(validation.violations).toHaveLength(0);
  });

  it('generates PostgreSQL schema migrations with DDL tables, indexes, and seed data', () => {
    const sql = generateSqlMigrations(mockSpec);
    const migrationSql = sql['migrations/001_init.sql'];

    expect(migrationSql).toBeDefined();
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS items');
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS idx_items_status');
    expect(migrationSql).toContain('INSERT INTO items');
    expect(migrationSql).toContain('ON CONFLICT (id) DO NOTHING');
  });
});

describe('Milestone M2: Code Synthesizer Orchestrator', () => {
  it('synthesizes multi-service code artifacts from StackTopologySpec', () => {
    const result = synthesizeCode(mockSpec);

    expect(result.files).toBeDefined();
    expect(Object.keys(result.files).length).toBeGreaterThanOrEqual(4);
    expect(result.hasPlaceholders).toBe(false);
    expect(result.astValid).toBe(true);
    expect(result.stubsFound).toHaveLength(0);
  });

  it('CodeSynthesizer class instance implements ICodeSynthesizer contract', () => {
    const synthesizer = new CodeSynthesizer();
    const result = synthesizer.synthesizeCode(mockSpec);

    expect(result.hasPlaceholders).toBe(false);

    const validation = synthesizer.validateZeroStubs(result.files);
    expect(validation.isClean).toBe(true);
    expect(validation.astValid).toBe(true);
  });

  it('integrates with synthesizeStack from prompt parser', () => {
    const spec = synthesizeStack('Create an e-commerce microservice with Bun frontend, Go API, and Python worker');
    const result = synthesizeCode(spec);

    expect(result.hasPlaceholders).toBe(false);
    expect(result.astValid).toBe(true);
    expect(result.files['migrations/001_init.sql']).toBeDefined();
  });
});
