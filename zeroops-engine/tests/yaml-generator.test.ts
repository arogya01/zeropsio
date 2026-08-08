import { describe, it, expect } from 'vitest';
import * as yamlModule from 'js-yaml';
const yaml: typeof import('js-yaml') = (yamlModule as any).default || yamlModule;
import { synthesizeStack } from '../src/synthesizer/stack-synthesizer.js';
import { injectPrivateNetEnv } from '../src/synthesizer/private-net.js';
import {
  generateProjectImportYaml,
  generateZeropsYaml,
  generateZeropsConfigs
} from '../src/synthesizer/yaml-generator.js';

describe('YAML Generator', () => {
  it('should generate valid zerops-project-import.yml', () => {
    const rawSpec = synthesizeStack('Build fullstack app with Postgres and Valkey', { projectName: 'test-import-proj' });
    const importYaml = generateProjectImportYaml(rawSpec);

    expect(importYaml).toContain('project:');
    expect(importYaml).toContain('name: test-import-proj');

    const parsed: any = yaml.load(importYaml);
    expect(parsed.project).toBeDefined();
    expect(parsed.project.name).toBe('test-import-proj');
    expect(parsed.project.services.length).toBe(5);

    const postgresService = parsed.project.services.find((s: any) => s.name === 'postgres');
    expect(postgresService.type).toBe('postgresql@16');
    expect(postgresService.mode).toBe('HA');

    const nodeService = parsed.project.services.find((s: any) => s.name === 'frontend');
    expect(nodeService.type).toBe('nodejs@20');
  });

  it('should generate valid zerops.yml with build and run configs for runtimes only', () => {
    const rawSpec = synthesizeStack('Build fullstack app', { projectName: 'test-zerops-yml' });
    const enrichedSpec = injectPrivateNetEnv(rawSpec);
    const zeropsYaml = generateZeropsYaml(enrichedSpec);

    expect(zeropsYaml).toContain('zerops:');
    const parsed: any = yaml.load(zeropsYaml);
    expect(parsed.zerops).toBeDefined();
    expect(Array.isArray(parsed.zerops)).toBe(true);

    const frontendConfig = parsed.zerops.find((s: any) => s.setup === 'frontend');
    expect(frontendConfig).toBeDefined();
    expect(frontendConfig.build.base).toBe('nodejs@20');
    expect(frontendConfig.run.ports[0].port).toBe(3000);
    expect(frontendConfig.run.envVariables.DB_HOST).toBe('postgres');

    // Managed services should NOT be present in zerops.yml setups
    const postgresSetup = parsed.zerops.find((s: any) => s.setup === 'postgres');
    expect(postgresSetup).toBeUndefined();
  });

  it('should generate both configs via generateZeropsConfigs', () => {
    const spec = injectPrivateNetEnv(synthesizeStack('Go API and Python Worker'));
    const configs = generateZeropsConfigs(spec);

    expect(configs.zeropsProjectImportYaml).toBeDefined();
    expect(configs.zeropsYaml).toBeDefined();
  });
});
