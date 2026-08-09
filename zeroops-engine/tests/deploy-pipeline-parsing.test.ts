import { describe, it, expect } from 'vitest';

const {
  parseServiceStatuses,
  urlFromEnvDump,
  materialize,
} = require('../src/server/deploy-pipeline');

import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The pipeline reads Zerops state out of `zcli`'s human-facing table output, so
 * these parsers are the seam where a demo silently deploys nothing. Fixtures are
 * verbatim `zcli` output, box-drawing characters and log preamble included.
 */
describe('deploy pipeline output parsing', () => {
  describe('parseServiceStatuses', () => {
    const REAL_OUTPUT = [
      'Using config file: /home/zerops/.config/zerops/.zcli.yml',
      'time="2026-08-09T18:39:17+05:30" level=info msg="➤ INFO Selected service: webapp"',
      '┌────────────────────────┬────────┬─────────────────┐',
      '│ ID                     │ NAME   │ STATUS          │',
      '├────────────────────────┼────────┼─────────────────┤',
      '│ yjuOiEGJTHCbcs4lPlYSkw │ webapp │ READY_TO_DEPLOY │',
      '│ INcUBknhQjCB1M9WU262NQ │ db     │ ACTIVE          │',
      '└────────────────────────┴────────┴─────────────────┘',
    ].join('\n');

    it('maps each hostname to its status', () => {
      expect(parseServiceStatuses(REAL_OUTPUT)).toEqual({
        webapp: 'READY_TO_DEPLOY',
        db: 'ACTIVE',
      });
    });

    it('does not mistake the header row for a service', () => {
      // 'ID' fails the id shape test, so NAME/STATUS never becomes an entry.
      expect(parseServiceStatuses(REAL_OUTPUT)).not.toHaveProperty('NAME');
    });

    it('sees a freshly imported project as not yet deployable', () => {
      const activating = REAL_OUTPUT.replace('READY_TO_DEPLOY', 'NEW         ').replace(
        'ACTIVE          ',
        'NEW             '
      );
      expect(parseServiceStatuses(activating)).toEqual({ webapp: 'NEW', db: 'NEW' });
    });

    it('returns nothing rather than throwing on empty or junk output', () => {
      expect(parseServiceStatuses('')).toEqual({});
      expect(parseServiceStatuses(undefined)).toEqual({});
      expect(parseServiceStatuses('ERR project not found')).toEqual({});
    });
  });

  describe('urlFromEnvDump', () => {
    it('substitutes hostname and port into the project template', () => {
      const dump = 'PROJECT_zeropsSubdomainString="https://\\${hostname}-2dae-\\${port}.prg1.zerops.app"';
      expect(urlFromEnvDump(dump, 'webapp', 3000)).toBe(
        'https://webapp-2dae-3000.prg1.zerops.app'
      );
    });

    it('returns null when the platform gave us no subdomain to read back', () => {
      // The pipeline turns this into a failure rather than inventing a URL.
      expect(urlFromEnvDump('SOME_OTHER_VAR="x"', 'webapp', 3000)).toBeNull();
    });
  });

  describe('materialize', () => {
    it('strips the service prefix and refuses to escape the staging dir', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'materialize-test-'));
      try {
        const written = materialize(
          {
            'webapp/server.js': 'console.log(1)',
            'webapp/nested/app.config.json': '{}',
            '../../etc/passwd': 'nope',
          },
          dir,
          'webapp'
        );

        expect(written).toContain('server.js');
        expect(written).toContain(path.join('nested', 'app.config.json'));
        expect(fs.readFileSync(path.join(dir, 'server.js'), 'utf8')).toBe('console.log(1)');
        // The traversal segments are stripped, so it lands inside the dir.
        expect(written.every((p: string) => !p.includes('..'))).toBe(true);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
