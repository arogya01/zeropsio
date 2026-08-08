import * as nodeAssert from 'node:assert/strict';
import * as nodeTest from 'node:test';

// Detect runtime environment (Vitest vs Node:test)
const isVitest = Boolean(process.env.VITEST || (globalThis as any).__vitest_worker__);

// Dynamically load Vitest only if running under Vitest runner
let vitestMod: typeof import('vitest') | undefined;
if (isVitest) {
  try {
    vitestMod = await import('vitest');
  } catch {
    // Ignore fallback
  }
}

// Export runner primitives dynamically based on execution engine
export const describe = (isVitest && vitestMod) ? vitestMod.describe : nodeTest.describe;
export const it = (isVitest && vitestMod) ? vitestMod.it : nodeTest.it;
export const test = (isVitest && vitestMod) ? vitestMod.test : nodeTest.test;
export const before = (isVitest && vitestMod) ? vitestMod.beforeAll : nodeTest.before;
export const after = (isVitest && vitestMod) ? vitestMod.afterAll : nodeTest.after;
export const beforeEach = (isVitest && vitestMod) ? vitestMod.beforeEach : nodeTest.beforeEach;
export const afterEach = (isVitest && vitestMod) ? vitestMod.afterEach : nodeTest.afterEach;
export const assert = (isVitest && vitestMod) ? vitestMod.assert : nodeAssert.default;

// ============================================================================
// Expect Assertion Utility Definition (Node:test & Vitest fallback)
// ============================================================================

interface ExpectMatcher<T = any> {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toContain(item: any): void;
  toHaveLength(length: number): void;
  toBeGreaterThan(num: number): void;
  toBeGreaterThanOrEqual(num: number): void;
  toBeLessThan(num: number): void;
  toBeLessThanOrEqual(num: number): void;
  toMatch(pattern: RegExp | string): void;
  toThrow(expectedError?: string | RegExp | Error): void;
  not: ExpectMatcher<T>;
}

export function expect<T = any>(actual: T): any {
  if (isVitest && vitestMod) {
    return vitestMod.expect(actual);
  }

  const createMatcher = (isNot: boolean = false): ExpectMatcher<T> => {
    const check = (condition: boolean, message: string) => {
      const pass = isNot ? !condition : condition;
      nodeAssert.default.ok(pass, message);
    };

    const matcher: ExpectMatcher<T> = {
      toBe(expected: any) {
        check(
          actual === expected,
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be' : 'to be'} ${JSON.stringify(expected)}`
        );
      },
      toEqual(expected: any) {
        if (isNot) {
          nodeAssert.default.notDeepStrictEqual(actual, expected);
        } else {
          nodeAssert.default.deepStrictEqual(actual, expected);
        }
      },
      toBeTruthy() {
        check(Boolean(actual), `Expected ${JSON.stringify(actual)} ${isNot ? 'to be falsy' : 'to be truthy'}`);
      },
      toBeFalsy() {
        check(!Boolean(actual), `Expected ${JSON.stringify(actual)} ${isNot ? 'to be truthy' : 'to be falsy'}`);
      },
      toBeNull() {
        check(actual === null, `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be null' : 'to be null'}`);
      },
      toBeUndefined() {
        check(actual === undefined, `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be undefined' : 'to be undefined'}`);
      },
      toBeDefined() {
        check(actual !== undefined, `Expected value ${isNot ? 'to be undefined' : 'to be defined'}`);
      },
      toContain(item: any) {
        if (typeof actual === 'string') {
          check(actual.includes(item), `Expected string ${JSON.stringify(actual)} ${isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(item)}`);
        } else if (Array.isArray(actual)) {
          check(actual.includes(item), `Expected array ${isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(item)}`);
        } else {
          nodeAssert.default.fail(`toContain target must be array or string, got ${typeof actual}`);
        }
      },
      toHaveLength(length: number) {
        const actualLength = (actual as any)?.length;
        check(actualLength === length, `Expected length ${length}, got ${actualLength}`);
      },
      toBeGreaterThan(num: number) {
        check((actual as any) > num, `Expected ${actual} ${isNot ? 'not to be >' : 'to be >'} ${num}`);
      },
      toBeGreaterThanOrEqual(num: number) {
        check((actual as any) >= num, `Expected ${actual} ${isNot ? 'not to be >=' : 'to be >='} ${num}`);
      },
      toBeLessThan(num: number) {
        check((actual as any) < num, `Expected ${actual} ${isNot ? 'not to be <' : 'to be <'} ${num}`);
      },
      toBeLessThanOrEqual(num: number) {
        check((actual as any) <= num, `Expected ${actual} ${isNot ? 'not to be <=' : 'to be <='} ${num}`);
      },
      toMatch(pattern: RegExp | string) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        check(regex.test(String(actual)), `Expected ${JSON.stringify(actual)} ${isNot ? 'not to match' : 'to match'} ${regex}`);
      },
      toThrow(expectedError?: string | RegExp | Error) {
        nodeAssert.default.equal(typeof actual, 'function', 'toThrow expects actual to be a function');
        let threw = false;
        let thrownError: any = null;
        try {
          (actual as any)();
        } catch (err) {
          threw = true;
          thrownError = err;
        }

        check(threw, `Expected function ${isNot ? 'not to throw' : 'to throw an error'}`);

        if (threw && expectedError && !isNot) {
          if (typeof expectedError === 'string') {
            nodeAssert.default.ok(
              String(thrownError?.message || thrownError).includes(expectedError),
              `Expected error message to include "${expectedError}", got "${thrownError?.message || thrownError}"`
            );
          } else if (expectedError instanceof RegExp) {
            nodeAssert.default.ok(
              expectedError.test(String(thrownError?.message || thrownError)),
              `Expected error message to match ${expectedError}, got "${thrownError?.message || thrownError}"`
            );
          }
        }
      },
      get not() {
        return createMatcher(!isNot);
      }
    };

    return matcher;
  };

  return createMatcher(false);
}

