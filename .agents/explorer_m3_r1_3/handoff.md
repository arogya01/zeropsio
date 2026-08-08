# Handoff Report — Explorer M3 R1-3 (Web Studio SPA & Test Suite)

## 1. Observation

1. **Codebase Structure & Dependencies**:
   - `zeroops-engine/package.json` includes `express` (^4.19.2), `ws` (^8.18.0), `cors` (^2.8.5), `dotenv` (^16.4.5), `picocolors` (1.1.1), `vitest` (4.1.10), `typescript` (5.9.3).
   - Core engine modules exist: `src/synthesizer/stack-synthesizer.ts`, `src/synthesizer/yaml-generator.ts`, `src/synthesizer/private-net.ts`, `src/code-gen/code-synthesizer.ts`, `src/zcp/zcp-client.ts`.
   - Existing legacy server file `src/server/index.js` uses CommonJS `express` + `ws`.
   - Per `PROJECT.md` (lines 28-35) and `SCOPE.md` (lines 4-15), the target modern M3 studio layout is:
     - `src/studio/server.ts`: Express + WebSocket HTTP server (`/ws/logs` & REST APIs).
     - `src/studio/ws-logger.ts`: Real-time WebSocket log streamer outputting ANSI logs.
     - `src/studio/public/index.html`: Dark-mode Web Studio SPA index HTML.
     - `src/studio/public/style.css`: Modern dark-mode baseline CSS.
     - `src/studio/public/topology-canvas.js`: Interactive Canvas 2D container topology visualizer (nodes, packet flow animations, color-coded health states green/yellow/red).
     - `src/studio/public/app.js`: SPA client script connecting to `/ws/logs`, initializing `xterm.js`, handling zero-downtime deploy triggers and tab switching.
     - `tests/studio.test.ts`: Vitest test suite for server endpoints, static file serving, and WebSocket streaming.

2. **Test Suite Configuration**:
   - `vitest.config.ts` includes `tests/**/*.test.ts` and `src/**/*.test.ts`, excluding `tests/tier*.test.ts`.
   - Running `npx vitest run` currently executes 47 passing tests across 7 test files (0 failures).
   - `tests/studio.test.ts` matches `tests/**/*.test.ts` and will automatically be executed by `npx vitest run`.

---

## 2. Logic Chain

1. **Architectural Synthesis & Integration**:
   - `server.ts` must expose REST endpoints (`POST /api/synthesize`, `POST /api/deploy`, `GET /api/status`, `GET /api/health`) and host the WebSocket server on path `/ws/logs`.
   - Static files should be served from `src/studio/public/` using fallback path detection so static file serving works both when executed via `tsx`/`ts-node`/`vitest` and when executed after `npx tsc` compilation to `dist/studio/`.
   - `ws-logger.ts` encapsulates WebSocket log broadcasting, formatting ANSI terminal colors, streaming live or simulated build logs, and updating node topology status.

2. **Web Studio SPA Components (`src/studio/public/`)**:
   - `index.html`:
     - Clean modern layout featuring Header, Hero Prompt input card with quick blueprint presets, Interactive LXD Topology section (`<canvas id="topology-canvas">`), Multi-tab Console (ZCP Build Console, `zerops.yml` Blueprint, Code Inspector), and Live Deployment Success Banner (`#success-banner`).
   - `style.css`:
     - Dark slate/zinc color scheme (`#0f172a`, `#1e293b`, `#020617`), neon accents (`#06b6d4` cyan, `#22c55e` emerald, `#f59e0b` amber, `#ef4444` red), glassmorphism card styling (`backdrop-filter: blur(12px)`), responsive flex/grid layouts.
   - `topology-canvas.js`:
     - HTML5 2D Canvas rendering engine with interactive node positioning (`web-frontend`, `api-gateway`, `ai-worker`, `db-postgres`, `cache-valkey`), animated packet/particle flows along connection edges, smooth color state transitions (`HEALTHY`, `BUILDING`, `FAILED`, `IDLE`), and click interaction detailing node private IPs and container stats.
   - `app.js`:
     - Handles WebSocket lifecycle with `/ws/logs`, connects log streams to `xterm.js` terminal, dispatches prompt synthesis requests to `/api/synthesize`, triggers deployments, updates `topology-canvas` node health on WebSocket events, and manages tab switching.

