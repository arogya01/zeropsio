import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runSynthesis, runDeployment, runImport } from '../src/index.js';

describe('CLI & Engine API Functions', () => {
  const tmpDir = path.resolve('./tests/tmp_out');
  const deployTmpDir = path.resolve('./tests/tmp_deploy_out');

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      if (fs.existsSync(deployTmpDir)) fs.rmSync(deployTmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('should run synthesis programmatically and output files to specified directory', async () => {
    const result = await runSynthesis('Build Node app with Go API and Python worker', {
      outputDir: tmpDir,
      mock: true
    });

    expect(result.topology.projectName).toBeDefined();
    expect(result.configs.zeropsProjectImportYaml).toContain('project:');
    expect(result.configs.zeropsYaml).toContain('zerops:');

    expect(fs.existsSync(path.join(tmpDir, 'zerops-project-import.yml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'zerops.yml'))).toBe(true);
  });

  it('should run deployment programmatically in mock mode', async () => {
    const deployTmpDir = path.resolve('./tests/tmp_deploy_out');
    if (fs.existsSync(deployTmpDir)) {
      fs.rmSync(deployTmpDir, { recursive: true, force: true });
    }
    const result = await runDeployment('my-demo-project', {
      outputDir: deployTmpDir,
      mock: true
    });

    expect(result.project.name).toBe('my-demo-project');
    expect(result.deployment.status).toBe('SUCCESS');
    expect(result.privateTopology).toBeDefined();
  });

  it('should run import programmatically in mock mode', async () => {
    const yamlPath = path.join(tmpDir, 'zerops-project-import.yml');
    const projectInfo = await runImport(yamlPath, { mock: true });

    expect(projectInfo.name).toBeDefined();
    expect(projectInfo.services.length).toBeGreaterThan(0);
  });
});
