import { validateZeroStubs, validateTsAst, validateNonTsFile } from '../src/code-gen/stub-validator.js';
import { synthesizeCode, CodeSynthesizer } from '../src/code-gen/code-synthesizer.js';
import { StackTopologySpec } from '../src/synthesizer/types.js';

interface TestResult {
  id: string;
  category: string;
  description: string;
  expectedClean: boolean;
  actualClean: boolean;
  passed: boolean;
  details: any;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;

function runTest(id: string, category: string, description: string, expectedClean: boolean, files: Record<string, string>, extraCheck?: (res: ReturnType<typeof validateZeroStubs>) => boolean) {
  const res = validateZeroStubs(files);
  const condition = (res.isClean === expectedClean) && (extraCheck ? extraCheck(res) : true);
  
  if (condition) {
    passCount++;
    results.push({ id, category, description, expectedClean, actualClean: res.isClean, passed: true, details: res });
    console.log(`[PASS] [${id}] [${category}] ${description}`);
  } else {
    failCount++;
    results.push({ id, category, description, expectedClean, actualClean: res.isClean, passed: false, details: res });
    console.error(`[FAIL] [${id}] [${category}] ${description}`);
    console.error(`       Expected isClean=${expectedClean}, got isClean=${res.isClean}`);
    console.error(`       Violations:`, res.violations);
  }
}

console.log('=== MILESTONE M2 ADVERSARIAL EMPIRICAL TEST HARNESS ===\n');

// -------------------------------------------------------------
// SECTION 1: Tricky & Obfuscated Stub Detection (Must REJECT / isClean = false)
// -------------------------------------------------------------
console.log('--- SECTION 1: Stub Detection Tests (Expected isClean = false) ---');

runTest('STUB-01', 'Stub Detection', 'Single line comment // TODO', false, {
  'src/file.ts': '// TODO: Implement authentication logic\nexport const a = 1;'
});

runTest('STUB-02', 'Stub Detection', 'Lowercase comment // todo', false, {
  'src/file.ts': '// todo: finish this\nexport const a = 1;'
});

runTest('STUB-03', 'Stub Detection', 'Block comment /* TODO */', false, {
  'src/file.ts': '/* TODO: refactor */\nexport const a = 1;'
});

runTest('STUB-04', 'Stub Detection', 'Multiline block comment /* \\n * TODO \\n */', false, {
  'src/file.ts': '/*\n * TODO: implement data model\n */\nexport const a = 1;'
});

runTest('STUB-05', 'Stub Detection', 'Inline comment inside arguments function f(/* TODO */ a: number)', false, {
  'src/file.ts': 'export function f(/* TODO: type */ a: number) { return a * 2; }'
});

runTest('STUB-06', 'Stub Detection', 'Forbidden keywords: FIXME, STUB, XXX, HACK, PLACEHOLDER, NOT_IMPLEMENTED, DUMMY', false, {
  'src/file.ts': '// FIXME: memory leak\n// STUB: mock implementation\n// XXX: dangerously set\n// HACK: work around bug\n// PLACEHOLDER: code goes here\n// NOT_IMPLEMENTED: missing feature\n// DUMMY: test payload'
});

runTest('STUB-07', 'Stub Detection', 'Empty function declaration function empty() {}', false, {
  'src/file.ts': 'export function empty() {}'
});

runTest('STUB-08', 'Stub Detection', 'Empty arrow function const arrow = () => {};', false, {
  'src/file.ts': 'export const arrow = () => {};'
});

runTest('STUB-09', 'Stub Detection', 'Empty class method method() {}', false, {
  'src/file.ts': 'export class A { method() {} }'
});

runTest('STUB-10', 'Stub Detection', 'Empty async function async function emptyAsync() {}', false, {
  'src/file.ts': 'export async function emptyAsync() {}'
});

runTest('STUB-11', 'Stub Detection', 'Throw new Error("Not implemented")', false, {
  'src/file.ts': 'export function work() { throw new Error("Not implemented"); }'
});

runTest('STUB-12', 'Stub Detection', 'Throw new Error("TODO: implement")', false, {
  'src/file.ts': 'export function work() { throw new Error("TODO: implement"); }'
});

runTest('STUB-13', 'Stub Detection', 'Explicit any type parameter (arg: any)', false, {
  'src/file.ts': 'export function processData(data: any): number { return 42; }'
});

runTest('STUB-14', 'Stub Detection', 'Explicit any return type (): any', false, {
  'src/file.ts': 'export function getData(): any { return { a: 1 }; }'
});

runTest('STUB-15', 'Stub Detection', 'Explicit any variable declaration let x: any', false, {
  'src/file.ts': 'let item: any = "data";\nexport { item };'
});

runTest('STUB-16', 'Stub Detection', 'Mock return string return "dummy_value"', false, {
  'src/file.ts': 'export function getVal() { return "dummy_value"; }'
});

runTest('STUB-17', 'Stub Detection', 'Mock return string return "placeholder_string"', false, {
  'src/file.ts': 'export function getVal() { return "placeholder_string"; }'
});

runTest('STUB-18', 'Stub Detection', 'Python pass in function body', false, {
  'src/worker.py': 'def handle_job():\n    pass\n'
});

runTest('STUB-19', 'Stub Detection', 'Python raise NotImplementedError', false, {
  'src/worker.py': 'def handle_job():\n    raise NotImplementedError("Not implemented")\n'
});

runTest('STUB-20', 'Stub Detection', 'Go empty function body func empty() {}', false, {
  'src/main.go': 'package main\nfunc empty() {}\nfunc main() { empty() }'
});

runTest('STUB-21', 'Stub Detection', 'Go panic("not implemented")', false, {
  'src/main.go': 'package main\nfunc run() { panic("not implemented") }\nfunc main() { run() }'
});

runTest('STUB-22', 'Stub Detection', 'Empty SQL migration file', false, {
  'migrations/001.sql': '-- Migration file without DDL\n'
});

runTest('STUB-23', 'Stub Detection', 'HTML/JSX tag containing <div>TODO</div>', false, {
  'src/App.tsx': 'export function App() { return <div>TODO</div>; }'
});

runTest('STUB-24', 'Stub Detection', 'HTML tag containing <span>Placeholder</span>', false, {
  'src/index.html': '<div><span>Placeholder</span></div>'
});


// -------------------------------------------------------------
// SECTION 2: False Positive Checks (Valid Code Must PASS / isClean = true)
// -------------------------------------------------------------
console.log('\n--- SECTION 2: False Positive Tests (Expected isClean = true) ---');

runTest('FP-01', 'False Positive', 'HTML input element with placeholder attribute', true, {
  'src/index.html': '<input type="text" name="email" placeholder="Enter your email address..." />'
});

runTest('FP-02', 'False Positive', 'React TSX component with placeholder input attribute', true, {
  'src/Component.tsx': 'import React from "react";\nexport function Input() { return <input placeholder="Search items..." />; }'
});

runTest('FP-03', 'False Positive', 'TS function with complete body and typed parameters', true, {
  'src/math.ts': 'export function add(a: number, b: number): number {\n  return a + b;\n}'
});

runTest('FP-04', 'False Positive', 'TS Interface declaration with method signatures', true, {
  'src/types.ts': 'export interface User {\n  id: string;\n  name: string;\n  getRole(): string;\n}'
});

runTest('FP-05', 'False Positive', 'TS Type Alias declaration', true, {
  'src/types.ts': 'export type RequestHandler = (req: Request, res: Response) => Promise<void>;'
});

runTest('FP-06', 'False Positive', 'Variable names containing sub-words (password, company, autodocumentation)', true, {
  'src/auth.ts': 'const password = "secure_hash";\nconst companyName = "Acme Inc";\nconst isPassed = true;\nif (isPassed && password) {\n  console.log(companyName);\n}'
});

runTest('FP-07', 'False Positive', 'Valid Python function returning value', true, {
  'src/app.py': 'def calculate_total(price, tax):\n    return price * (1 + tax)\n'
});

runTest('FP-08', 'False Positive', 'Valid Go main package', true, {
  'src/main.go': 'package main\nimport "fmt"\nfunc main() {\n    fmt.Println("Server running")\n}'
});

runTest('FP-09', 'False Positive', 'Valid PostgreSQL DDL Migration with CREATE TABLE & indexes', true, {
  'migrations/001.sql': 'CREATE TABLE users (\n    id UUID PRIMARY KEY,\n    email VARCHAR(255) NOT NULL\n);\nCREATE INDEX idx_users_email ON users(email);'
});


// -------------------------------------------------------------
// SECTION 3: Code Synthesizer Multi-Spec Verification
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Code Synthesizer Multi-Spec Integration Tests ---');

const synthSpecs: Array<{ name: string; spec: StackTopologySpec; options?: any }> = [
  {
    name: 'E-Commerce Node/Python Stack',
    spec: {
      projectName: 'ecommerce-platform',
      runtimes: [
        { name: 'frontend', runtime: 'nodejs', ports: [3000], envVariables: { PORT: '3000' } },
        { name: 'api', runtime: 'nodejs', ports: [8080], envVariables: { PORT: '8080', DB_HOST: '10.0.0.1' } },
        { name: 'worker', runtime: 'python', ports: [], envVariables: { VALKEY_HOST: '10.0.0.2' } }
      ],
      managedServices: [
        { name: 'postgres', type: 'postgresql', mode: 'HA' },
        { name: 'valkey', type: 'valkey', mode: 'SINGLE' }
      ]
    }
  },
  {
    name: 'Go Microservice Stack',
    spec: {
      projectName: 'go-microservice',
      runtimes: [
        { name: 'frontend', runtime: 'nodejs', ports: [3000], envVariables: {} },
        { name: 'api', runtime: 'go', ports: [8080], envVariables: {} },
        { name: 'worker', runtime: 'go', ports: [], envVariables: {} }
      ],
      managedServices: [
        { name: 'postgres', type: 'postgresql', mode: 'SINGLE' },
        { name: 'valkey', type: 'valkey', mode: 'SINGLE' }
      ]
    }
  },
  {
    name: 'Python FastAPI Stack',
    spec: {
      projectName: 'fastapi-stack',
      runtimes: [
        { name: 'frontend', runtime: 'nodejs', ports: [3000], envVariables: {} },
        { name: 'api', runtime: 'python', ports: [8000], envVariables: {} },
        { name: 'worker', runtime: 'python', ports: [], envVariables: {} }
      ],
      managedServices: [
        { name: 'postgres', type: 'postgresql', mode: 'HA' },
        { name: 'valkey', type: 'valkey', mode: 'SINGLE' }
      ]
    }
  },
  {
    name: 'Node API with gRPC enabled',
    spec: {
      projectName: 'grpc-api-stack',
      runtimes: [
        { name: 'api', runtime: 'nodejs', ports: [8080], envVariables: {} }
      ],
      managedServices: [
        { name: 'postgres', type: 'postgresql', mode: 'SINGLE' }
      ]
    },
    options: { enableGrpc: true }
  }
];

const synthesizer = new CodeSynthesizer();

for (let i = 0; i < synthSpecs.length; i++) {
  const { name, spec, options } = synthSpecs[i];
  const artifact = synthesizer.synthesizeCode(spec, options);
  
  const testId = `SYNTH-0${i + 1}`;
  const filesCount = Object.keys(artifact.files).length;
  const isClean = !artifact.hasPlaceholders && artifact.astValid && (artifact.stubsFound?.length === 0);
  
  if (isClean && filesCount >= 3) {
    passCount++;
    results.push({
      id: testId,
      category: 'Synthesizer Spec',
      description: `Synthesized ${name} (${filesCount} files) with zero stubs`,
      expectedClean: true,
      actualClean: isClean,
      passed: true,
      details: { filesGenerated: Object.keys(artifact.files), stubsFound: artifact.stubsFound }
    });
    console.log(`[PASS] [${testId}] [Synthesizer Spec] Synthesized ${name} (${filesCount} files) - Clean: ${isClean}`);
  } else {
    failCount++;
    results.push({
      id: testId,
      category: 'Synthesizer Spec',
      description: `Synthesized ${name} (${filesCount} files) - Clean: ${isClean}`,
      expectedClean: true,
      actualClean: isClean,
      passed: false,
      details: { artifact, violations: artifact.stubsFound }
    });
    console.error(`[FAIL] [${testId}] [Synthesizer Spec] ${name} failed clean check`, artifact.stubsFound);
  }
}


// -------------------------------------------------------------
// SECTION 4: Edge Cases & Adversarial Attack Vectors
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Edge Cases & Adversarial Stress Tests ---');

// Edge 1: Python pass after docstring
runTest('EDGE-01', 'Edge Case', 'Python pass statement following a docstring', false, {
  'src/worker.py': 'def my_func():\n    """Docstring explaining method."""\n    pass\n'
});

// Edge 2: Python pass inside an if-statement block
runTest('EDGE-02', 'Edge Case', 'Python pass inside if block: if cond: pass', false, {
  'src/worker.py': 'def process(val):\n    if val is None:\n        pass\n    return val * 2\n'
});

// Edge 3: Arrow function returning empty object literal vs empty block body () => ({})
runTest('EDGE-03', 'Edge Case', 'Arrow function returning empty object ({}) vs empty block body', true, {
  'src/component.ts': 'export const getEmptyObj = () => ({});'
});

// Edge 4: Syntax error in TS file (invalid AST)
const syntaxErrResult = validateZeroStubs({
  'src/broken.ts': 'export function badSyntax('
});
const syntaxErrPassed = !syntaxErrResult.astValid || !syntaxErrResult.isClean;
if (syntaxErrPassed) {
  passCount++;
  results.push({
    id: 'EDGE-04',
    category: 'Edge Case',
    description: 'TS Syntax Error correctly sets astValid=false or isClean=false',
    expectedClean: false,
    actualClean: syntaxErrResult.isClean,
    passed: true,
    details: syntaxErrResult
  });
  console.log(`[PASS] [EDGE-04] [Edge Case] TS Syntax Error handled gracefully (astValid=${syntaxErrResult.astValid})`);
} else {
  failCount++;
  results.push({
    id: 'EDGE-04',
    category: 'Edge Case',
    description: 'TS Syntax Error failed to be reported',
    expectedClean: false,
    actualClean: syntaxErrResult.isClean,
    passed: false,
    details: syntaxErrResult
  });
  console.error(`[FAIL] [EDGE-04] [Edge Case] TS Syntax Error was not caught properly`);
}

// Edge 5: Check if validateTsAst handles JSX / TSX tags without crash
runTest('EDGE-05', 'Edge Case', 'Valid React TSX component AST parsing', true, {
  'src/App.tsx': 'import React from "react";\nexport function App(): React.ReactElement { return <div className="p-4"><h1>Hello World</h1></div>; }'
});


console.log('\n=============================================================');
console.log(`TOTAL TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (${results.length} total)`);
console.log('=============================================================\n');

if (failCount > 0) {
  console.log('FAILED TESTS SUMMARY:');
  for (const r of results.filter(r => !r.passed)) {
    console.log(`- [${r.id}] ${r.description}`);
  }
}