// Async rejects / resolves helper on expect
(expect as any).rejects = async (fn: () => Promise<any>) => {
  if (isVitest && vitestMod) return (vitestMod.expect as any).rejects(fn);
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  nodeAssert.default.ok(threw, 'Expected promise to reject');
};

(expect as any).resolves = async (fn: () => Promise<any>) => {
  if (isVitest && vitestMod) return (vitestMod.expect as any).resolves(fn);
  let result;
  try {
    result = await fn();
  } catch (err) {
    nodeAssert.default.fail(`Expected promise to resolve, but rejected with: ${err}`);
  }
  return result;
};


// ============================================================================
// Interface Contracts (PROJECT.md)
// ============================================================================

export interface StackTopologySpec {
  projectName: string;
  runtimes: Array<{
    name: string; // e.g. 'frontend', 'api', 'worker'
    runtime: 'nodejs' | 'go' | 'python' | 'rust' | 'bun';
    ports: number[];
    envVariables: Record<string, string>;
  }>;
  managedServices: Array<{
    name: string; // e.g. 'postgres', 'valkey'
    type: 'postgresql' | 'valkey';
    mode: 'HA' | 'SINGLE';
  }>;
}

export interface GeneratedConfigs {
  zeropsProjectImportYaml: string;
  zeropsYaml: string;
}

export interface LogStreamMessage {
  timestamp: string;
  service: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface TopologyNodeState {
  id: string;
  name: string;
  type: 'runtime' | 'database' | 'cache';
  status: 'HEALTHY' | 'BUILDING' | 'FAILED';
  privateIp?: string;
}

export interface HealthAuditResult {
  passed: boolean;
  httpStatus: number;
  liveUrl: string;
  privateDbConnected: boolean;
  privateCacheConnected: boolean;
  queueE2EPassed: boolean;
  latencyMs: number;
  errors: string[];
}

export interface GeneratedCodeArtifacts {
  files: Record<string, string>; // path -> content
  hasPlaceholders: boolean;
  astValid: boolean;
}

// ============================================================================
// Driver Contract Interfaces
// ============================================================================

export interface IZcpApiClient {
  importProject(spec: StackTopologySpec): Promise<{ projectId: string; status: string }>;
  getProjectStatus(projectId: string): Promise<{
    projectId: string;
    status: string;
    services: Array<{ name: string; status: string; privateIp?: string }>;
  }>;
  deployService(projectId: string, serviceName: string): Promise<{ status: string; buildLog: string[] }>;
  deleteProject(projectId: string): Promise<boolean>;
}

export interface IStackSynthesizer {
  parsePrompt(prompt: string): StackTopologySpec;
  generateYaml(spec: StackTopologySpec): GeneratedConfigs;
}

export interface ICodeSynthesizer {
  synthesizeCode(spec: StackTopologySpec): GeneratedCodeArtifacts;
  validateZeroStubs(files: Record<string, string>): { isClean: boolean; stubsFound: string[] };
}

export interface IWebStudioServer {
  start(port?: number): Promise<void>;
  stop(): Promise<void>;
  broadcastLog(msg: LogStreamMessage): void;
  updateTopologyNode(state: TopologyNodeState): void;
  getLogs(service?: string): LogStreamMessage[];
  getTopology(): TopologyNodeState[];
  triggerDeploy(serviceId: string): Promise<{ success: boolean; deployId: string }>;
}

export interface IVerificationSuite {
  auditHttp(url: string): Promise<{ status: number; ok: boolean }>;
  auditDb(connectionString: string): Promise<{ connected: boolean; writeOk: boolean }>;
  auditCache(host: string, port: number): Promise<{ pingOk: boolean }>;
  auditQueueE2E(apiEndpoint: string): Promise<{ passed: boolean; messageId?: string }>;
  runFullAudit(url: string): Promise<HealthAuditResult>;
}

// ============================================================================
// Mock Driver Implementations (For Opaque-Box Assertions)
// ============================================================================

export class MockZcpApiClient implements IZcpApiClient {
  public projects: Map<string, {
    spec: StackTopologySpec;
    status: string;
    services: Array<{ name: string; status: string; privateIp?: string }>;
  }> = new Map();

