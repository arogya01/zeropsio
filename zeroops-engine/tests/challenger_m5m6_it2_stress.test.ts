import { describe, it, expect, vi } from 'vitest';
import childProcess from 'child_process';
import ZCPClient from '../src/server/zcp-client';
import HealthChecker from '../src/server/health-checker';
import { LiveAuditor } from '../src/verifier/live-auditor';
import EventEmitter from 'events';

describe('Adversarial Stress Harness — ZeroOps Engine Iteration 2 Audit Integrity', () => {

  describe('1. Malformed YAML & Edge Spec Handling', () => {
    it('handles corrupted YAML syntax without unhandled exceptions', async () => {
      const client = new ZCPClient('test-token');
      
      // Corrupted YAML string
      const malformedYaml = `
project:
  name: test-app
services:
  - hostname: web
    type: nodejs@22
  - hostname: [invalid syntax: :::
      bad indentation: {
`;
      
      // Spy spawn so zcli process doesn't fail on system missing zcli
      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      
      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => mockProc.emit('close', 0));
        return mockProc;
      });

      const logs: string[] = [];
      const result = await client.provisionProject('MalformedTestApp', malformedYaml, (msg) => logs.push(msg));
      
      expect(result).toBeDefined();
      expect(result.status).toBe('active');
      expect(result.projectName).toBe('malformedtestapp');
      // Should fall back to default services since yaml parsing failed
      expect(result.services.length).toBe(5);
      expect(result.services[0].id).toBe('web-frontend');

      vi.restoreAllMocks();
    });

    it('handles empty, boolean, array, or non-object YAML contents gracefully', async () => {
      const client = new ZCPClient('test-token');

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      
      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => mockProc.emit('close', 0));
        return mockProc;
      });

      const inputs = [
        '',
        '   \n\n  ',
        'true',
        '12345',
        '- item1\n- item2',
        '# Only comments\n# no key value pairs'
      ];

      for (const inputYaml of inputs) {
        const result = await client.provisionProject('TestApp', inputYaml, () => {});
        expect(result).toBeDefined();
        expect(result.status).toBe('active');
        expect(result.services.length).toBeGreaterThan(0);
      }

      vi.restoreAllMocks();
    });

    it('handles custom YAML with non-standard service fields', async () => {
      const client = new ZCPClient('test-token');

      const customYaml = `
project:
  name: custom-stack
services:
  - name: my-custom-api
    type: go@1.22
  - hostname: custom-worker
    type: python@3.12
  - hostname: custom-db
    type: postgresql@16
`;

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => mockProc.emit('close', 0));
        return mockProc;
      });

      const result = await client.provisionProject('CustomStack', customYaml, () => {});
      expect(result.services.length).toBe(3);
      expect(result.services[0].id).toBe('my-custom-api');
      expect(result.services[0].port).toBe(8080);
      expect(result.services[1].id).toBe('custom-worker');
      expect(result.services[1].port).toBe(5000);
      expect(result.services[2].id).toBe('custom-db');
      expect(result.services[2].port).toBe(5432);

      vi.restoreAllMocks();
    });
  });

  describe('2. Missing & Boundary Fields Handling', () => {
    it('sanitizes undefined, null, empty, or special character project names', async () => {
      const client = new ZCPClient('test-token');

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => mockProc.emit('close', 0));
        return mockProc;
      });

      const testCases = [
        { input: undefined, expected: 'zeroopsapp' },
        { input: null, expected: 'zeroopsapp' },
        { input: '   ', expected: 'zeroopsapp' },
        { input: '!!!@@@###$$$', expected: 'zeroopsapp' },
        { input: 'VeryLongProjectNameExceedingTwentyCharactersInLength', expected: 'verylongprojectnamee' }
      ];

      for (const tc of testCases) {
        const result = await client.provisionProject(tc.input as any, '', () => {});
        expect(result.projectName).toBe(tc.expected);
        expect(result.liveUrl).toBe(`https://${tc.expected}.zerops.app`);
      }

      vi.restoreAllMocks();
    });

    it('handles non-function onLogStream parameter without error', async () => {
      const client = new ZCPClient('test-token');

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => mockProc.emit('close', 0));
        return mockProc;
      });

      // Pass non-functions for onLogStream
      await expect(client.provisionProject('TestApp', '', null as any)).resolves.toBeDefined();
      await expect(client.provisionProject('TestApp', '', 'not-a-fn' as any)).resolves.toBeDefined();
      await expect(client.provisionProject('TestApp', '', { log: true } as any)).resolves.toBeDefined();

      vi.restoreAllMocks();
    });
  });

  describe('3. Token Environment Overlays & Auth Isolation', () => {
    it('correctly passes apiToken to spawn env without polluting global process.env', async () => {
      const originalZeroOpsToken = process.env.ZEROPS_TOKEN;
      process.env.ZEROPS_TOKEN = 'global-env-token';

      const customTokenClient = new ZCPClient('user-specific-token-999');

      let spawnedEnv: Record<string, string | undefined> | undefined = undefined;

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation((cmd, args, opts) => {
        spawnedEnv = opts?.env as any;
        setImmediate(() => mockProc.emit('close', 0));
        return mockProc;
      });

      await customTokenClient.provisionProject('TokenTest', '', () => {});

      expect(spawnedEnv).toBeDefined();
      expect(spawnedEnv?.ZEROPS_TOKEN).toBe('user-specific-token-999');
      // Verify global process.env was unchanged
      expect(process.env.ZEROPS_TOKEN).toBe('global-env-token');

      // Cleanup
      if (originalZeroOpsToken !== undefined) {
        process.env.ZEROPS_TOKEN = originalZeroOpsToken;
      } else {
        delete process.env.ZEROPS_TOKEN;
      }
      vi.restoreAllMocks();
    });

    it('falls back to process.env.ZEROPS_TOKEN when constructor argument is omitted', async () => {
      process.env.ZEROPS_TOKEN = 'fallback-env-token';

      const client = new ZCPClient();
      expect(client.apiToken).toBe('fallback-env-token');

      let spawnedEnv: Record<string, string | undefined> | undefined = undefined;

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation((cmd, args, opts) => {
        spawnedEnv = opts?.env as any;
        setImmediate(() => mockProc.emit('close', 0));
        return mockProc;
      });

      await client.provisionProject('FallbackTest', '', () => {});

      expect(spawnedEnv?.ZEROPS_TOKEN).toBe('fallback-env-token');

      delete process.env.ZEROPS_TOKEN;
      vi.restoreAllMocks();
    });
  });

  describe('4. Process Error Events & Failure Resilience', () => {
    it('handles process spawn error event (e.g. ENOENT) cleanly', async () => {
      const client = new ZCPClient('test-token');

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => mockProc.emit('error', new Error('spawn zcli ENOENT')));
        return mockProc;
      });

      const logs: string[] = [];
      const result = await client.provisionProject('ErrorApp', '', (m) => logs.push(m));

      expect(result.status).toBe('error');
      expect(logs.some(l => l.includes('Failed to spawn zcli process'))).toBe(true);

      vi.restoreAllMocks();
    });

    it('handles non-zero process exit code cleanly', async () => {
      const client = new ZCPClient('test-token');

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => {
          mockProc.stderr.emit('data', Buffer.from('Error: invalid project token'));
          mockProc.emit('close', 1);
        });
        return mockProc;
      });

      const logs: string[] = [];
      const result = await client.provisionProject('NonZeroExitApp', '', (m) => logs.push(m));

      expect(result.status).toBe('error');
      expect(logs.some(l => l.includes('Process finished with exit code 1'))).toBe(true);
      expect(logs.some(l => l.includes('Error: invalid project token'))).toBe(true);

      vi.restoreAllMocks();
    });

    it('prevents double settlement when both error and close events fire', async () => {
      const client = new ZCPClient('test-token');

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = { write: vi.fn(), end: vi.fn() };
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();

      vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
        setImmediate(() => {
          mockProc.emit('error', new Error('Spawn error'));
          mockProc.emit('close', 1);
        });
        return mockProc;
      });

      const result = await client.provisionProject('DoubleSettleApp', '', () => {});
      expect(result.status).toBe('error');

      vi.restoreAllMocks();
    });
  });

  describe('5. HealthChecker & LiveAuditor Genuine Failure & Mock Mode Verification', () => {
    it('executes real auditor probes when mockMode is false', async () => {
      const auditor = new LiveAuditor({ mockMode: false, retries: 1, timeoutMs: 100 });
      
      // Network probe against non-existent URL should return 500 or 503, not fake 200
      const httpRes = await auditor.auditHttp('http://127.0.0.1:59999/non-existent-port');
      expect(httpRes.ok).toBe(false);
      expect([500, 503, 504]).toContain(httpRes.status);
    });

    it('reports failure when DB and Cache endpoints are unreachable in real mode', async () => {
      const auditor = new LiveAuditor({
        mockMode: false,
        retries: 1,
        timeoutMs: 100,
        postgresHost: '127.0.0.1',
        postgresPort: 59998,
        valkeyHost: '127.0.0.1',
        valkeyPort: 59997
      });

      const fullAudit = await auditor.runFullAudit('http://127.0.0.1:59999', 'test-app');
      expect(fullAudit.success).toBe(false);
      expect(fullAudit.passed).toBe(false);
      expect(fullAudit.auditsPassed).toBe(0);
      expect(fullAudit.score).toBe('0%');
      expect(fullAudit.errors.length).toBeGreaterThan(0);
    });

    it('HealthChecker delegates completely to LiveAuditor without artificial sleep overrides', async () => {
      const checker = new HealthChecker({ mockMode: true });
      const startTime = Date.now();
      const result = await checker.runAudit('test-project', 'https://example.com');
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.auditsPassed).toBe(4);
      expect(result.score).toBe('100%');
      // Verify no forced artificial 300ms delays occurred
      expect(duration).toBeLessThan(1000);
    });
  });
});
