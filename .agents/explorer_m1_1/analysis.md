# Technical Analysis & Architecture Design: `zeroops-engine` Setup (Milestone M1)

**Author**: Explorer 1 (M1)  
**Date**: 2026-08-08  
**Scope**: Workspace Investigation, Project Setup, Dependency Selection, Configuration Specs, Layout, CLI Entry Point Design, and Test/Build Tooling.

---

## 1. Existing Workspace Investigation Findings

### 1.1 State Observation
- **Target Path**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`
- **Current Status**: The directory does **not** exist yet on the filesystem.
- **Root Directory Context**: The project workspace root `/Users/arogyabichpuria/Documents/side-quests/zerops-hack` contains `ORIGINAL_REQUEST.md`, `PROJECT.md`, `TEST_INFRA.md`, `zerops-challenge-brief.html`, `.agents/`, `exa-results/`, and `research/`.

### 1.2 Required Setup Action
The Implementer agent for M1 must create `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine` and scaffold the initial project configuration files (`package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `src/index.ts`, etc.) as specified below.

---

## 2. Technical Stack & Tooling Rationale

| Layer / Tool | Selection | Rationale & Trade-offs |
|--------------|-----------|------------------------|
| **Runtime** | Node.js (>=18.0.0) | ES2022 support, native `fetch` API, modern async/await, broad ecosystem support. |
| **Language** | TypeScript (v5.4+) | Strict static typing, type safety across synthesizer interfaces (`StackTopologySpec`, `GeneratedConfigs`), autocomplete & refactoring resilience. |
| **Module System** | Pure ESM (`"type": "module"`) | Modern Node standard, native dynamic imports, aligns with modern package ecosystem (`chalk`, `commander`, `vitest`). |
| **Build Tool** | `tsup` (esbuild wrapper) | Extremely fast compilation (~100x faster than `tsc`), automatic bundle generation into ESM, automatic `.d.ts` generation, seamless CLI shebang (`#!/usr/bin/env node`) injection via `banner`. |
| **Test Runner** | `vitest` | Native TypeScript & ESM support without transformation hacks (`ts-jest`), fast multi-threaded test execution, Jest-compatible assertions, standard `vitest run` exit codes. |
| **CLI Parser** | `commander` | Robust, type-safe command and option parsing, automatic help generation, subcommand structure. |
| **YAML Engine** | `js-yaml` + `@types/js-yaml` | Standard parser/dumper for YAML in Node.js, required for parsing and serializing `zerops-project-import.yml` and `zerops.yml`. |
| **Validation** | `zod` | Runtime schema validation for user prompt parameters, stack topology specs, and zero-stub validator checks across milestones. |
| **CLI Utilities** | `picocolors` | Zero-dependency, ultra-fast terminal output formatting for colored logs. |

---

## 3. Configuration Specifications

### 3.1 `package.json`

```json
{
  "name": "zeroops-engine",
  "version": "1.0.0",
  "description": "ZeroOps — Full-Stack Autonomous Cloud Factory Engine",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "zeroops": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "js-yaml": "^4.1.0",
    "picocolors": "^1.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.11.0",
    "tsup": "^8.0.2",
    "tsx": "^4.7.1",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 3.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests/**/*"]
}
```

### 3.3 `tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node\n',
  },
});
```

### 3.4 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## 4. Directory Layout Architecture (`zeroops-engine/`)

```
zeroops-engine/
├── package.json                     # Project manifest, dependencies, and script runner rules
├── tsconfig.json                    # TypeScript compiler options (ES2022/NodeNext strict)
├── tsup.config.ts                   # ESM bundler & CLI executable configuration
├── vitest.config.ts                 # Vitest test suite runner configuration
├── src/
│   ├── index.ts                     # Main CLI & programmatic library entry point
│   ├── synthesizer/                 # ZCP YAML & Stack Synthesizer (M1 Core)
│   │   ├── index.ts                 # Synthesizer module exports
│   │   ├── types.ts                 # StackTopologySpec, GeneratedConfigs, ZeropsYamlSpec
│   │   ├── stack-synthesizer.ts     # Natural language prompt -> Stack topology parser
│   │   ├── yaml-generator.ts        # zerops.yml & zerops-project-import.yml builder
│   │   └── private-net.ts           # Inter-service private IP env var injector
│   ├── zcp/                         # ZCP API & zcli Orchestration Bridge (M1 Core)
│   │   ├── index.ts                 # ZCP module exports
│   │   ├── zcp-client.ts            # ZCP REST client / zcli runner (real & mock modes)
│   │   ├── runner.ts               # Subprocess execution & deployment command runner
│   │   └── logger.ts               # Deployment process logging
│   ├── code-gen/                    # Full-Stack Code & Schema Synthesizer (M2 layout)
│   │   ├── index.ts
│   │   ├── code-synthesizer.ts
│   │   ├── template-generator.ts
│   │   └── stub-validator.ts
│   ├── studio/                      # Dark-Mode Web Studio & WS Log Streamer (M3 layout)
│   │   ├── server.ts
│   │   ├── ws-logger.ts
│   │   └── public/
│   │       ├── index.html
│   │       ├── app.js
│   │       ├── topology-canvas.js
│   │       └── style.css
│   └── verifier/                    # Automated Live Verification Suite (M4 layout)
│       ├── live-auditor.ts
│       ├── http-checker.ts
│       ├── db-auditor.ts
│       └── queue-auditor.ts
├── tests/                           # E2E & Unit Test Suites (TEST_INFRA.md aligned)
│   ├── unit/
│   │   ├── stack-synthesizer.test.ts
│   │   ├── yaml-generator.test.ts
│   │   └── private-net.test.ts
│   └── integration/
│       └── cli.test.ts
└── docs/                            # AI Usage & Video Storyboard Docs (M5 layout)
    ├── AI-USAGE.md
    └── DEMO_STORYBOARD.md