  public shouldFailImport = false;
  public shouldFailDeploy = false;
  public callLogs: Array<{ action: string; args: any }> = [];

  async importProject(spec: StackTopologySpec): Promise<{ projectId: string; status: string }> {
    this.callLogs.push({ action: 'importProject', args: { spec } });
    if (this.shouldFailImport) {
      throw new Error('ZCP API Error: Project import failed due to quota limit or invalid spec');
    }

    const projectId = `proj_${spec.projectName}_${Date.now()}`;
    const services = [
      ...spec.runtimes.map((r, idx) => ({
        name: r.name,
        status: 'HEALTHY',
        privateIp: `10.0.0.${10 + idx}`
      })),
      ...spec.managedServices.map((m, idx) => ({
        name: m.name,
        status: 'HEALTHY',
        privateIp: `10.0.1.${20 + idx}`
      }))
    ];

    this.projects.set(projectId, { spec, status: 'ACTIVE', services });
    return { projectId, status: 'ACTIVE' };
  }

  async getProjectStatus(projectId: string): Promise<{
    projectId: string;
    status: string;
    services: Array<{ name: string; status: string; privateIp?: string }>;
  }> {
    this.callLogs.push({ action: 'getProjectStatus', args: { projectId } });
    const proj = this.projects.get(projectId);
    if (!proj) {
      throw new Error(`Project ${projectId} not found`);
    }
    return {
      projectId,
      status: proj.status,
      services: proj.services
    };
  }

  async deployService(projectId: string, serviceName: string): Promise<{ status: string; buildLog: string[] }> {
    this.callLogs.push({ action: 'deployService', args: { projectId, serviceName } });
    if (this.shouldFailDeploy) {
      return {
        status: 'FAILED',
        buildLog: ['[ERROR] Build step failed: exited with status code 1']
      };
    }
    return {
      status: 'SUCCESS',
      buildLog: [
        `[INFO] Starting build for service ${serviceName}`,
        `[INFO] Packaging artifacts...`,
        `[INFO] Deploying container image to Zerops VXLAN`,
        `[SUCCESS] Service ${serviceName} deployed and healthy`
      ]
    };
  }

  async deleteProject(projectId: string): Promise<boolean> {
    this.callLogs.push({ action: 'deleteProject', args: { projectId } });
    return this.projects.delete(projectId);
  }
}

export class MockStackSynthesizer implements IStackSynthesizer {
  parsePrompt(prompt: string): StackTopologySpec {
    const nameMatch = prompt.match(/for ([a-z0-9-]+)/i) || prompt.match(/^([a-z0-9-]+)/i);
    const projectName = nameMatch ? nameMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, '') : 'demo-app';

