import { describe, it, expect } from 'vitest';
import { synthesizeStack } from '../src/synthesizer/stack-synthesizer.js';
import { injectPrivateNetEnv } from '../src/synthesizer/private-net.js';

describe('Private Network Injector', () => {
  it('should inject inter-service IP and connection env variables into all runtimes', () => {
    const rawSpec = synthesizeStack('Build Next.js app with Go API, Python worker, Postgres DB, and Valkey cache');
    const wiredSpec = injectPrivateNetEnv(rawSpec);

    for (const runtime of wiredSpec.runtimes) {
      const env = runtime.envVariables;
      expect(env.DB_HOST).toBe('postgres');
      expect(env.DB_PORT).toBe('5432');
      expect(env.DB_USER).toBe('zerops');
      expect(env.DB_NAME).toBe('zeroops_db');
      expect(env.DATABASE_URL).toBe('postgres://zerops:zerops_secure_pass_2026@postgres:5432/zeroops_db');

      expect(env.VALKEY_HOST).toBe('valkey');
      expect(env.VALKEY_PORT).toBe('6379');
      expect(env.REDIS_URL).toBe('redis://valkey:6379');

      expect(env.API_HOST).toBe('api');
      expect(env.API_PORT).toBe('8080');
      expect(env.API_URL).toBe('http://api:8080');

      expect(env.PORT).toBeDefined();
    }
  });

  it('should preserve existing custom environment variables', () => {
    const rawSpec = synthesizeStack('Build app');
    rawSpec.runtimes[0].envVariables = { CUSTOM_SECRET: 'my_secret_123' };

    const wiredSpec = injectPrivateNetEnv(rawSpec);
    expect(wiredSpec.runtimes[0].envVariables.CUSTOM_SECRET).toBe('my_secret_123');
    expect(wiredSpec.runtimes[0].envVariables.DB_HOST).toBe('postgres');
  });
});
