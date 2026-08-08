import {
  describe,
  it,
  expect,
  assert,
  createMockEnvironment,
  assertValidZeropsYaml,
  assertValidProjectImportYaml
} from './harness.js';

describe('ZeroOps Test Harness Integrity', () => {
  it('should verify expect matcher assertion utilities', () => {
    expect(1 + 1).toBe(2);
    expect({ a: 1 }).toEqual({ a: 1 });
    expect('hello world').toContain('world');
    expect([1, 2, 3]).toContain(2);
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect(null).toBeNull();
    expect(undefined).toBeUndefined();
    expect('test').toBeDefined();
    expect([1, 2]).toHaveLength(2);
    expect(10).toBeGreaterThan(5);
    expect(5).toBeLessThan(10);
    expect('abc-123').toMatch(/\d+/);
    expect(() => { throw new Error('boom'); }).toThrow('boom');

    // Negated matchers
    expect(5).not.toBe(10);
    expect('hello').not.toContain('world');
  });

  it('should verify MockZcpApiClient lifecycle', async () => {
    const { zcpClient, synthesizer } = createMockEnvironment();
    const spec = synthesizer.parsePrompt('Create e-commerce app for mystore');

    const importRes = await zcpClient.importProject(spec);
    expect(importRes.status).toBe('ACTIVE');
    expect(importRes.projectId).toContain('mystore');

    const statusRes = await zcpClient.getProjectStatus(importRes.projectId);
    expect(statusRes.services).toHaveLength(5); // 3 runtimes + 2 managed services

    const deployRes = await zcpClient.deployService(importRes.projectId, 'frontend');
    expect(deployRes.status).toBe('SUCCESS');

    const deleted = await zcpClient.deleteProject(importRes.projectId);
    expect(deleted).toBeTruthy();
  });

  it('should verify MockStackSynthesizer topology and YAML generation', () => {
    const { synthesizer } = createMockEnvironment();
    const spec = synthesizer.parsePrompt('Build SaaS app for acme using Bun and Go and Python');

    expect(spec.projectName).toBe('acme');
    expect(spec.runtimes.length).toBeGreaterThanOrEqual(3);
    expect(spec.managedServices.length).toBeGreaterThanOrEqual(2);

    const apiRuntime = spec.runtimes.find(r => r.name === 'api');
    expect(apiRuntime?.envVariables.DB_HOST).toBeDefined();
    expect(apiRuntime?.envVariables.VALKEY_HOST).toBeDefined();

    const yaml = synthesizer.generateYaml(spec);
    assertValidZeropsYaml(yaml.zeropsYaml);
    assertValidProjectImportYaml(yaml.zeropsProjectImportYaml);
  });

  it('should verify MockCodeSynthesizer zero-stub AST validation', () => {
    const { codeGen, synthesizer } = createMockEnvironment();
    const spec = synthesizer.parsePrompt('for testapp');

    const artifacts = codeGen.synthesizeCode(spec);
    expect(artifacts.hasPlaceholders).toBeFalsy();

    codeGen.injectStub = true;
    const stubArtifacts = codeGen.synthesizeCode(spec);
    expect(stubArtifacts.hasPlaceholders).toBeTruthy();
  });

  it('should verify MockWebStudioServer log streaming and topology states', async () => {
    const { webStudio } = createMockEnvironment();

    await webStudio.start(4000);
    webStudio.updateTopologyNode({
      id: 'node-1',
      name: 'frontend',
      type: 'runtime',
      status: 'HEALTHY',
      privateIp: '10.0.0.10'
    });

    webStudio.broadcastLog({
      timestamp: new Date().toISOString(),
      service: 'frontend',
      stream: 'stdout',
      message: 'Server ready on port 3000'
    });

    const logs = webStudio.getLogs('frontend');
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('Server ready');

    const topology = webStudio.getTopology();
    expect(topology).toHaveLength(1);
    expect(topology[0].status).toBe('HEALTHY');

    const deployRes = await webStudio.triggerDeploy('node-1');
    expect(deployRes.success).toBeTruthy();
    expect(webStudio.getTopology()[0].status).toBe('BUILDING');

    await webStudio.stop();
  });

  it('should verify MockVerificationSuite live health audit execution', async () => {
    const { verifier } = createMockEnvironment();

    const fullAudit = await verifier.runFullAudit('https://app.zerops.app');
    expect(fullAudit.passed).toBeTruthy();
    expect(fullAudit.httpStatus).toBe(200);
    expect(fullAudit.privateDbConnected).toBeTruthy();
    expect(fullAudit.privateCacheConnected).toBeTruthy();
    expect(fullAudit.queueE2EPassed).toBeTruthy();
    expect(fullAudit.errors).toHaveLength(0);

    verifier.simulateDbFailure = true;
    const failedAudit = await verifier.runFullAudit('https://app.zerops.app');
    expect(failedAudit.passed).toBeFalsy();
    expect(failedAudit.errors.length).toBeGreaterThan(0);
  });
});