    return {
      projectName,
      runtimes: [
        {
          name: 'frontend',
          runtime: prompt.includes('Bun') ? 'bun' : 'nodejs',
          ports: [3000],
          envVariables: {
            PORT: '3000',
            API_URL: 'http://api:8080'
          }
        },
        {
          name: 'api',
          runtime: prompt.includes('Go') ? 'go' : 'nodejs',
          ports: [8080],
          envVariables: {
            PORT: '8080',
            DB_HOST: '10.0.1.20',
            VALKEY_HOST: '10.0.1.21'
          }
        },
        {
          name: 'worker',
          runtime: prompt.includes('Python') ? 'python' : 'nodejs',
          ports: [],
          envVariables: {
            VALKEY_HOST: '10.0.1.21',
            DB_HOST: '10.0.1.20'
          }
        }
      ],
      managedServices: [
        {
          name: 'postgres',
          type: 'postgresql',
          mode: 'HA'
        },
        {
          name: 'valkey',
          type: 'valkey',
          mode: 'SINGLE'
        }
      ]
    };
  }

  generateYaml(spec: StackTopologySpec): GeneratedConfigs {
    const importServicesYaml = [
      `project:`,
      `  name: ${spec.projectName}`,
      `services:`,
      ...spec.runtimes.map(r => `  - name: ${r.name}\n    type: ${r.runtime}`),
      ...spec.managedServices.map(m => `  - name: ${m.name}\n    type: ${m.type}\n    mode: ${m.mode}`)
    ].join('\n');

    const zeropsYaml = [
      `zerops:`,
      ...spec.runtimes.map(r => [
        `  - setup: ${r.name}`,
        `    build:`,
        `      base: ${r.runtime}`,
        `      deployFiles: ./`,
        `    run:`,
        `      start: npm start`,
        `      envVariables:`,
        ...Object.entries(r.envVariables).map(([k, v]) => `        ${k}: "${v}"`)
      ].join('\n'))
    ].join('\n');

    return {
      zeropsProjectImportYaml: importServicesYaml,
      zeropsYaml
    };
  }
}

export class MockCodeSynthesizer implements ICodeSynthesizer {
  public injectStub = false;

  synthesizeCode(spec: StackTopologySpec): GeneratedCodeArtifacts {
    const files: Record<string, string> = {
      'src/frontend/App.tsx': `export default function App() { return <div>ZeroOps UI</div>; }`,
      'src/api/server.ts': `import express from 'express'; const app = express(); app.get('/health', (req, res) => res.json({ status: 'ok' })); app.listen(8080);`,
      'src/worker/consumer.ts': `console.log('Worker listening on queue...'); process.on('SIGTERM', () => process.exit(0));`,
      'migrations/001_init.sql': `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
    };

    if (this.injectStub) {
      files['src/api/stubs.ts'] = `// TODO: Implement user authentication\nfunction auth() { throw new Error("Not implemented"); }`;
    }

    const validation = this.validateZeroStubs(files);

    return {
      files,
      hasPlaceholders: !validation.isClean,
      astValid: true
    };
  }