```

---

## 5. Exported Entry Point Design (`src/index.ts`)

`src/index.ts` is dual-purpose:
1. **CLI Executable**: Executable when called via command line (e.g. `npx zeroops synthesize --prompt "..."`).
2. **Library API Exports**: Re-exports all core domain types, functions, and client classes so other modules or external test runners can import them programmatically.

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import { synthesizeStack } from './synthesizer/stack-synthesizer.js';
import { generateZeropsYaml, generateProjectImportYaml } from './synthesizer/yaml-generator.js';
import { injectPrivateNetEnv } from './synthesizer/private-net.js';
import { ZcpClient } from './zcp/zcp-client.js';

// Programmatic API Exports
export * from './synthesizer/types.js';
export * from './synthesizer/stack-synthesizer.js';
export * from './synthesizer/yaml-generator.js';
export * from './synthesizer/private-net.js';
export * from './zcp/zcp-client.js';

// CLI Setup
const program = new Command();

program
  .name('zeroops')
  .description('ZeroOps — Full-Stack Autonomous Cloud Factory Engine CLI')
  .version('1.0.0');

program
  .command('synthesize')
  .description('Synthesize Zerops project import and zerops.yml configs from prompt')
  .option('-p, --prompt <string>', 'Prompt describing requested application stack', 'Full-stack application with Frontend, API Gateway, Worker, PostgreSQL HA, and Valkey Cache')
  .option('--mock', 'Run synthesis in mock mode', true)
  .action(async (options) => {
    console.log(pc.cyan('[ZeroOps Engine] Synthesizing stack topology...'));
    const topology = synthesizeStack(options.prompt);
    const enrichedTopology = injectPrivateNetEnv(topology);
    const zeropsYaml = generateZeropsYaml(enrichedTopology);
    const importYaml = generateProjectImportYaml(enrichedTopology);

    console.log(pc.green(`✔ Synthesis complete for project: ${enrichedTopology.projectName}`));
    console.log(pc.bold('\n--- zerops-project-import.yml ---'));
    console.log(importYaml);
    console.log(pc.bold('\n--- zerops.yml ---'));
    console.log(zeropsYaml);
  });

program
  .command('deploy')
  .description('Deploy synthesized stack to Zerops via ZCP API or zcli bridge')
  .option('--project <name>', 'Project name on Zerops')
  .option('--mock', 'Run deployment in mock mode', true)
  .action(async (options) => {
    const client = new ZcpClient({ mock: options.mock });
    console.log(pc.cyan(`[ZeroOps Engine] Initiating deployment for project: ${options.project || 'zeroops-demo'}`));
    const result = await client.deployProject(options.project || 'zeroops-demo');
    console.log(pc.green(`✔ Deployment completed: ${JSON.stringify(result)}`));
  });

// Execute CLI parser when executed directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('zeroops') ||
  process.argv[1]?.endsWith('index.js')
) {
  program.parse(process.argv);
}
```

---

## 6. Build and Test Command Recommendations

1. **`npm run build`**:  
   Runs `tsup`. Bundle output goes to `./dist/index.js` with shebang header, `.d.ts` declaration files, and source maps.
2. **`npm test`**:  
   Runs `vitest run`. Executes all test suites under `tests/` synchronously/asynchronously and exits with code 0 on success.
3. **`npm run dev`**:  
   Runs `tsx watch src/index.ts synthesize`, allowing live execution during development without pre-building.
4. **`npm run typecheck`**:  
   Runs `tsc --noEmit` to validate strict typing across all files without emitting JS.
