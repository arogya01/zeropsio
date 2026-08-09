import { describe, it, expect } from 'vitest';
const { extractLiveUrl } = require('../src/server/zcp-client');

describe('extractLiveUrl', () => {
  it('extracts a real zerops.app subdomain from zcli output', () => {
    const out = 'service studio deployed\nurl: https://studio-7f3a.zerops.app\ndone';
    expect(extractLiveUrl(out)).toBe('https://studio-7f3a.zerops.app');
  });

  it('returns null when zcli printed no url', () => {
    expect(extractLiveUrl('build failed: exit status 1')).toBeNull();
  });

  it('never invents a url from a project name', () => {
    expect(extractLiveUrl('aivideoclipper')).toBeNull();
  });

  it('strips a trailing sentence period', () => {
    const out = 'Visit https://studio-7f3a.zerops.app.';
    expect(extractLiveUrl(out)).toBe('https://studio-7f3a.zerops.app');
  });

  it('strips a trailing colon before an error message', () => {
    const out = 'reach https://frontend-a1b2.zerops.app: dial tcp timeout';
    expect(extractLiveUrl(out)).toBe('https://frontend-a1b2.zerops.app');
  });

  it('strips ANSI escape sequences surrounding the url', () => {
    const out = '\x1b[36mhttps://studio-7f3a.zerops.app\x1b[0m';
    expect(extractLiveUrl(out)).toBe('https://studio-7f3a.zerops.app');
  });

  it('documents the known limitation: a url in a WARN/error line about an old deploy is still returned, since we do not parse log severity', () => {
    const out = 'WARN: previous deploy at https://old-abc1.zerops.app failed';
    expect(extractLiveUrl(out)).toBe('https://old-abc1.zerops.app');
  });

  it('takes the last url when zcli output contains more than one', () => {
    const out = 'redeploy: old https://old-xyz1.zerops.app superseded\nnow live at https://new-abc2.zerops.app';
    expect(extractLiveUrl(out)).toBe('https://new-abc2.zerops.app');
  });
});
