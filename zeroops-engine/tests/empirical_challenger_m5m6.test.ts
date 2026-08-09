import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import childProcess from 'child_process';
import EventEmitter from 'events';
import { injectPrivateNetEnv } from '../src/synthesizer/private-net';

const { server, users } = require('../src/server/index');
const ZCPClient = require('../src/server/zcp-client');

describe('Empirical Verification Suite: Auth, PAT Overlay, Process Spawning, Env & Stdin Pass-through', () => {
  let httpServer: Server;
  let baseUrl: string;
  let sessionCookie = '';

  beforeAll(async () => {
    // Reset users store
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

  const req = async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
    return res;
  };

  describe('1. Auth & Session Lifecycle Verification', () => {
    it('rejects unauthenticated request to /api/auth/me with 401', async () => {
      const res = await req('/api/auth/me');
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Not authenticated');
    });

    it('creates user with signup, hashes password, and creates session cookie', async () => {
      const res = await req('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: '  Challenger@ZeroOps.Dev  ',
          password: 'SuperSecretPass123!',
          name: 'Empirical Tester'
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('challenger@zeroops.dev');
      expect(data.user.name).toBe('Empirical Tester');
      expect(sessionCookie).toContain('connect.sid');

      // Check stored password in memory is hashed
      const stored = users['challenger@zeroops.dev'];
      expect(stored).toBeDefined();
      expect(stored.password).not.toBe('SuperSecretPass123!');
      expect(stored.password).toContain(':');
    });

    it('stores Zerops PAT token per-session via /api/auth/token', async () => {
      const patToken = 'zerops_pat_token_test_abc123';
      const res = await req('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({ token: patToken })
      });
      expect(res.status).toBe(200);

      const meRes = await req('/api/auth/me');
      const meData = await meRes.json();
      expect(meData.hasToken).toBe(true);
      expect(users['challenger@zeroops.dev'].zeropsToken).toBe(patToken);
    });

    it('rejects empty or whitespace-only token submission with 400 Bad Request', async () => {
      const res = await req('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({ token: '    ' })
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Token required');
    });

    it('logs out and destroys session', async () => {
      const res = await req('/api/auth/logout', { method: 'POST' });
      expect(res.status).toBe(200);

      const meRes = await req('/api/auth/me');
      expect(meRes.status).toBe(401);
    });
  });

  describe('2. Process Spawning & ZEROPS_TOKEN Environment Isolation', () => {
    it('passes user PAT token into child process env.ZEROPS_TOKEN during zcli spawn', async () => {
      let spawnedCmd = '';
      let spawnedArgs: string[] = [];
      let spawnedOpts: any = null;

      const mockStdin = { write: vi.fn(), end: vi.fn() };
      const mockProc = {
        stdin: mockStdin,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === 'close') cb(0);
        }),
      };

      const spy = vi.spyOn(childProcess, 'spawn').mockImplementation((cmd: string, args: any, opts: any) => {
        spawnedCmd = cmd;
        spawnedArgs = args;
        spawnedOpts = opts;
        return mockProc as any;
      });

      const client = new ZCPClient('user_pat_999888777');
      await client.provisionProject('emp-test-app', 'project:\n  name: emp-test-app', () => {});

      expect(spy).toHaveBeenCalled();
      expect(spawnedCmd).toBe('zcli');
      expect(spawnedArgs).toEqual(['project', 'project-import', '-']);
      expect(spawnedOpts.env.ZEROPS_TOKEN).toBe('user_pat_999888777');

      spy.mockRestore();
    });

    it('falls back to process.env.ZEROPS_TOKEN when no explicit token passed to ZCPClient', async () => {
      const prevEnv = process.env.ZEROPS_TOKEN;
      process.env.ZEROPS_TOKEN = 'global_env_pat_555';

      let spawnedOpts: any = null;
      const mockProc = {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === 'close') cb(0);
        }),
      };

      const spy = vi.spyOn(childProcess, 'spawn').mockImplementation((_cmd: string, _args: any, opts: any) => {
        spawnedOpts = opts;
        return mockProc as any;
      });

      const client = new ZCPClient();
      await client.provisionProject('global-env-app', 'project:\n  name: global-env-app', () => {});

      expect(spawnedOpts.env.ZEROPS_TOKEN).toBe('global_env_pat_555');

      spy.mockRestore();
      if (prevEnv !== undefined) {
        process.env.ZEROPS_TOKEN = prevEnv;
      } else {
        delete process.env.ZEROPS_TOKEN;
      }
    });

    it('handles production zcli process stream events (stdout, stderr, exit code 0) when test fast-path is bypassed', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origVitest = process.env.VITEST;
      delete process.env.NODE_ENV;
      delete process.env.VITEST;

      class MockChildProc extends EventEmitter {
        stdin = { write: vi.fn(), end: vi.fn() };
        stdout = new EventEmitter();
        stderr = new EventEmitter();
      }

      const mockProc = new MockChildProc();

      const spy = vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => {
          mockProc.stdout.emit('data', Buffer.from('➤ INFO Yaml file checked\n'));
          mockProc.stderr.emit('data', Buffer.from('➤ INFO Core services activation started\n'));
          mockProc.emit('close', 0);
        });
        return mockProc as any;
      });

      const client = new ZCPClient('prod_pat_12345');
      const logs: string[] = [];
      const res = await client.provisionProject('prod-app', 'project:\n  name: prod-app', (l: string) => logs.push(l));

      expect(res.status).toBe('active');
      expect(res.projectName).toBe('prodapp');
      expect(logs.some(l => l.includes('Yaml file checked'))).toBe(true);

      spy.mockRestore();
      process.env.NODE_ENV = origNodeEnv;
      process.env.VITEST = origVitest;
    });

    it('handles production zcli process spawn error event gracefully without server crash', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origVitest = process.env.VITEST;
      delete process.env.NODE_ENV;
      delete process.env.VITEST;

      class MockChildProc extends EventEmitter {
        stdin = { write: vi.fn(), end: vi.fn() };
        stdout = new EventEmitter();
        stderr = new EventEmitter();
      }

      const mockProc = new MockChildProc();

      const spy = vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => {
          mockProc.emit('error', new Error('spawn zcli ENOENT'));
        });
        return mockProc as any;
      });

      const client = new ZCPClient('prod_pat_12345');
      const logs: string[] = [];
      const res = await client.provisionProject('err-app', 'project:\n  name: err-app', (l: string) => logs.push(l));

      expect(res.status).toBe('error');
      expect(res.projectName).toBe('errapp');
      expect(logs.some(l => l.includes('Failed to spawn zcli process'))).toBe(true);

      spy.mockRestore();
      process.env.NODE_ENV = origNodeEnv;
      process.env.VITEST = origVitest;
    });
  });

  describe('3. Custom YAML Stdin Pass-through Verification', () => {
    it('pipes custom multi-container YAML string directly to zcli process stdin', async () => {
      let writtenData = '';
      const mockStdin = {
        write: vi.fn((data: string) => {
          writtenData += data;
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

      const spy = vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc as any);

      const customYaml = `project:
  name: full-stack-cloud
services:
  - hostname: next-frontend
    type: nodejs@22
  - hostname: go-api
    type: go@1.22
  - hostname: py-worker
    type: python@3.12
  - hostname: pg-db
    type: postgresql@16
  - hostname: valkey-cache
    type: valkey@7.2`;

      const client = new ZCPClient('pat_token_custom_yaml');
      await client.provisionProject('full-stack-cloud', customYaml, () => {});

      expect(mockStdin.write).toHaveBeenCalledWith(customYaml);
      expect(writtenData).toBe(customYaml);
      expect(mockStdin.end).toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  describe('4. Private Network Env Variable Injection Verification', () => {
    it('injects DB_HOST, VALKEY_HOST, DATABASE_URL, and REDIS_URL into runtime containers', () => {
      const spec: any = {
        projectName: 'private-net-stack',
        runtimes: [
          { name: 'frontend', type: 'nodejs', ports: [3000], envVariables: {} },
          { name: 'api', type: 'go', ports: [8080], envVariables: {} },
          { name: 'worker', type: 'python', ports: [8000], envVariables: {} }
        ],
        managedServices: [
          { name: 'pg-main', type: 'postgres', port: 5432, user: 'appuser', password: 'secretpassword', dbName: 'appdb' },
          { name: 'valkey-main', type: 'redis', port: 6379 }
        ]
      };

      const hydrated = injectPrivateNetEnv(spec);

      for (const runtime of hydrated.runtimes) {
        expect(runtime.envVariables.DB_HOST).toBe('pg-main');
        expect(runtime.envVariables.DB_PORT).toBe('5432');
        expect(runtime.envVariables.DB_USER).toBe('appuser');
        expect(runtime.envVariables.DB_PASSWORD).toBe('secretpassword');
        expect(runtime.envVariables.DB_NAME).toBe('appdb');
        expect(runtime.envVariables.DATABASE_URL).toBe('postgres://appuser:secretpassword@pg-main:5432/appdb');
        expect(runtime.envVariables.VALKEY_HOST).toBe('valkey-main');
        expect(runtime.envVariables.VALKEY_PORT).toBe('6379');
        expect(runtime.envVariables.REDIS_URL).toBe('redis://valkey-main:6379');
      }
    });
  });
});
