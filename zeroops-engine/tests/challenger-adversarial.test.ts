import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { AddressInfo } from 'net';

const { server, users } = require('../src/server/index');
import ZCPClient from '../src/server/zcp-client';

describe('Adversarial & Security Stress Test Suite', () => {
  let httpServer: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Reset in-memory users
    for (const key of Object.keys(users)) {
      delete users[key];
    }

    await new Promise<void>((resolve) => {
      httpServer = server.listen(0, () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  // Helper function to extract session cookie string
  function getCookieValue(res: Response): string {
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return '';
    const match = setCookie.match(/connect\.sid=([^;]+)/);
    return match ? match[1] : '';
  }

  describe('1. Case-Sensitivity & Whitespace Attack Vectors', () => {
    it('normalizes email with leading/trailing whitespace and mixed casing on signup', async () => {
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '  User@Domain.COM  ',
          password: 'SecurePassword123!',
          name: 'Case Test User',
        }),
      });

      expect(signupRes.status).toBe(200);
      const data = await signupRes.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('user@domain.com');

      // Check stored user object key is lowercased and trimmed
      expect(users['user@domain.com']).toBeDefined();
      expect(users['  User@Domain.COM  ']).toBeUndefined();
    });

    it('prevents duplicate registration under different casing/whitespace variants', async () => {
      const duplicateRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ' USER@domain.com',
          password: 'AnotherPassword123!',
        }),
      });

      expect(duplicateRes.status).toBe(409);
      const data = await duplicateRes.json();
      expect(data.error).toBe('User already exists');
    });

    it('authenticates successfully with extreme casing & whitespace variations', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '\tUSER@DOMAIN.COM \n',
          password: 'SecurePassword123!',
        }),
      });

      expect(loginRes.status).toBe(200);
      const data = await loginRes.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('user@domain.com');
    });

    it('rejects empty or whitespace-only email inputs', async () => {
      const emptyRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '   ',
          password: 'Password123!',
        }),
      });

      expect(emptyRes.status).toBe(400);
      const data = await emptyRes.json();
      expect(data.error).toBe('Email and password required');
    });
  });

  describe('2. Session Fixation Defense', () => {
    it('regenerates session ID upon signup when a pre-auth session cookie exists', async () => {
      // Step 1: Client presents a pre-auth session cookie
      const preAuthCookie = 's%3Apre_auth_session_fixation_test_id1.signature';

      // Step 2: Signup presenting pre-auth session cookie
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `connect.sid=${preAuthCookie}`,
        },
        body: JSON.stringify({
          email: 'fixation_test1@zeroops.dev',
          password: 'FixationPassword123!',
        }),
      });

      expect(signupRes.status).toBe(200);
      const postAuthCookie = getCookieValue(signupRes);
      expect(postAuthCookie).toBeTruthy();
      expect(postAuthCookie).not.toBe(preAuthCookie);
    });

    it('regenerates session ID upon login when a pre-auth session cookie exists', async () => {
      // Create user
      await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fixation_test2@zeroops.dev',
          password: 'FixationPassword123!',
        }),
      });

      // Step 1: Client presents a pre-auth session cookie
      const preAuthCookie = 's%3Apre_auth_session_fixation_test_id2.signature';

      // Step 2: Login presenting pre-auth session cookie
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `connect.sid=${preAuthCookie}`,
        },
        body: JSON.stringify({
          email: 'fixation_test2@zeroops.dev',
          password: 'FixationPassword123!',
        }),
      });

      expect(loginRes.status).toBe(200);
      const postAuthCookie = getCookieValue(loginRes);
      expect(postAuthCookie).toBeTruthy();
      expect(postAuthCookie).not.toBe(preAuthCookie);
    });
  });

  describe('3. Password Security & Scrypt Salt Uniqueness', () => {
    it('rejects wrong password attempts with 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@domain.com',
          password: 'WrongPassword999!',
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('rejects empty password string on login and signup', async () => {
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'emptypass@domain.com',
          password: '',
        }),
      });
      expect(signupRes.status).toBe(400);

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@domain.com',
          password: '',
        }),
      });
      expect(loginRes.status).toBe(400);
    });

    it('generates unique scrypt salts and hashes for identical passwords across users', async () => {
      const identicalPassword = 'SameSuperSecretPassword2026!';

      await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'userA@domain.com', password: identicalPassword }),
      });

      await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'userB@domain.com', password: identicalPassword }),
      });

      const userA = users['usera@domain.com'];
      const userB = users['userb@domain.com'];

      expect(userA).toBeDefined();
      expect(userB).toBeDefined();

      const [saltA, hashA] = userA.password.split(':');
      const [saltB, hashB] = userB.password.split(':');

      expect(saltA).toBeTruthy();
      expect(saltB).toBeTruthy();
      expect(saltA).not.toBe(saltB);
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('4. Logout Integrity & Cookie Removal', () => {
    it('destroys session and sets connect.sid removal cookie on logout', async () => {
      // Signup and log in
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'logout_user@domain.com', password: 'LogoutPassword123!' }),
      });

      const sessionCookie = getCookieValue(signupRes);
      expect(sessionCookie).toBeTruthy();

      // Logout request
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Cookie': `connect.sid=${sessionCookie}` },
      });

      expect(logoutRes.status).toBe(200);
      const setCookieHeader = logoutRes.headers.get('set-cookie') || '';
      expect(setCookieHeader).toContain('connect.sid=;');

      // Verify subsequent request with old session cookie fails (401)
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Cookie': `connect.sid=${sessionCookie}` },
      });
      expect(meRes.status).toBe(401);
    });
  });

  describe('5. PAT Token Persistence & /api/ws-token Sync', () => {
    it('persists PAT token and syncs via /api/ws-token across simulated reloads', async () => {
      // 1. Register & Login
      const loginRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'pat_user@domain.com', password: 'PatPassword123!' }),
      });
      const cookie = getCookieValue(loginRes);

      // 2. Set PAT Token
      const tokenRes = await fetch(`${baseUrl}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `connect.sid=${cookie}`,
        },
        body: JSON.stringify({ token: 'zerops_pat_live_1122334455' }),
      });
      expect(tokenRes.status).toBe(200);

      // 3. Sync WS Token
      const wsTokenRes = await fetch(`${baseUrl}/api/ws-token`, {
        method: 'POST',
        headers: { 'Cookie': `connect.sid=${cookie}` },
      });
      expect(wsTokenRes.status).toBe(200);
      const wsTokenData = await wsTokenRes.json();
      expect(wsTokenData.success).toBe(true);

      // 4. Simulate Page Reload: check /api/auth/me retains hasToken: true
      const meReloadRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Cookie': `connect.sid=${cookie}` },
      });
      expect(meReloadRes.status).toBe(200);
      const meReloadData = await meReloadRes.json();
      expect(meReloadData.hasToken).toBe(true);

      // 5. Subsequent /api/ws-token call after reload succeeds
      const wsTokenReloadRes = await fetch(`${baseUrl}/api/ws-token`, {
        method: 'POST',
        headers: { 'Cookie': `connect.sid=${cookie}` },
      });
      expect(wsTokenReloadRes.status).toBe(200);
    });
  });
});