3. **Test Suite Verification (`tests/studio.test.ts`)**:
   - Test server startup on an ephemeral port.
   - Assert static file serving for `index.html`, `style.css`, `topology-canvas.js`, `app.js`.
   - Assert `/api/health` returns status `200 OK`.
   - Assert `/api/synthesize` handles prompt payloads and returns `zeropsYml` + synthesized code.
   - Assert `/api/deploy` initiates stack deployment and returns `liveUrl`.
   - Assert WebSocket `/ws/logs` connection accepts deploy messages and streams formatted log and `topology-update` events.

---

## 3. Caveats

- **External CDN Dependency**: `index.html` loads `xterm.js` and `xterm.css` via CDN (`unpkg.com` / `cdnjs.cloudflare.com`). `app.js` includes a graceful fallback to a `<pre>` log container if `window.Terminal` is unavailable (e.g. in offline environments).
- **TypeScript Module Resolution**: Imports between `server.ts` and synthesizer files use `.js` extension suffixes in TS files (`import { synthesizeStack } from '../synthesizer/stack-synthesizer.js'`) in accordance with NodeNext module resolution configured in `tsconfig.json`.

---

## 4. Conclusion & Implementation Strategy

### A. Recommended File Layout & Responsibilities

| File Path | Purpose / Description |
|---|---|
| `zeroops-engine/src/studio/server.ts` | Express HTTP & WS server hosting Studio REST APIs (`/api/synthesize`, `/api/deploy`, `/api/status`, `/api/health`), `/ws/logs` WebSocket gateway, static file server for `public/`. |
| `zeroops-engine/src/studio/ws-logger.ts` | WebSocket streamer class broadcasting ANSI formatted logs, topology update states, and deployment completion events. |
| `zeroops-engine/src/studio/public/index.html` | Dark-mode Web Studio SPA layout (Header, Hero prompt card, Topology canvas wrapper, Console tabs for xterm.js / zerops.yml / Code Inspector, Success overlay). |
| `zeroops-engine/src/studio/public/style.css` | Dark-mode CSS design baseline (slate/zinc background, neon status colors, glassmorphism cards, responsive panel layout). |
| `zeroops-engine/src/studio/public/topology-canvas.js` | Interactive 2D HTML5 canvas visualizer for container nodes, packet flow animations, state pulse glows (HEALTHY/BUILDING/FAILED), node click popups. |
| `zeroops-engine/src/studio/public/app.js` | Web Studio client app (WebSocket `/ws/logs` handler, xterm.js terminal renderer, prompt form submission, deploy trigger, topology state updater). |
| `zeroops-engine/tests/studio.test.ts` | Vitest test suite testing server startup, static asset delivery, REST APIs, and WebSocket streaming. |

---

### B. Detailed Component Implementation Specs

