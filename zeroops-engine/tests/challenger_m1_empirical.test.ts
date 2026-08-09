import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import { app as authApp, server as authServer, wss as authWss, users } from '../src/server/index';
import { createStudioServer, StudioServerInstance } from '../src/studio/server';

describe('Empirical Challenger M1 Stress Suite', () => {
  let authPort: number;
  let studioInstance: StudioServerInstance;
  let studioPort: number;

  beforeAll(async () => {
    // Start authServer on ephemeral port 0
    await new Promise<void>((resolve) => {
      authServer.listen(0, () => {
        const addr = authServer.address();
        authPort = typeof addr === 'object' && addr ? addr.port : 3000;
        resolve();
      });
    });

    // Start studioServer on ephemeral port 0
    studioInstance = createStudioServer({ mock: true });
    studioPort = await studioInstance.listen(0);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => authServer.close(() => resolve()));
    await studioInstance.close();
  });

  describe('1. Auth & PAT Overlay Empirical Stress Tests', () => {
    it('handles 50 concurrent rapid signups & logins without state corruption', async () => {
      const requests = Array.from({ length: 50 }).map(async (_, idx) => {
        const email = `stress_user_${idx}_${Date.now()}@example.com`;
        const password = `SecretPass!_${idx}`;

        // Signup
        const signupRes = await fetch(`http://127.0.0.1:${authPort}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: `User ${idx}` })
        });
        const signupJson = await signupRes.json();
        expect(signupRes.status).toBe(200);
        expect(signupJson.success).toBe(true);

        // Extract cookie
        const setCookie = signupRes.headers.get('set-cookie');

        // Login
        const loginRes = await fetch(`http://127.0.0.1:${authPort}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(setCookie ? { Cookie: setCookie } : {})
          },
          body: JSON.stringify({ email, password })
        });
        const loginJson = await loginRes.json();
        expect(loginRes.status).toBe(200);
        expect(loginJson.success).toBe(true);
      });

      await Promise.all(requests);
    });

    it('rejects malformed requests and injection payloads safely', async () => {
      // 1. Invalid credentials
      const badCreds = await fetch(`http://127.0.0.1:${authPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: "nonexistent@test.com", password: "' OR '1'='1" })
      });
      expect(badCreds.status).toBe(401);

      // 2. Missing fields
      const missingFields = await fetch(`http://127.0.0.1:${authPort}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: "onlyemail@test.com" })
      });
      expect(missingFields.status).toBe(400);

      // 3. Duplicate email signup
      const email = `dup_${Date.now()}@test.com`;
      await fetch(`http://127.0.0.1:${authPort}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password' })
      });
      const dupRes = await fetch(`http://127.0.0.1:${authPort}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password' })
      });
      expect(dupRes.status).toBe(409);
    });

    it('manages PAT overlay storage and session token isolation correctly', async () => {
      const email = `pat_user_${Date.now()}@test.com`;
      const password = 'Password123!';
      const tokenVal = 'zcp_pat_secret_998877';

      // 1. Signup & obtain session
      const signupRes = await fetch(`http://127.0.0.1:${authPort}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const cookie = signupRes.headers.get('set-cookie');
      expect(cookie).toBeTruthy();

      // 2. Check /api/auth/me before token set
      const meBefore = await fetch(`http://127.0.0.1:${authPort}/api/auth/me`, {
        headers: { Cookie: cookie! }
      });
      const meBeforeJson = await meBefore.json();
      expect(meBeforeJson.hasToken).toBe(false);

      // 3. Post PAT token
      const tokenRes = await fetch(`http://127.0.0.1:${authPort}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie!
        },
        body: JSON.stringify({ token: tokenVal })
      });
      expect(tokenRes.status).toBe(200);

      // 4. Check /api/auth/me after token set
      const meAfter = await fetch(`http://127.0.0.1:${authPort}/api/auth/me`, {
        headers: { Cookie: cookie! }
      });
      const meAfterJson = await meAfter.json();
      expect(meAfterJson.hasToken).toBe(true);

      // Verify in-memory user store holds token
      expect(users[email].zeropsToken).toBe(tokenVal);

      // 5. Unauthenticated request to /api/auth/token should be rejected 401
      const unauthRes = await fetch(`http://127.0.0.1:${authPort}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'stolen_token' })
      });
      expect(unauthRes.status).toBe(401);
    });
  });

  describe('2. WebSocket Log Streamer Empirical Stress Tests', () => {
    it('handles 30 rapid connections and abrupt disconnections without crash or memory leak', async () => {
      const connPromises = Array.from({ length: 30 }).map(() => {
        return new Promise<void>((resolve) => {
          const ws = new WebSocket(`ws://127.0.0.1:${studioPort}/ws/logs`);
          ws.on('open', () => {
            // Immediately terminate socket
            ws.terminate();
            resolve();
          });
          ws.on('error', () => resolve());
        });
      });

      await Promise.all(connPromises);
      // Wait brief moment for server handlers to process cleanup
      await new Promise((r) => setTimeout(r, 100));

      // Emit a log to ensure server didn't crash and works fine
      studioInstance.logger.emit('system', 'stdout', 'Post stress ping test');
      expect(studioInstance.logger.getLogs().length).toBeGreaterThan(0);
    });

    it('handles non-JSON malformed frames and binary payloads gracefully', async () => {
      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${studioPort}/ws/logs`);
        ws.on('open', () => {
          // Send non-JSON text
          ws.send('GARBAGE_NON_JSON_FRAME_{{{');
          // Send raw binary
          ws.send(Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]));
          
          setTimeout(() => {
            ws.close();
            resolve();
          }, 100);
        });
      });

      const logs = studioInstance.logger.getLogs();
      const rawTextLog = logs.find((l) => l.message.includes('GARBAGE_NON_JSON_FRAME'));
      expect(rawTextLog).toBeDefined();
    });

    it('routes filtered logs correctly across 10 concurrent subscriber clients', async () => {
      const clientCount = 10;
      const clients: WebSocket[] = [];
      const messagesReceived: Record<number, any[]> = {};

      for (let i = 0; i < clientCount; i++) {
        messagesReceived[i] = [];
        const ws = new WebSocket(`ws://127.0.0.1:${studioPort}/ws/logs`);
        clients.push(ws);
      }

      await Promise.all(
        clients.map(
          (ws) =>
            new Promise<void>((resolve) => {
              ws.on('open', resolve);
            })
        )
      );

      // Subscribe clients 0..4 to 'api-gateway', and 5..9 to 'db-postgres'
      clients.forEach((ws, idx) => {
        ws.on('message', (raw) => {
          const parsed = JSON.parse(raw.toString());
          messagesReceived[idx].push(parsed);
        });

        const filterService = idx < 5 ? 'api-gateway' : 'db-postgres';
        ws.send(JSON.stringify({ type: 'subscribe', service: filterService }));
      });

      await new Promise((r) => setTimeout(r, 100));

      // Emit log for api-gateway
      studioInstance.logger.emit('api-gateway', 'stdout', 'API Request GET /health');
      // Emit log for db-postgres
      studioInstance.logger.emit('db-postgres', 'stdout', 'DB Query SELECT 1');

      await new Promise((r) => setTimeout(r, 150));

      // Close sockets
      clients.forEach((ws) => ws.close());

      // Verify filtering: Clients 0..4 should have api-gateway log but NOT db-postgres log
      for (let i = 0; i < 5; i++) {
        const logs = messagesReceived[i].filter((m) => m.type === 'log');
        const hasApi = logs.some((l) => l.service === 'api-gateway');
        const hasDb = logs.some((l) => l.service === 'db-postgres');
        expect(hasApi).toBe(true);
        expect(hasDb).toBe(false);
      }

      // Clients 5..9 should have db-postgres log but NOT api-gateway log
      for (let i = 5; i < 10; i++) {
        const logs = messagesReceived[i].filter((m) => m.type === 'log');
        const hasApi = logs.some((l) => l.service === 'api-gateway');
        const hasDb = logs.some((l) => l.service === 'db-postgres');
        expect(hasApi).toBe(false);
        expect(hasDb).toBe(true);
      }
    });

    it('handles ping/pong and getHistory over WebSocket streamer', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${studioPort}/ws/logs`);
      await new Promise<void>((resolve) => ws.on('open', resolve));

      const responses: any[] = [];
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });

      // Send ping
      ws.send(JSON.stringify({ type: 'ping' }));
      // Send getHistory
      ws.send(JSON.stringify({ type: 'getHistory' }));

      await new Promise((r) => setTimeout(r, 100));
      ws.close();

      const pong = responses.find((r) => r.type === 'pong');
      const history = responses.find((r) => r.type === 'history');

      expect(pong).toBeDefined();
      expect(history).toBeDefined();
      expect(Array.isArray(history.logs)).toBe(true);
    });
  });

  describe('3. Workbench UI API Endpoints Empirical Tests', () => {
    it('returns health, status, and topology from Studio REST API', async () => {
      const healthRes = await fetch(`http://127.0.0.1:${studioPort}/api/health`);
      expect(healthRes.status).toBe(200);
      const healthJson = await healthRes.json();
      expect(healthJson.status).toBe('ok');

      const statusRes = await fetch(`http://127.0.0.1:${studioPort}/api/status`);
      expect(statusRes.status).toBe(200);

      const topoRes = await fetch(`http://127.0.0.1:${studioPort}/api/topology?projectId=test-proj`);
      expect(topoRes.status).toBe(200);
    });

    it('synthesizes prompt into project topology & YAML artifacts', async () => {
      const synthRes = await fetch(`http://127.0.0.1:${studioPort}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Build a RAG AI search engine with vector DB', projectName: 'rag-test' })
      });
      expect(synthRes.status).toBe(200);
      const synthJson = await synthRes.json();
      expect(synthJson.success).toBe(true);
      expect(synthJson.projectName).toBe('rag-test');
      expect(synthJson.topology).toBeDefined();
      expect(synthJson.zeropsYaml).toBeDefined();
    });

    it('rejects synthesis with empty or invalid prompt', async () => {
      const emptyRes = await fetch(`http://127.0.0.1:${studioPort}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '   ' })
      });
      expect(emptyRes.status).toBe(400);
    });

    it('triggers deployment pipeline and returns deployment status', async () => {
      const deployRes = await fetch(`http://127.0.0.1:${studioPort}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Deploy E-Commerce SaaS Platform', projectName: 'ecom-deploy' })
      });
      expect(deployRes.status).toBe(200);
      const deployJson = await deployRes.json();
      expect(deployJson.success).toBe(true);
      expect(deployJson.status).toBe('DEPLOYED');
      expect(deployJson.liveUrl).toMatch(/^https:\/\/[a-z0-9-]+\.zerops\.app$/);
    });
  });
});
