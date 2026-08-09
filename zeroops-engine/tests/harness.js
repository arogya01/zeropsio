"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockVerificationSuite = exports.MockWebStudioServer = exports.MockCodeSynthesizer = exports.MockStackSynthesizer = exports.MockZcpApiClient = exports.assert = exports.afterEach = exports.beforeEach = exports.after = exports.before = exports.test = exports.it = exports.describe = void 0;
exports.expect = expect;
exports.createMockEnvironment = createMockEnvironment;
exports.assertValidZeropsYaml = assertValidZeropsYaml;
exports.assertValidProjectImportYaml = assertValidProjectImportYaml;
const nodeAssert = __importStar(require("node:assert/strict"));
const nodeTest = __importStar(require("node:test"));
// Detect runtime environment (Vitest vs Node:test)
const isVitest = Boolean(process.env.VITEST || globalThis.__vitest_worker__);
// Dynamically load Vitest only if running under Vitest runner
let vitestMod;
if (isVitest) {
    try {
        vitestMod = await import('vitest');
    }
    catch {
        // Ignore fallback
    }
}
// Export runner primitives dynamically based on execution engine
exports.describe = (isVitest && vitestMod) ? vitestMod.describe : nodeTest.describe;
exports.it = (isVitest && vitestMod) ? vitestMod.it : nodeTest.it;
exports.test = (isVitest && vitestMod) ? vitestMod.test : nodeTest.test;
exports.before = (isVitest && vitestMod) ? vitestMod.beforeAll : nodeTest.before;
exports.after = (isVitest && vitestMod) ? vitestMod.afterAll : nodeTest.after;
exports.beforeEach = (isVitest && vitestMod) ? vitestMod.beforeEach : nodeTest.beforeEach;
exports.afterEach = (isVitest && vitestMod) ? vitestMod.afterEach : nodeTest.afterEach;
exports.assert = (isVitest && vitestMod) ? vitestMod.assert : nodeAssert.default;
function expect(actual) {
    if (isVitest && vitestMod) {
        return vitestMod.expect(actual);
    }
    const createMatcher = (isNot = false) => {
        const check = (condition, message) => {
            const pass = isNot ? !condition : condition;
            nodeAssert.default.ok(pass, message);
        };
        const matcher = {
            toBe(expected) {
                check(actual === expected, `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be' : 'to be'} ${JSON.stringify(expected)}`);
            },
            toEqual(expected) {
                if (isNot) {
                    nodeAssert.default.notDeepStrictEqual(actual, expected);
                }
                else {
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
            toContain(item) {
                if (typeof actual === 'string') {
                    check(actual.includes(item), `Expected string ${JSON.stringify(actual)} ${isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(item)}`);
                }
                else if (Array.isArray(actual)) {
                    check(actual.includes(item), `Expected array ${isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(item)}`);
                }
                else {
                    nodeAssert.default.fail(`toContain target must be array or string, got ${typeof actual}`);
                }
            },
            toHaveLength(length) {
                const actualLength = actual?.length;
                check(actualLength === length, `Expected length ${length}, got ${actualLength}`);
            },
            toBeGreaterThan(num) {
                check(actual > num, `Expected ${actual} ${isNot ? 'not to be >' : 'to be >'} ${num}`);
            },
            toBeGreaterThanOrEqual(num) {
                check(actual >= num, `Expected ${actual} ${isNot ? 'not to be >=' : 'to be >='} ${num}`);
            },
            toBeLessThan(num) {
                check(actual < num, `Expected ${actual} ${isNot ? 'not to be <' : 'to be <'} ${num}`);
            },
            toBeLessThanOrEqual(num) {
                check(actual <= num, `Expected ${actual} ${isNot ? 'not to be <=' : 'to be <='} ${num}`);
            },
            toMatch(pattern) {
                const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
                check(regex.test(String(actual)), `Expected ${JSON.stringify(actual)} ${isNot ? 'not to match' : 'to match'} ${regex}`);
            },
            toThrow(expectedError) {
                nodeAssert.default.equal(typeof actual, 'function', 'toThrow expects actual to be a function');
                let threw = false;
                let thrownError = null;
                try {
                    actual();
                }
                catch (err) {
                    threw = true;
                    thrownError = err;
                }
                check(threw, `Expected function ${isNot ? 'not to throw' : 'to throw an error'}`);
                if (threw && expectedError && !isNot) {
                    if (typeof expectedError === 'string') {
                        nodeAssert.default.ok(String(thrownError?.message || thrownError).includes(expectedError), `Expected error message to include "${expectedError}", got "${thrownError?.message || thrownError}"`);
                    }
                    else if (expectedError instanceof RegExp) {
                        nodeAssert.default.ok(expectedError.test(String(thrownError?.message || thrownError)), `Expected error message to match ${expectedError}, got "${thrownError?.message || thrownError}"`);
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
expect.rejects = async (fn) => {
    if (isVitest && vitestMod)
        return vitestMod.expect.rejects(fn);
    let threw = false;
    try {
        await fn();
    }
    catch {
        threw = true;
    }
    nodeAssert.default.ok(threw, 'Expected promise to reject');
};
expect.resolves = async (fn) => {
    if (isVitest && vitestMod)
        return vitestMod.expect.resolves(fn);
    let result;
    try {
        result = await fn();
    }
    catch (err) {
        nodeAssert.default.fail(`Expected promise to resolve, but rejected with: ${err}`);
    }
    return result;
};
// ============================================================================
// Mock Driver Implementations (For Opaque-Box Assertions)
// ============================================================================
class MockZcpApiClient {
    projects = new Map();
    shouldFailImport = false;
    shouldFailDeploy = false;
    callLogs = [];
    async importProject(spec) {
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
    async getProjectStatus(projectId) {
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
    async deployService(projectId, serviceName) {
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
    async deleteProject(projectId) {
        this.callLogs.push({ action: 'deleteProject', args: { projectId } });
        return this.projects.delete(projectId);
    }
}
exports.MockZcpApiClient = MockZcpApiClient;
class MockStackSynthesizer {
    parsePrompt(prompt) {
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
    generateYaml(spec) {
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
exports.MockStackSynthesizer = MockStackSynthesizer;
class MockCodeSynthesizer {
    injectStub = false;
    synthesizeCode(spec) {
        const files = {
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
    validateZeroStubs(files) {
        const stubsFound = [];
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
exports.MockCodeSynthesizer = MockCodeSynthesizer;
class MockWebStudioServer {
    isRunning = false;
    logs = [];
    topology = new Map();
    port = 3000;
    async start(port = 3000) {
        this.port = port;
        this.isRunning = true;
        this.logs.push({
            timestamp: new Date().toISOString(),
            service: 'system',
            stream: 'system',
            message: `Web Studio Server started on port ${port}`
        });
    }
    async stop() {
        this.isRunning = false;
        this.logs.push({
            timestamp: new Date().toISOString(),
            service: 'system',
            stream: 'system',
            message: `Web Studio Server stopped`
        });
    }
    broadcastLog(msg) {
        this.logs.push(msg);
    }
    updateTopologyNode(state) {
        this.topology.set(state.id, state);
    }
    getLogs(service) {
        if (!service)
            return [...this.logs];
        return this.logs.filter(l => l.service === service);
    }
    getTopology() {
        return Array.from(this.topology.values());
    }
    async triggerDeploy(serviceId) {
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
exports.MockWebStudioServer = MockWebStudioServer;
class MockVerificationSuite {
    simulateHttpFailure = false;
    simulateDbFailure = false;
    simulateCacheFailure = false;
    simulateQueueFailure = false;
    async auditHttp(url) {
        if (this.simulateHttpFailure || !url || url.includes('invalid')) {
            return { status: 500, ok: false };
        }
        return { status: 200, ok: true };
    }
    async auditDb(connectionString) {
        if (this.simulateDbFailure || connectionString.includes('fail')) {
            return { connected: false, writeOk: false };
        }
        return { connected: true, writeOk: true };
    }
    async auditCache(host, port) {
        if (this.simulateCacheFailure || host.includes('invalid')) {
            return { pingOk: false };
        }
        return { pingOk: true };
    }
    async auditQueueE2E(apiEndpoint) {
        if (this.simulateQueueFailure || apiEndpoint.includes('fail')) {
            return { passed: false };
        }
        return { passed: true, messageId: `msg_${Date.now()}` };
    }
    async runFullAudit(url) {
        const startTime = Date.now();
        const httpRes = await this.auditHttp(url);
        const dbRes = await this.auditDb('postgres://10.0.1.20:5432/app');
        const cacheRes = await this.auditCache('10.0.1.21', 6379);
        const queueRes = await this.auditQueueE2E(`${url}/api/queue`);
        const errors = [];
        if (!httpRes.ok)
            errors.push(`HTTP status check failed with status ${httpRes.status}`);
        if (!dbRes.connected || !dbRes.writeOk)
            errors.push('Database read/write verification failed');
        if (!cacheRes.pingOk)
            errors.push('Valkey cache ping verification failed');
        if (!queueRes.passed)
            errors.push('Queue end-to-end processing verification failed');
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
exports.MockVerificationSuite = MockVerificationSuite;
// ============================================================================
// Helper Utilities for Opaque-Box Suite Setup & Validations
// ============================================================================
function createMockEnvironment() {
    return {
        zcpClient: new MockZcpApiClient(),
        synthesizer: new MockStackSynthesizer(),
        codeGen: new MockCodeSynthesizer(),
        webStudio: new MockWebStudioServer(),
        verifier: new MockVerificationSuite()
    };
}
function assertValidZeropsYaml(yamlContent) {
    const isOk = yamlContent.includes('zerops:') && yamlContent.includes('setup:');
    if (isVitest && vitestMod) {
        vitestMod.assert.ok(isOk, 'zerops.yml must contain zerops: and setup: directives');
    }
    else {
        nodeAssert.default.ok(isOk, 'zerops.yml must contain zerops: and setup: directives');
    }
}
function assertValidProjectImportYaml(yamlContent) {
    const isOk = yamlContent.includes('project:') && yamlContent.includes('services:');
    if (isVitest && vitestMod) {
        vitestMod.assert.ok(isOk, 'Project import YAML must contain project: and services: sections');
    }
    else {
        nodeAssert.default.ok(isOk, 'Project import YAML must contain project: and services: sections');
    }
}
//# sourceMappingURL=harness.js.map