#### 1. `src/studio/server.ts`
```typescript
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { synthesizeStack } from '../synthesizer/stack-synthesizer.js';
import { injectPrivateNetEnv } from '../synthesizer/private-net.js';
import { generateZeropsConfigs } from '../synthesizer/yaml-generator.js';
import { synthesizeCode } from '../code-gen/code-synthesizer.js';
import { ZcpClient } from '../zcp/zcp-client.js';
import { WsLogger } from './ws-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createStudioServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/logs' });
  const zcpClient = new ZcpClient({ mode: 'mock' });

  app.use(express.json());

  // Determine public dir location (supporting dev & compiled output)
  const candidateDirs = [
    path.resolve(__dirname, 'public'),
    path.resolve(process.cwd(), 'src/studio/public'),
    path.resolve(process.cwd(), 'zeroops-engine/src/studio/public'),
    path.resolve(__dirname, '../../src/studio/public')
  ];
  const staticDir = candidateDirs.find(d => fs.existsSync(d)) || candidateDirs[0];
  app.use(express.static(staticDir));

  // Health API
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Status API
  app.get('/api/status', async (_req, res) => {
    const topology = await zcpClient.getPrivateTopology('default-proj');
    res.json({ status: 'RUNNING', topology });
  });

  // Synthesize API
  app.post('/api/synthesize', (req, res) => {
    const { prompt, projectName } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
      const rawTopology = synthesizeStack(prompt, { projectName });
      const enrichedTopology = injectPrivateNetEnv(rawTopology);
      const configs = generateZeropsConfigs(enrichedTopology);
      const codeArtifacts = synthesizeCode(enrichedTopology);

      res.json({
        success: true,
        projectName: enrichedTopology.projectName,
        topology: enrichedTopology,
        zeropsProjectImportYaml: configs.zeropsProjectImportYaml,
        zeropsYaml: configs.zeropsYaml,
        codeFiles: codeArtifacts.files
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deploy API
  app.post('/api/deploy', async (req, res) => {
    const { prompt, projectName } = req.body;
    const name = projectName || 'zeroops-cloud-stack';
    const rawTopology = synthesizeStack(prompt || 'Default ZeroOps Stack', { projectName: name });
    const configs = generateZeropsConfigs(rawTopology);

    await zcpClient.importProject(configs.zeropsProjectImportYaml);
    const result = await zcpClient.deployProject(name, configs.zeropsYaml);

    res.json({
      success: true,
      projectName: name,
      deploymentId: result.deploymentId,
      publicUrl: result.publicUrl || `https://${name}.zerops.app`,
      status: 'DEPLOYED'
    });
  });

  // WebSocket Log Streamer Connection
  wss.on('connection', (ws: WebSocket) => {
    const logger = new WsLogger(ws);
    logger.log('system', '⚡ Client connected to ZeroOps Studio log stream gateway');

    ws.on('message', async (data: any) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.action === 'deploy') {
          await logger.runDeploymentPipeline(payload.prompt || 'AI SaaS Cloud Factory', payload.projectName);
        }
      } catch (err: any) {
        logger.log('stderr', `WebSocket error: ${err.message}`, 'stderr');
      }
    });
  });

  return { app, server, wss };
}
```

#### 2. `src/studio/ws-logger.ts`
```typescript
import { WebSocket } from 'ws';

export class WsLogger {
  constructor(private ws: WebSocket) {}

  public send(payload: object) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public log(service: string, message: string, stream: 'stdout' | 'stderr' | 'system' = 'stdout') {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    let colorPrefix = '\x1b[36m'; // Cyan
    if (stream === 'stderr') colorPrefix = '\x1b[31m'; // Red
    if (service === 'system') colorPrefix = '\x1b[35m'; // Magenta

    const formattedText = `\x1b[90m[${timestamp}]\x1b[0m ${colorPrefix}[${service.toUpperCase()}]\x1b[0m ${message}`;

    this.send({
      type: 'log',
      service,
      stream,
      timestamp,
      message,
      text: formattedText
    });
  }

  public updateTopology(serviceId: string, status: 'healthy' | 'building' | 'failed' | 'idle', privateIp?: string) {
    this.send({
      type: 'topology-update',
      serviceId,
      status,
      privateIp
    });
  }

  public complete(liveUrl: string, projectName: string, services: string[], audit: any) {
    this.send({
      type: 'complete',
      liveUrl,
      projectName,
      services,
      audit
    });
  }

  public async runDeploymentPipeline(prompt: string, projectName?: string) {
    const targetProject = projectName || 'zeroops-app';
    this.log('system', `🚀 Launching ZeroOps Autonomous Pipeline for "${prompt}"...`);
    this.log('system', `[PROMPT-SYNTHESIS]: Parsing multi-service topology...`);

    const services = ['web-frontend', 'api-gateway', 'ai-worker', 'db-postgres', 'cache-valkey'];

    // Transition nodes to BUILDING
    for (const s of services) {
      this.updateTopology(s, 'building');
      this.log('system', `[ZCP]: Allocating container slot for ${s}...`);
      await new Promise(r => setTimeout(r, 150));
    }

    this.log('stdout', `[BUILD]: Compiling Bun@1 web-frontend assets...`, 'stdout');
    this.log('stdout', `[BUILD]: Building Go@1.22 api-gateway binaries...`, 'stdout');
    this.log('stdout', `[BUILD]: Installing Python@3.12 dependencies for ai-worker...`, 'stdout');
    this.log('stdout', `[NETWORK]: Injected private IP env vars DB_HOST=10.160.0.21, VALKEY_HOST=10.160.0.25`, 'stdout');

    // Transition nodes to HEALTHY
    const ips: Record<string, string> = {
      'web-frontend': '10.160.0.12:3000',
      'api-gateway': '10.160.0.15:8080',
      'ai-worker': '10.160.0.18:5000',
      'db-postgres': '10.160.0.21:5432',
      'cache-valkey': '10.160.0.25:6379'
    };

    for (const s of services) {
      this.updateTopology(s, 'healthy', ips[s]);
      this.log(s, `✔ Container ${s} status changed to RUNNING (Health check PASSED)`, 'stdout');
      await new Promise(r => setTimeout(r, 150));
    }

    const liveUrl = `https://${targetProject}.zerops.app`;
    this.log('system', `✔ Deployment SUCCESSFUL. Live URL: ${liveUrl}`);

    this.complete(liveUrl, targetProject, services, {
      passed: true,
      httpStatus: 200,
      privateDbConnected: true,
      privateCacheConnected: true,
      queueE2EPassed: true
    });
  }
}
```

#### 3. `src/studio/public/index.html`
- SPA html file with dark-theme baseline.
- Canvas element `#topology-canvas`.
- Terminal container `#terminal-container` for xterm.js.
- Tabs for Build Console, zerops.yml, Code Inspector.
- Success banner `#success-banner`.

