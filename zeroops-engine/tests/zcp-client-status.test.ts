import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
const childProcess = require('child_process');
const ZCPClient = require('../src/server/zcp-client');

function fakeProc(exitCode: number, stdout = '') {
  const proc: any = new EventEmitter();
  proc.stdin = { write: () => {}, end: () => {} };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    proc.emit('close', exitCode);
  }, 0);
  return proc;
}

afterEach(() => vi.restoreAllMocks());

describe('provisionProject status honesty', () => {
  it('reports error and null url when zcli exits non-zero', async () => {
    vi.spyOn(childProcess, 'spawn').mockReturnValue(fakeProc(1));
    const logs: string[] = [];
    const result = await new ZCPClient('tok').provisionProject('demo', '', (l: string) => logs.push(l));

    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.liveUrl).toBeNull();
    expect(logs.join('\n')).not.toContain('ZCP-SUCCESS');
  });

  it('reports active with the parsed url when zcli exits zero', async () => {
    vi.spyOn(childProcess, 'spawn')
      .mockReturnValue(fakeProc(0, 'url: https://studio-7f3a.zerops.app\n'));
    const result = await new ZCPClient('tok').provisionProject('demo', '', () => {});

    expect(result.status).toBe('active');
    expect(result.liveUrl).toBe('https://studio-7f3a.zerops.app');
  });
});
