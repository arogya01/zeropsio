import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import childProcess from 'child_process';
import { injectPrivateNetEnv } from '../src/synthesizer/private-net';

// Import CJS server module and ZCP clients
const { server, users } = require('../src/server/index');
import ZCPClient from '../src/server/zcp-client';
import { ZcpClient as TsZcpClient } from '../src/zcp/zcp-client';

describe('Auth & Onboarding REST & Session Suite', () => {
  let httpServer: Server;
  let baseUrl: string;
  let cookieHeader = '';

  beforeAll(async () => {
    // Clear in-memory users for test isolation
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

  const makeRequest = async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      cookieHeader = setCookie.split(';')[0];
    }
    return res;
  };

  describe('Session Auth Endpoints (/api/auth/signup, /api/auth/login, /api/auth/me, /api/auth/logout)', () => {
    it('GET /api/auth/me returns 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/auth/me');
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Not authenticated');
    });

    it('POST /api/auth/signup fails 400 when missing email or password', async () => {
      const res = await makeRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Email and password required');
    });

    it('POST /api/auth/signup creates new user with email normalization & scrypt password hashing', async () => {
      const res = await makeRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: '  Dev@ZeroOps.IO  ',
          password: 'SecretPassword123!',
          name: 'Developer One',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('dev@zeroops.io');
      expect(data.user.name).toBe('Developer One');
      expect(cookieHeader).toContain('connect.sid');

      // Verify stored user password is hashed with scrypt salt:hash
      const storedUser = users['dev@zeroops.io'];
      expect(storedUser).toBeDefined();
      expect(storedUser.password).not.toBe('SecretPassword123!');
      expect(storedUser.password).toContain(':');
    });

    it('POST /api/auth/signup generates default name from email prefix if omitted', async () => {
      // Clear cookie to simulate new visitor
      cookieHeader = '';
      const res = await makeRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: 'Alice@Zerops.Dev',
          password: 'Password123!',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.name).toBe('alice');
      expect(data.user.email).toBe('alice@zerops.dev');
    });

    it('POST /api/auth/signup returns 409 Conflict when registering duplicate email (case-insensitive)', async () => {
      const res = await makeRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: 'DEV@zeroops.io',
          password: 'AnotherPassword123!',
        }),
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('User already exists');
    });

    it('POST /api/auth/login returns 400 if credentials missing', async () => {
      const res = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'dev@zeroops.io' }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/login returns 401 for invalid password or unknown user', async () => {
      const res1 = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'dev@zeroops.io', password: 'WrongPassword' }),
      });
      expect(res1.status).toBe(401);

      const res2 = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'nonexistent@zeroops.io', password: 'Password123!' }),
      });
      expect(res2.status).toBe(401);
    });

    it('POST /api/auth/login authenticates user successfully with normalized email', async () => {
      cookieHeader = ''; // Reset cookie
      const res = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: '  DEV@ZeroOps.io  ', password: 'SecretPassword123!' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('dev@zeroops.io');
      expect(data.hasToken).toBe(false);

      // Verify cookie attributes
      const rawCookie = res.headers.get('set-cookie') || '';
      expect(rawCookie).toContain('HttpOnly');
      expect(rawCookie).toContain('SameSite=Lax');
    });

    it('GET /api/auth/me returns authenticated user details', async () => {
      const res = await makeRequest('/api/auth/me');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe('dev@zeroops.io');
      expect(data.hasToken).toBe(false);
    });
  });

  describe('PAT Token Overlay & Authorization (/api/auth/token, /api/ws-token)', () => {
    it('POST /api/auth/token returns 401 for unauthenticated request', async () => {
      const tempCookie = cookieHeader;
      cookieHeader = '';
      const res = await makeRequest('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token' }),
      });
      expect(res.status).toBe(401);
      cookieHeader = tempCookie;
    });

    it('POST /api/auth/token returns 400 when token field is missing or whitespace only', async () => {
      const res1 = await makeRequest('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(res1.status).toBe(400);

      const res2 = await makeRequest('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({ token: '   ' }),
      });
      expect(res2.status).toBe(400);
      const data = await res2.json();
      expect(data.error).toBe('Token required');
    });

    it('POST /api/ws-token returns 400 when user has no stored PAT', async () => {
      const res = await makeRequest('/api/ws-token', {
        method: 'POST',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('No Zerops token configured');
    });

    it('POST /api/auth/token saves PAT overlay per session', async () => {
      const patToken = 'zerops_pat_secret_998877665544332211';
      const res = await makeRequest('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({ token: patToken }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify /api/auth/me reflects hasToken: true
      const meRes = await makeRequest('/api/auth/me');
      const meData = await meRes.json();
      expect(meData.hasToken).toBe(true);
    });

    it('POST /api/ws-token succeeds when user has PAT stored', async () => {
      const res = await makeRequest('/api/ws-token', {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('POST /api/auth/logout destroys session and clears cookie', async () => {
      const res = await makeRequest('/api/auth/logout', {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const rawCookie = res.headers.get('set-cookie') || '';
      expect(rawCookie).toContain('connect.sid=;');

      // Subsequent /api/auth/me must fail with 401
      const meRes = await makeRequest('/api/auth/me');
      expect(meRes.status).toBe(401);
    });
  });

  describe('PAT Token Wrapper & ZCP Client Passing', () => {
    it('CJS ZCPClient initializes with explicit apiToken', () => {
      const client = new ZCPClient('custom_pat_token_123');
      expect(client.apiToken).toBe('custom_pat_token_123');
    });

    it('CJS ZCPClient falls back to process.env.ZEROPS_TOKEN', () => {
      const prevEnv = process.env.ZEROPS_TOKEN;
      process.env.ZEROPS_TOKEN = 'env_pat_token_456';
      const client = new ZCPClient();
      expect(client.apiToken).toBe('env_pat_token_456');
      process.env.ZEROPS_TOKEN = prevEnv;
    });

    it('spawns zcli with user PAT token in env.ZEROPS_TOKEN when host process.env.ZEROPS_TOKEN is unset', async () => {
      const originalToken = process.env.ZEROPS_TOKEN;
      delete process.env.ZEROPS_TOKEN;

      let capturedEnv: Record<string, string | undefined> | undefined = undefined;
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      };
      const mockProc = {
        stdin: mockStdin,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === 'close') cb(0);
        }),
      };

      const spawnSpy = vi.spyOn(childProcess, 'spawn').mockImplementation((_cmd: any, _args: any, opts: any) => {
        capturedEnv = opts?.env;
        return mockProc as any;
      });

      delete require.cache[require.resolve('../src/server/zcp-client')];
      const FreshZCPClient = require('../src/server/zcp-client');

      const client = new FreshZCPClient('user_pat_token_secret_xyz');
      const logs: string[] = [];
      await client.provisionProject('testhostpat', undefined, (log: string) => logs.push(log));

      expect(spawnSpy).toHaveBeenCalledWith('zcli', ['project', 'project-import', '-'], expect.any(Object));
      expect(capturedEnv).toBeDefined();
      expect(capturedEnv?.ZEROPS_TOKEN).toBe('user_pat_token_secret_xyz');

      spawnSpy.mockRestore();
      delete require.cache[require.resolve('../src/server/zcp-client')];
      if (originalToken !== undefined) {
        process.env.ZEROPS_TOKEN = originalToken;
      }
    });

    it('writes multi-container custom YAML to zcliProc.stdin without overwriting with static fallback YAML', async () => {
      let capturedWrittenYaml = '';
      const mockStdin = {
        write: vi.fn((data: string) => {
          capturedWrittenYaml = data;
        }),
        end: vi.fn(),
      };
      const mockProc = {
        stdin: mockStdin,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === 'close') cb(0);
        }),
      };

      const spawnSpy = vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc as any);

      delete require.cache[require.resolve('../src/server/zcp-client')];
      const FreshZCPClient = require('../src/server/zcp-client');

      const customMultiContainerYaml = `project:
  name: custom-multi
services:
  - hostname: custom-frontend
    type: nodejs@22
  - hostname: custom-backend
    type: go@1.22
  - hostname: custom-db
    type: postgresql@16
  - hostname: custom-cache
    type: valkey@7.2`;

      const client = new FreshZCPClient('user_pat_token_secret_xyz');
      await client.provisionProject('custom-multi', customMultiContainerYaml, () => {});

      expect(mockStdin.write).toHaveBeenCalledWith(customMultiContainerYaml);
      expect(capturedWrittenYaml).toBe(customMultiContainerYaml);
      expect(capturedWrittenYaml).not.toContain('dbpostgres'); // Static fallback name
      expect(capturedWrittenYaml).toContain('hostname: custom-frontend');
      expect(capturedWrittenYaml).toContain('hostname: custom-backend');

      spawnSpy.mockRestore();
      delete require.cache[require.resolve('../src/server/zcp-client')];
    });

    it('CJS ZCPClient provisionProject provisions project and handles zeropsYmlContent', async () => {
      const mockStdin = { write: vi.fn(), end: vi.fn() };
      const mockProc = {
        stdin: mockStdin,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === 'close') cb(0);
        }),
      };
      const spawnSpy = vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc as any);

      const client = new ZCPClient('test_token');
      const logs: string[] = [];
      const res = await client.provisionProject('testproj', 'custom: yaml', (log: string) => logs.push(log));
      expect(res.status).toBe('active');
      expect(res.projectName).toBe('testproj');
      expect(logs.some(l => l.includes('testproj'))).toBe(true);

      spawnSpy.mockRestore();
    });

    it('TS ZcpClient initializes with apiToken and operates in mock/real mode', () => {
      const mockClient = new TsZcpClient({ apiToken: 'pat_token_789', mode: 'mock' });
      expect(mockClient).toBeDefined();

      // Real mode without token falls back to mock mode
      const fallbackClient = new TsZcpClient({ mode: 'real' });
      expect(fallbackClient).toBeDefined();
    });
  });

  describe('Private Network Environment Variable Injection', () => {
    it('injectPrivateNetEnv correctly injects environment variables for postgres and valkey variations', () => {
      const sampleSpec: any = {
        projectName: 'demo-app',
        runtimes: [
          { name: 'api', type: 'nodejs', ports: [8080], envVariables: {} }
        ],
        managedServices: [
          { name: 'my-postgres', type: 'postgres', port: 5432 },
          { name: 'my-redis', type: 'redis', port: 6379 }
        ]
      };

      const result = injectPrivateNetEnv(sampleSpec);
      const apiRuntime = result.runtimes.find(r => r.name === 'api');
      expect(apiRuntime).toBeDefined();
      expect(apiRuntime?.envVariables.DB_HOST).toBe('my-postgres');
      expect(apiRuntime?.envVariables.VALKEY_HOST).toBe('my-redis');
      expect(apiRuntime?.envVariables.DATABASE_URL).toContain('my-postgres');
      expect(apiRuntime?.envVariables.REDIS_URL).toContain('my-redis');
    });

    it('injectPrivateNetEnv handles non-standard service type names (postgres, redis, custom db names)', () => {
      const sampleSpec: any = {
        projectName: 'adv-app',
        runtimes: [
          { name: 'backend-service', type: 'go', ports: [8080], envVariables: { CUSTOM_APP_ENV: 'active' } }
        ],
        managedServices: [
          { name: 'my-custom-db', type: 'postgres', port: 5432, user: 'pguser', password: 'pgpass', dbName: 'pgdb' },
          { name: 'app-redis-cache', type: 'redis', port: 6379 }
        ]
      };

      const result = injectPrivateNetEnv(sampleSpec);
      const backendRuntime = result.runtimes.find(r => r.name === 'backend-service');
      expect(backendRuntime).toBeDefined();
      expect(backendRuntime?.envVariables.DB_HOST).toBe('my-custom-db');
      expect(backendRuntime?.envVariables.DB_PORT).toBe('5432');
      expect(backendRuntime?.envVariables.DB_USER).toBe('pguser');
      expect(backendRuntime?.envVariables.DB_PASSWORD).toBe('pgpass');
      expect(backendRuntime?.envVariables.DB_NAME).toBe('pgdb');
      expect(backendRuntime?.envVariables.DATABASE_URL).toBe('postgres://pguser:pgpass@my-custom-db:5432/pgdb');
      expect(backendRuntime?.envVariables.VALKEY_HOST).toBe('app-redis-cache');
      expect(backendRuntime?.envVariables.VALKEY_PORT).toBe('6379');
      expect(backendRuntime?.envVariables.REDIS_URL).toBe('redis://app-redis-cache:6379');
      expect(backendRuntime?.envVariables.API_HOST).toBe('backend-service');
      expect(backendRuntime?.envVariables.API_PORT).toBe('8080');
      expect(backendRuntime?.envVariables.API_URL).toBe('http://backend-service:8080');
      expect(backendRuntime?.envVariables.CUSTOM_APP_ENV).toBe('active');
    });

    it('injectPrivateNetEnv matches services by substring when type is non-standard', () => {
      const sampleSpec: any = {
        projectName: 'substring-app',
        runtimes: [
          { name: 'main-api', type: 'nodejs', ports: [3000], envVariables: {} }
        ],
        managedServices: [
          { name: 'cluster-postgres-db', type: 'custom-type-1', port: 5433 },
          { name: 'cluster-valkey-cache', type: 'custom-type-2', port: 6380 }
        ]
      };

      const result = injectPrivateNetEnv(sampleSpec);
      const mainApi = result.runtimes.find(r => r.name === 'main-api');
      expect(mainApi).toBeDefined();
      expect(mainApi?.envVariables.DB_HOST).toBe('cluster-postgres-db');
      expect(mainApi?.envVariables.VALKEY_HOST).toBe('cluster-valkey-cache');
      expect(mainApi?.envVariables.API_HOST).toBe('main-api');
    });
  });
});
