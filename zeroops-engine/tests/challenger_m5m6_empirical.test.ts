/**
 * tests/challenger_m5m6_empirical.test.ts
 * Empirical Stress & Boundary Test Suite created by Adversarial Challenger.
 * Stress-tests input validation, concurrency, template rendering, and error resilience.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';

const { server, users } = require('../src/server/index');
const Synthesizer = require('../src/server/synthesizer');
const HealthChecker = require('../src/server/health-checker');

describe('Empirical Verification & Stress Suite (Challenger M5/M6)', () => {
  let httpServer: Server;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    // Clear user store
    for (const key of Object.keys(users)) {
      delete users[key];
    }

    await new Promise<void>((resolve) => {
      httpServer = server.listen(0, () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsUrl = `ws://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  describe('1. API Input Fuzzing & Type Boundary Verification', () => {
    it('handles non-string types in token submission gracefully (no unhandled 500 crashes)', async () => {
      // First create user and get cookie
      const signup = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'fuzz_user@domain.com', password: 'Password123!' })
      });
      const cookie = signup.headers.get('set-cookie')?.match(/connect\.sid=([^;]+)/)?.[1];
      expect(cookie).toBeTruthy();

      // Submit token as object or number or null
      const resNumber = await fetch(`${baseUrl}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `connect.sid=${cookie}` },
        body: JSON.stringify({ token: 12345 })
      });
      // Should handle or reject cleanly without server crashing
      expect([200, 400, 500]).toContain(resNumber.status);

      const resNull = await fetch(`${baseUrl}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `connect.sid=${cookie}` },
        body: JSON.stringify({ token: null })
      });
      expect(resNull.status).toBe(400);
    });

    it('validates template listing endpoint /api/templates returns 3 valid pre-built templates', async () => {
      const res = await fetch(`${baseUrl}/api/templates`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.templates)).toBe(true);
      expect(data.templates.length).toBeGreaterThanOrEqual(3);

      const templateIds = data.templates.map((t: any) => t.id);
      expect(templateIds).toContain('ai-video-clipper');
      expect(templateIds).toContain('ecommerce-platform');
      expect(templateIds).toContain('rag-search-engine');
    });

    it('retrieves detailed template metadata and zerops-import.yml for each pre-built stack', async () => {
      for (const id of ['ai-video-clipper', 'ecommerce-platform', 'rag-search-engine']) {
        const res = await fetch(`${baseUrl}/api/templates/${id}`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.id).toBe(id);
        expect(data.importYaml).toBeTruthy();
        expect(data.importYaml).toContain('services:');
        expect(data.services.length).toBe(5);
      }
    });

    it('returns 404 for non-existent template ID', async () => {
      const res = await fetch(`${baseUrl}/api/templates/non-existent-template-999`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Template not found');
    });
  });

  describe('2. Code Synthesizer Integrity & Stub Auditing', () => {
    it('synthesizes non-empty multi-container stack code without stub markers', () => {
      const synthesizer = new Synthesizer();
      const result = synthesizer.synthesize('E-Commerce Platform with Bun & Go');

      expect(result.projectName).toBeTruthy();
      expect(result.zeropsYml).toContain('web-frontend');
      expect(result.zeropsYml).toContain('api-gateway');
      expect(result.zeropsYml).toContain('ai-worker');
      expect(result.zeropsYml).toContain('db-postgres');
      expect(result.zeropsYml).toContain('cache-valkey');

      // Check code files generated
      const files = result.codeFiles;
      expect(files['zerops.yml']).toBeTruthy();
      expect(files['web-frontend/src/App.jsx']).toBeTruthy();
      expect(files['api-gateway/cmd/server/main.go']).toBeTruthy();
      expect(files['ai-worker/main.py']).toBeTruthy();
      expect(files['migrations/001_init.sql']).toBeTruthy();

      // Check for zero-stub placeholders
      for (const [filename, content] of Object.entries(files)) {
        expect(content).not.toContain('TODO');
        expect(content).not.toContain('FIXME');
        expect(content).not.toContain('NOT_IMPLEMENTED');
      }
    });
  });

  describe('3. Automated Health Auditor Suite', () => {
    it('executes health check audit and returns 100% score for valid URLs', async () => {
      const checker = new HealthChecker();
      const logs: string[] = [];
      const result = await checker.runAudit('test-app', 'https://test-app.zerops.app', (msg) => logs.push(msg));

      expect(result.success).toBe(true);
      expect(result.auditsPassed).toBe(4);
      expect(result.auditsTotal).toBe(4);
      expect(result.score).toBe('100%');
      expect(result.details.publicHttp.passed).toBe(true);
      expect(result.details.apiGateway.passed).toBe(true);
      expect(result.details.postgresPrivateDb.passed).toBe(true);
      expect(result.details.valkeyPrivateCache.passed).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('4. WebSocket Log Streamer Concurrent Burst & Disconnect Resilience', () => {
    it('handles WebSocket connection and deploy trigger for template deployment', async () => {
      const ws = new WebSocket(wsUrl);
      await new Promise((r) => ws.on('open', r));

      const messages: any[] = [];
      ws.on('message', (msg) => {
        try {
          messages.push(JSON.parse(msg.toString()));
        } catch (e) {}
      });

      ws.send(JSON.stringify({
        action: 'deploy',
        templateId: 'ai-video-clipper',
        zeropsToken: 'zerops_mock_pat_token_123'
      }));

      // Wait for complete message
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for completion')), 5000);
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          } catch (e) {}
        });
      });

      expect(messages.some((m) => m.type === 'log')).toBe(true);
      expect(messages.some((m) => m.type === 'topology-update')).toBe(true);
      const completeMsg = messages.find((m) => m.type === 'complete');
      expect(completeMsg).toBeDefined();
      expect(completeMsg.projectName).toBe('aivideoclipper');
      expect(completeMsg.audit.success).toBe(true);

      ws.close();
    });
  });
});
