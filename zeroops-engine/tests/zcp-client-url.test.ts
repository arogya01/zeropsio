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
    expect(extractLiveUrl('')).toBeNull();
  });
});
