/**
 * tests/studio.test.ts
 * Vitest integration suite for Web Studio Server, REST APIs, and WebSocket Log Streamer.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { createStudioServer, StudioServerInstance } from '../src/studio/server.js';
import { WsLogger } from '../src/studio/ws-logger.js';

describe('Web Studio Server & WebSocket Log Streamer (M3)', () => {
  let studio: StudioServerInstance;
  let port: number;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    studio = createStudioServer({ mock: true });
    // Listen on ephemeral port (0)
    port = await studio.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws/logs`;
  });

  afterAll(async () => {
    await studio.close();
  });

  describe('REST API Endpoints', () => {
    it('GET /api/health returns 200 status OK with timestamp and version', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.status).toBe('ok');
      expect(data.version).toBe('1.0.0');
      expect(data.timestamp).toBeDefined();
    });

    it('GET /api/status returns system running status', async () => {
      const res = await fetch(`${baseUrl}/api/status`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.status).toBe('RUNNING');
      expect(data.timestamp).toBeDefined();
    });

    it('POST /api/synthesize returns synthesized zerops.yml and multi-service code files', async () => {
      const res = await fetch(`${baseUrl}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'AI SaaS Video Processing Factory with Next.js frontend, Go API, Python worker, Postgres, Valkey',
          projectName: 'video-saas-test'
        })
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.projectName).toBe('video-saas-test');
      expect(data.zeropsProjectImportYaml).toContain('project:');
      expect(data.zeropsYaml).toContain('zerops:');
      expect(data.codeFiles).toBeDefined();
      expect(Object.keys(data.codeFiles).length).toBeGreaterThan(0);
    });

    it('POST /api/synthesize returns 400 when prompt is empty or missing', async () => {
      const res = await fetch(`${baseUrl}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '' })
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBeDefined();
    });

    it('POST /api/deploy triggers deployment workflow and returns liveUrl', async () => {
      const res = await fetch(`${baseUrl}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'E-Commerce Cloud Stack',
          projectName: 'ecom-deploy-test'
        })
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.projectName).toBe('ecom-deploy-test');
      expect(data.deploymentId).toBeDefined();
      expect(data.liveUrl).toBeDefined();
      expect(data.liveUrl).toContain('zerops.app');
      expect(data.status).toBe('DEPLOYED');
    });
  });

  describe('Static SPA File Serving', () => {
    it('GET / serves Web Studio index.html', async () => {
      const res = await fetch(`${baseUrl}/index.html`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('ZeroOps Studio');
      expect(html).toContain('topology-canvas');
    });

    it('GET /style.css serves dark mode stylesheet', async () => {
      const res = await fetch(`${baseUrl}/style.css`);
      expect(res.status).toBe(200);
      const css = await res.text();
      expect(css).toContain('dark-theme');
    });

    it('GET /topology-canvas.js serves 2D Canvas engine', async () => {
      const res = await fetch(`${baseUrl}/topology-canvas.js`);
      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain('TopologyCanvas');
    });

    it('GET /app.js serves SPA application script', async () => {
      const res = await fetch(`${baseUrl}/app.js`);
      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain('connectWebSocket');
    });
  });

  describe('WebSocket Log Streamer (/ws/logs)', () => {
    it('connects to /ws/logs and receives welcome / history message', async () => {
      const ws = new WebSocket(wsUrl);
      const receivedMessages: any[] = [];

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {});
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          receivedMessages.push(msg);
          ws.close();
          resolve();
        });
        ws.on('error', reject);
      });

      expect(receivedMessages.length).toBeGreaterThan(0);
      expect(receivedMessages[0].type).toBeDefined();
    });

    it('streams deployment logs and topology updates on deploy command', async () => {
      const ws = new WebSocket(wsUrl);
      const logMessages: any[] = [];
      const topologyUpdates: any[] = [];
      let isComplete = false;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              action: 'deploy',
              prompt: 'Realtime Analytics Engine',
              projectName: 'analytics-ws-test'
            })
          );
        });

        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'log') logMessages.push(msg);
          if (msg.type === 'topology-update') topologyUpdates.push(msg);
          if (msg.type === 'complete') {
            isComplete = true;
            ws.close();
            resolve();
          }
        });

        ws.on('error', reject);
      });

      expect(logMessages.length).toBeGreaterThan(0);
      expect(topologyUpdates.length).toBeGreaterThan(0);
      expect(isComplete).toBe(true);
    });
  });

  describe('WsLogger Class Unit Tests', () => {
    it('sanitizes control characters while preserving ANSI escape sequences', () => {
      const logger = new WsLogger();
      const raw = '\x00Hello\x07 \x1b[32mWorld\x1b[0m\x1f!';
      const sanitized = logger.sanitizeMessage(raw);
      expect(sanitized).toBe('Hello \x1b[32mWorld\x1b[0m!');
    });

    it('formats ANSI output with timestamp and service tag', () => {
      const logger = new WsLogger();
      const ansi = logger.formatAnsi({
        timestamp: '2026-08-08T18:00:00.000Z',
        service: 'api',
        stream: 'stdout',
        message: 'Database connected successfully'
      });
      expect(ansi).toContain('[api]');
      expect(ansi).toContain('Database connected');
    });

    it('maintains ring buffer up to maxBufferLength', () => {
      const logger = new WsLogger({ maxBufferLength: 10 });
      for (let i = 0; i < 25; i++) {
        logger.emit('system', 'stdout', `Log message ${i}`);
      }
      const logs = logger.getLogs();
      expect(logs.length).toBe(10);
      expect(logs[0].message).toBe('Log message 15');
      expect(logs[9].message).toBe('Log message 24');
    });

    it('filters logs by service name', () => {
      const logger = new WsLogger();
      logger.emit('frontend', 'stdout', 'Frontend load');
      logger.emit('api', 'stdout', 'API request');
      logger.emit('worker', 'stdout', 'Worker job');

      const apiLogs = logger.getLogs('api');
      expect(apiLogs.length).toBe(1);
      expect(apiLogs[0].service).toBe('api');
    });
  });
});
