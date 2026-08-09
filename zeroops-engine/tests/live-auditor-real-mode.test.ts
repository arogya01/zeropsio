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

describe('LiveAuditor score/success consistency', () => {
  it('never reports score "100%" while success is false, even when only the queue check is skipped', async () => {
    // Everything else passes (mockMode covers HTTP/DB/cache), but the queue
    // check is forced to report skipped — isolating the exact scenario the
    // review flagged: a skipped/failed queue result must move `score`, not
    // just `success`/`queueE2EPassed`.
    const auditor = new LiveAuditor({ mockMode: true });
    auditor.auditQueueE2E = async () => ({ passed: false, skipped: true, reason: 'forced for test' });

    const result = await auditor.runFullAudit('https://mocked-app.zerops.app', 'test-app');

    expect(result.success).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.queueE2EPassed).toBe(false);
    expect(result.score).not.toBe('100%');
    expect(result.auditsPassed).toBe(4);
    expect(result.auditsTotal).toBe(5);
    expect(result.score).toBe('80%');
  });

  it('reports 100% only when every one of the 5 checks (including queue) actually passed', async () => {
    const auditor = new LiveAuditor({ mockMode: true });
    const result = await auditor.runFullAudit('https://mocked-app.zerops.app', 'test-app');

    expect(result.success).toBe(true);
    expect(result.auditsPassed).toBe(5);
    expect(result.auditsTotal).toBe(5);
    expect(result.score).toBe('100%');
  });
});