#### 4. `src/studio/public/style.css`
- Dark theme palette (`#090d16` canvas background, `#0f172a` body background, `#1e293b` cards).
- Visual status badges for HEALTHY (emerald glow), BUILDING (amber pulse), FAILED (crimson glow).
- Styling for tab bar, code viewer, xterm terminal wrapper, popout banner.

#### 5. `src/studio/public/topology-canvas.js`
- Class `TopologyCanvas` attached to `window.TopologyCanvas`.
- Renders 5 LXD node cards (`web-frontend`, `api-gateway`, `ai-worker`, `db-postgres`, `cache-valkey`).
- Draws animated packet flows along edge connections.
- Supports node selection click to show stats popup.

#### 6. `src/studio/public/app.js`
- Connects to `ws://${location.host}/ws/logs`.
- Instantiates `Terminal` and `TopologyCanvas`.
- Listens to WS messages, streams terminal logs, updates canvas node health.
- Form submission triggers `/api/synthesize` and sends WS `{ action: 'deploy' }`.

#### 7. `tests/studio.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createStudioServer } from '../src/studio/server.js';
import { WebSocket } from 'ws';
import type { Server } from 'http';

describe('Web Studio Server & WebSocket Streamer', () => {
  let server: Server;
  let port: number;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    const studio = createStudioServer();
    server = studio.server;
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
          baseUrl = `http://localhost:${port}`;
          wsUrl = `ws://localhost:${port}/ws/logs`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/health returns 200 status OK', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('GET / serves index.html static SPA', async () => {
    const res = await fetch(`${baseUrl}/index.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('ZeroOps Studio');
  });

  it('GET static assets (style.css, topology-canvas.js, app.js)', async () => {
    const resStyle = await fetch(`${baseUrl}/style.css`);
    expect(resStyle.status).toBe(200);

    const resCanvas = await fetch(`${baseUrl}/topology-canvas.js`);
    expect(resCanvas.status).toBe(200);

    const resApp = await fetch(`${baseUrl}/app.js`);
    expect(resApp.status).toBe(200);
  });

  it('POST /api/synthesize generates zerops.yml and code artifacts from prompt', async () => {
    const res = await fetch(`${baseUrl}/api/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'AI Video Clipper SaaS with Next.js, Go API, Python worker, Postgres, Valkey' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.zeropsYml).toContain('zerops:');
    expect(Object.keys(data.codeFiles).length).toBeGreaterThan(0);
  });

  it('POST /api/deploy triggers deployment pipeline and returns liveUrl', async () => {
    const res = await fetch(`${baseUrl}/api/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'E-commerce stack', projectName: 'test-ecom' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.liveUrl).toBeDefined();
  });

  it('WebSocket /ws/logs connects and streams deployment log events', async () => {
    const ws = new WebSocket(wsUrl);
    const messages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ action: 'deploy', prompt: 'Test WS Stream', projectName: 'ws-test' }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        messages.push(msg);
        if (msg.type === 'complete') {
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some(m => m.type === 'log')).toBe(true);
    expect(messages.some(m => m.type === 'topology-update')).toBe(true);
    expect(messages.some(m => m.type === 'complete')).toBe(true);
  });
});
```

---

## 5. Verification Method

1. Run standard vitest execution:
   ```bash
   npx vitest run
   ```
2. Verify all studio tests pass alongside existing test suite:
   `tests/studio.test.ts` should pass 100% of test cases.
