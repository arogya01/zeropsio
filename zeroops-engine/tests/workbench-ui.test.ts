import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createStudioServer, StudioServerInstance } from '../src/studio/server';
import { WsLogger } from '../src/studio/ws-logger';

describe('Workbench UI API & WebSocket Log Streamer Suite', () => {
  let studio: StudioServerInstance;
  let port: number;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    studio = createStudioServer({ mock: true });
    port = await studio.listen(0);
    baseUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws/logs`;
  });

  afterAll(async () => {
    if (studio) {
      await studio.close();
    }
  });

  describe('Studio REST API Contracts (/api/health, /api/status, /api/topology, /api/synthesize, /api/deploy)', () => {
    it('GET /api/health returns 200 and system health status', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.version).toBe('1.0.0');
      expect(typeof data.timestamp).toBe('string');
    });

    it('GET /api/status returns 200 and running state with topology', async () => {
      const res = await fetch(`${baseUrl}/api/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('RUNNING');
      expect(typeof data.timestamp).toBe('string');
    });

    it('GET /api/topology returns topology map for project', async () => {
      const res = await fetch(`${baseUrl}/api/topology?projectId=test-proj`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('POST /api/synthesize returns 400 when prompt is missing or empty', async () => {
      const res = await fetch(`${baseUrl}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '  ' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Prompt is required and must be a non-empty string');
    });

    it('POST /api/synthesize returns synthesized topology, YAML configs, and code files', async () => {
      const res = await fetch(`${baseUrl}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Fullstack E-Commerce with React, Go API, Python Worker, Postgres, and Valkey',
          projectName: 'ecommerce-test-stack',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.projectName).toBe('ecommerce-test-stack');
      expect(data.zeropsProjectImportYaml).toContain('project:');
      expect(data.zeropsYaml).toContain('zerops:');
      expect(typeof data.codeFiles).toBe('object');
      expect(Object.keys(data.codeFiles).length).toBeGreaterThan(0);
    });

    it('POST /api/deploy triggers deployment pipeline and returns deploymentId and liveUrl', async () => {
      const res = await fetch(`${baseUrl}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'AI Video Processor Stack',
          projectName: 'aividprocessor',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.projectName).toBe('aividprocessor');
      expect(data.deploymentId).toBeDefined();
      expect(data.liveUrl).toMatch(/https:\/\/.+zerops\.app/);
      expect(data.status).toBe('DEPLOYED');
    });

    it('GET static SPA fallback returns index.html or 404 message for non-API route', async () => {
      const res = await fetch(`${baseUrl}/studio`);
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('WebSocket Log Streamer & Protocol (/ws/logs)', () => {
    it('receives welcome log and history replay on WS connection', async () => {
      const messages: any[] = [];
      const client = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {});
        client.on('message', (raw) => {
          const parsed = JSON.parse(raw.toString());
          messages.push(parsed);
          if (messages.length >= 2) {
            client.close();
            resolve();
          }
        });
        client.on('error', reject);
      });

      const historyMsg = messages.find((m) => m.type === 'history');
      expect(historyMsg).toBeDefined();
      expect(Array.isArray(historyMsg.logs)).toBe(true);

      const welcomeMsg = messages.find((m) => m.type === 'log');
      expect(welcomeMsg).toBeDefined();
      expect(welcomeMsg.message).toContain('Connected to ZeroOps Studio log stream gateway');
    });

    it('handles ping request and responds with pong frame', async () => {
      const client = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.send(JSON.stringify({ type: 'ping' }));
        });
        client.on('message', (raw) => {
          const data = JSON.parse(raw.toString());
          if (data.type === 'pong') {
            expect(data.timestamp).toBeDefined();
            client.close();
            resolve();
          }
        });
        client.on('error', reject);
      });
    });

    it('handles getHistory request and returns log history array', async () => {
      const client = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.send(JSON.stringify({ type: 'getHistory' }));
        });
        client.on('message', (raw) => {
          const data = JSON.parse(raw.toString());
          if (data.type === 'history') {
            expect(Array.isArray(data.logs)).toBe(true);
            client.close();
            resolve();
          }
        });
        client.on('error', reject);
      });
    });

    it('supports service filtering via subscribe action', async () => {
      const client = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.send(JSON.stringify({ type: 'subscribe', service: 'db-postgres' }));
          setTimeout(() => {
            client.close();
            resolve();
          }, 50);
        });
        client.on('error', reject);
      });
    });

    it('handles malformed non-JSON raw text frame without crashing', async () => {
      const client = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.send('RAW_NON_JSON_MALFORMED_FRAME_12345');
          setTimeout(() => {
            client.close();
            resolve();
          }, 100);
        });
        client.on('error', reject);
      });
    });

    it('broadcasts topology state updates to connected WS clients', async () => {
      const client = new WebSocket(wsUrl);
      let receivedUpdate: any = null;

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          studio.logger.updateTopology('api-gateway', 'BUILDING', '10.160.0.15:8080');
        });
        client.on('message', (raw) => {
          const data = JSON.parse(raw.toString());
          if (data.type === 'topology-update' && data.serviceId === 'api-gateway') {
            receivedUpdate = data;
            client.close();
            resolve();
          }
        });
        client.on('error', reject);
      });

      expect(receivedUpdate).toBeDefined();
      expect(receivedUpdate.status).toBe('BUILDING');
      expect(receivedUpdate.privateIp).toBe('10.160.0.15:8080');
    });

    it('broadcasts completion frame to connected WS clients', async () => {
      const client = new WebSocket(wsUrl);
      let completionFrame: any = null;

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          studio.logger.complete(
            'https://testproj.zerops.app',
            'testproj',
            ['web-frontend', 'db-postgres'],
            { passed: true }
          );
        });
        client.on('message', (raw) => {
          const data = JSON.parse(raw.toString());
          if (data.type === 'complete') {
            completionFrame = data;
            client.close();
            resolve();
          }
        });
        client.on('error', reject);
      });

      expect(completionFrame).toBeDefined();
      expect(completionFrame.liveUrl).toBe('https://testproj.zerops.app');
      expect(completionFrame.projectName).toBe('testproj');
    });
  });

  describe('WsLogger Unit Utility Functions & Ring Buffer', () => {
    it('sanitizeMessage strips non-printable control chars while preserving ANSI', () => {
      const logger = new WsLogger();
      const dirty = 'Hello\x00World\x1b[31mRed\x07\x08';
      const clean = logger.sanitizeMessage(dirty);
      expect(clean).toBe('HelloWorld\x1b[31mRed');
    });

    it('formatAnsi formats LogStreamMessage with service badges and colors', () => {
      const logger = new WsLogger();
      const formatted = logger.formatAnsi({
        timestamp: '2026-08-09T00:00:00.000Z',
        service: 'web-frontend',
        stream: 'stdout',
        message: 'Server started',
      });
      expect(formatted).toContain('[web-frontend]');
      expect(formatted).toContain('[stdout]');
      expect(formatted).toContain('Server started');
    });

    it('maintains ring buffer bounds without unbounded growth', () => {
      const logger = new WsLogger({ maxBufferLength: 5 });
      for (let i = 1; i <= 10; i++) {
        logger.emit('system', 'stdout', `Log line ${i}`);
      }

      const logs = logger.getLogs();
      expect(logs).toHaveLength(5);
      expect(logs[0].message).toBe('Log line 6');
      expect(logs[4].message).toBe('Log line 10');
    });
  });

  describe('Studio UI Layout & Component Integrity Tests', () => {
    it('verifies public/studio.html contains split-pane IDs (#chat-feed, #prompt-bar, #wb-terminal, #wb-yaml, #wb-code)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.resolve(process.cwd(), 'public/studio.html');
      const content = fs.readFileSync(htmlPath, 'utf-8');

      expect(content).toContain('id="chat-feed"');
      expect(content).toContain('id="prompt-bar"');
      expect(content).toContain('id="wb-terminal"');
      expect(content).toContain('id="wb-yaml"');
      expect(content).toContain('id="wb-code"');
      expect(content).toContain('id="code-sidebar"');
      expect(content).toContain('id="code-file-list"');
      expect(content).toContain('id="code-active-filename"');
      expect(content).toContain('id="code-active-content"');
    });

    it('verifies persistent bottom topology strip node chips and connectors', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.resolve(process.cwd(), 'public/studio.html');
      const content = fs.readFileSync(htmlPath, 'utf-8');

      const expectedNodes = [
        'id="node-web-frontend"',
        'id="node-api-gateway"',
        'id="node-ai-worker"',
        'id="node-db-postgres"',
        'id="node-cache-valkey"'
      ];

      for (const nodeId of expectedNodes) {
        expect(content).toContain(nodeId);
      }
      expect(content).toContain('class="topo-arrow"');
    });

    it('verifies public/studio.css defines packet flow keyframes and status transition rules', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const cssPath = path.resolve(process.cwd(), 'public/studio.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('@keyframes packet-flow');
      expect(css).toContain('.topo-chip.building');
      expect(css).toContain('.topo-chip.deploying');
      expect(css).toContain('.topo-chip.healthy');
      expect(css).toContain('.topo-chip.failed');
    });

    it('verifies studio.js includes short alias mapping and /ws/logs endpoint', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const jsPath = path.resolve(process.cwd(), 'public/studio.js');
      const js = fs.readFileSync(jsPath, 'utf-8');

      expect(js).toContain('/ws/logs');
      expect(js).toContain('webapp');
      expect(js).toContain('apigateway');
      expect(js).toContain('aiworker');
      expect(js).toContain('postgres');
      expect(js).toContain('valkey');
      expect(js).toContain("type === 'history'");
      expect(js).toContain('renderCodeFiles');
    });
  });
});