  validateZeroStubs(files: Record<string, string>): { isClean: boolean; stubsFound: string[] } {
    const stubsFound: string[] = [];
    const stubPatterns = [
      /\/\/\s*TODO/i,
      /\/\/\s*STUB/i,
      /NOT_IMPLEMENTED/i,
      /throw\s+new\s+Error\s*\(\s*['"]Not implemented['"]\s*\)/i,
      /dummy/i,
      /placeholder/i
    ];

    for (const [filepath, content] of Object.entries(files)) {
      for (const pattern of stubPatterns) {
        if (pattern.test(content)) {
          stubsFound.push(`${filepath}: matches pattern ${pattern}`);
        }
      }
    }

    return {
      isClean: stubsFound.length === 0,
      stubsFound
    };
  }
}

export class MockWebStudioServer implements IWebStudioServer {
  public isRunning = false;
  public logs: LogStreamMessage[] = [];
  public topology: Map<string, TopologyNodeState> = new Map();
  public port = 3000;

  async start(port = 3000): Promise<void> {
    this.port = port;
    this.isRunning = true;
    this.logs.push({
      timestamp: new Date().toISOString(),
      service: 'system',
      stream: 'system',
      message: `Web Studio Server started on port ${port}`
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logs.push({
      timestamp: new Date().toISOString(),
      service: 'system',
      stream: 'system',
      message: `Web Studio Server stopped`
    });
  }

  broadcastLog(msg: LogStreamMessage): void {
    this.logs.push(msg);
  }

  updateTopologyNode(state: TopologyNodeState): void {
    this.topology.set(state.id, state);
  }

  getLogs(service?: string): LogStreamMessage[] {
    if (!service) return [...this.logs];
    return this.logs.filter(l => l.service === service);
  }

  getTopology(): TopologyNodeState[] {
    return Array.from(this.topology.values());
  }

  async triggerDeploy(serviceId: string): Promise<{ success: boolean; deployId: string }> {
    const node = this.topology.get(serviceId);
    if (node) {
      node.status = 'BUILDING';
    }
    const deployId = `deploy_${serviceId}_${Date.now()}`;
    this.broadcastLog({
      timestamp: new Date().toISOString(),
      service: serviceId,
      stream: 'system',
      message: `Triggered zero-downtime deploy ${deployId}`
    });

    return { success: true, deployId };
  }
}

export class MockVerificationSuite implements IVerificationSuite {
  public simulateHttpFailure = false;
  public simulateDbFailure = false;
  public simulateCacheFailure = false;
  public simulateQueueFailure = false;

  async auditHttp(url: string): Promise<{ status: number; ok: boolean }> {
    if (this.simulateHttpFailure || !url || url.includes('invalid')) {
      return { status: 500, ok: false };
    }
    return { status: 200, ok: true };
  }

  async auditDb(connectionString: string): Promise<{ connected: boolean; writeOk: boolean }> {
    if (this.simulateDbFailure || connectionString.includes('fail')) {
      return { connected: false, writeOk: false };
    }
    return { connected: true, writeOk: true };
  }

  async auditCache(host: string, port: number): Promise<{ pingOk: boolean }> {
    if (this.simulateCacheFailure || host.includes('invalid')) {
      return { pingOk: false };
    }
    return { pingOk: true };
  }

  async auditQueueE2E(apiEndpoint: string): Promise<{ passed: boolean; messageId?: string }> {
    if (this.simulateQueueFailure || apiEndpoint.includes('fail')) {
      return { passed: false };
    }
    return { passed: true, messageId: `msg_${Date.now()}` };
  }

  async runFullAudit(url: string): Promise<HealthAuditResult> {
    const startTime = Date.now();
    const httpRes = await this.auditHttp(url);
    const dbRes = await this.auditDb('postgres://10.0.1.20:5432/app');
    const cacheRes = await this.auditCache('10.0.1.21', 6379);
    const queueRes = await this.auditQueueE2E(`${url}/api/queue`);

    const errors: string[] = [];
    if (!httpRes.ok) errors.push(`HTTP status check failed with status ${httpRes.status}`);
    if (!dbRes.connected || !dbRes.writeOk) errors.push('Database read/write verification failed');
    if (!cacheRes.pingOk) errors.push('Valkey cache ping verification failed');
    if (!queueRes.passed) errors.push('Queue end-to-end processing verification failed');

    const passed = errors.length === 0;

    return {
      passed,
      httpStatus: httpRes.status,
      liveUrl: url,
      privateDbConnected: dbRes.connected && dbRes.writeOk,
      privateCacheConnected: cacheRes.pingOk,
      queueE2EPassed: queueRes.passed,
      latencyMs: Date.now() - startTime,
      errors
    };
  }
}

// ============================================================================
// Helper Utilities for Opaque-Box Suite Setup & Validations
// ============================================================================

export function createMockEnvironment() {
  return {
    zcpClient: new MockZcpApiClient(),
    synthesizer: new MockStackSynthesizer(),
    codeGen: new MockCodeSynthesizer(),
    webStudio: new MockWebStudioServer(),
    verifier: new MockVerificationSuite()
  };
}

export function assertValidZeropsYaml(yamlContent: string): void {
  const isOk = yamlContent.includes('zerops:') && yamlContent.includes('setup:');
  if (isVitest && vitestMod) {
    vitestMod.assert.ok(isOk, 'zerops.yml must contain zerops: and setup: directives');
  } else {
    nodeAssert.default.ok(isOk, 'zerops.yml must contain zerops: and setup: directives');
  }
}

export function assertValidProjectImportYaml(yamlContent: string): void {
  const isOk = yamlContent.includes('project:') && yamlContent.includes('services:');
  if (isVitest && vitestMod) {
    vitestMod.assert.ok(isOk, 'Project import YAML must contain project: and services: sections');
  } else {
    nodeAssert.default.ok(isOk, 'Project import YAML must contain project: and services: sections');
  }
}
