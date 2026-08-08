import { describe, it, expect } from 'vitest';
import { ZcpClient } from '../src/zcp/zcp-client.js';
import { synthesizeStack } from '../src/synthesizer/stack-synthesizer.js';
import { generateProjectImportYaml, generateZeropsYaml } from '../src/synthesizer/yaml-generator.js';

describe('ZCP Client Bridge', () => {
  it('should default to mock mode when no token is present', () => {
    const client = new ZcpClient();
    expect(client.getMode()).toBe('mock');
  });

  it('should auto-fallback to mock mode when real mode is requested without token', () => {
    const client = new ZcpClient({ mode: 'real', apiToken: '' });
    expect(client.getMode()).toBe('mock');
  });

  it('should import project and assign synthetic private IPs in mock mode', async () => {
    const client = new ZcpClient({ mode: 'mock' });
    const spec = synthesizeStack('Build fullstack app', { projectName: 'mock-proj' });
    const importYaml = generateProjectImportYaml(spec);

    const projectInfo = await client.importProject(importYaml);
    expect(projectInfo.name).toBe('mock-proj');
    expect(projectInfo.status).toBe('READY');
    expect(projectInfo.services.length).toBe(5);

    const postgres = projectInfo.services.find(s => s.name === 'postgres');
    expect(postgres?.privateIp).toMatch(/^10\.0\.0\./);
  });

  it('should deploy service and return public URL & build logs in mock mode', async () => {
    const client = new ZcpClient({ mode: 'mock' });
    const spec = synthesizeStack('Build app');
    const zeropsYaml = generateZeropsYaml(spec);

    const deployResult = await client.deployService('frontend', zeropsYaml);
    expect(deployResult.status).toBe('SUCCESS');
    expect(deployResult.publicUrl).toContain('frontend');
    expect(deployResult.publicUrl).toContain('.zerops.app');
    expect(deployResult.logs.length).toBeGreaterThan(3);
  });

  it('should poll deployment status with log callback', async () => {
    const client = new ZcpClient({ mode: 'mock' });
    const deployResult = await client.deployService('api');

    const streamedLogs: string[] = [];
    const polledResult = await client.pollDeploymentStatus(deployResult.deploymentId, 5000, log => {
      streamedLogs.push(log);
    });

    expect(polledResult.status).toBe('SUCCESS');
    expect(streamedLogs.length).toBeGreaterThan(0);
  });

  it('should return private topology map with IP and connection strings', async () => {
    const client = new ZcpClient({ mode: 'mock' });
    const spec = synthesizeStack('Build app', { projectName: 'topo-proj' });
    const projectInfo = await client.importProject(generateProjectImportYaml(spec));

    const topoMap = await client.getPrivateTopology(projectInfo.id);
    expect(topoMap.postgres).toBeDefined();
    expect(topoMap.postgres.privateIp).toMatch(/^10\.0\.0\./);
    expect(topoMap.postgres.connectionString).toContain('postgres://zerops');

    expect(topoMap.valkey).toBeDefined();
    expect(topoMap.valkey.connectionString).toContain('redis://');
  });
});
