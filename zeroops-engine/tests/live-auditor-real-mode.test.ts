import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const { LiveAuditor } = require('../src/verifier/live-auditor');

describe('LiveAuditor default mode', () => {
  const prev = process.env.MOCK_MODE;
  beforeEach(() => { delete process.env.MOCK_MODE; });
  afterEach(() => { if (prev === undefined) delete process.env.MOCK_MODE; else process.env.MOCK_MODE = prev; });

  it('defaults to real probing, not mock', () => {
    expect(new LiveAuditor().mockMode).toBe(false);
  });

  it('opts into mock only when MOCK_MODE=true', () => {
    process.env.MOCK_MODE = 'true';
    expect(new LiveAuditor().mockMode).toBe(true);
  });

  it('reports an unreachable host as failed, not 200', async () => {
    const auditor = new LiveAuditor({ retries: 1, timeoutMs: 300 });
    const res = await auditor.auditHttp('https://this-host-does-not-exist-zeroops.zerops.app');
    expect(res.ok).toBe(false);
  });

  it('does not claim the queue audit passed when it is not implemented', async () => {
    const auditor = new LiveAuditor({ retries: 1, timeoutMs: 300 });
    const res = await auditor.auditQueueE2E('https://example.invalid/api');
    expect(res.passed).toBe(false);
    expect(res.skipped).toBe(true);
  });
});
