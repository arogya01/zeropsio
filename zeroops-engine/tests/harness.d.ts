import * as nodeAssert from 'node:assert/strict';
import * as nodeTest from 'node:test';
export declare const describe: import("vitest").SuiteAPI | typeof nodeTest.suite;
export declare const it: typeof nodeTest.test | import("vitest").TestAPI;
export declare const test: typeof nodeTest.test | import("vitest").TestAPI;
export declare const before: typeof import("vitest").beforeAll | typeof nodeTest.before;
export declare const after: typeof import("vitest").afterAll | typeof nodeTest.after;
export declare const beforeEach: typeof import("vitest").beforeEach | typeof nodeTest.beforeEach;
export declare const afterEach: typeof import("vitest").afterEach | typeof nodeTest.afterEach;
export declare const assert: typeof nodeAssert.strict | Chai.Assert;
export declare function expect<T = any>(actual: T): any;
export interface StackTopologySpec {
    projectName: string;
    runtimes: Array<{
        name: string;
        runtime: 'nodejs' | 'go' | 'python' | 'rust' | 'bun';
        ports: number[];
        envVariables: Record<string, string>;
    }>;
    managedServices: Array<{
        name: string;
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
    files: Record<string, string>;
    hasPlaceholders: boolean;
    astValid: boolean;
}
export interface IZcpApiClient {
    importProject(spec: StackTopologySpec): Promise<{
        projectId: string;
        status: string;
    }>;
    getProjectStatus(projectId: string): Promise<{
        projectId: string;
        status: string;
        services: Array<{
            name: string;
            status: string;
            privateIp?: string;
        }>;
    }>;
    deployService(projectId: string, serviceName: string): Promise<{
        status: string;
        buildLog: string[];
    }>;
    deleteProject(projectId: string): Promise<boolean>;
}
export interface IStackSynthesizer {
    parsePrompt(prompt: string): StackTopologySpec;
    generateYaml(spec: StackTopologySpec): GeneratedConfigs;
}
export interface ICodeSynthesizer {
    synthesizeCode(spec: StackTopologySpec): GeneratedCodeArtifacts;
    validateZeroStubs(files: Record<string, string>): {
        isClean: boolean;
        stubsFound: string[];
    };
}
export interface IWebStudioServer {
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    broadcastLog(msg: LogStreamMessage): void;
    updateTopologyNode(state: TopologyNodeState): void;
    getLogs(service?: string): LogStreamMessage[];
    getTopology(): TopologyNodeState[];
    triggerDeploy(serviceId: string): Promise<{
        success: boolean;
        deployId: string;
    }>;
}
export interface IVerificationSuite {
    auditHttp(url: string): Promise<{
        status: number;
        ok: boolean;
    }>;
    auditDb(connectionString: string): Promise<{
        connected: boolean;
        writeOk: boolean;
    }>;
    auditCache(host: string, port: number): Promise<{
        pingOk: boolean;
    }>;
    auditQueueE2E(apiEndpoint: string): Promise<{
        passed: boolean;
        messageId?: string;
    }>;
    runFullAudit(url: string): Promise<HealthAuditResult>;
}
export declare class MockZcpApiClient implements IZcpApiClient {
    projects: Map<string, {
        spec: StackTopologySpec;
        status: string;
        services: Array<{
            name: string;
            status: string;
            privateIp?: string;
        }>;
    }>;
    shouldFailImport: boolean;
    shouldFailDeploy: boolean;
    callLogs: Array<{
        action: string;
        args: any;
    }>;
    importProject(spec: StackTopologySpec): Promise<{
        projectId: string;
        status: string;
    }>;
    getProjectStatus(projectId: string): Promise<{
        projectId: string;
        status: string;
        services: Array<{
            name: string;
            status: string;
            privateIp?: string;
        }>;
    }>;
    deployService(projectId: string, serviceName: string): Promise<{
        status: string;
        buildLog: string[];
    }>;
    deleteProject(projectId: string): Promise<boolean>;
}
export declare class MockStackSynthesizer implements IStackSynthesizer {
    parsePrompt(prompt: string): StackTopologySpec;
    generateYaml(spec: StackTopologySpec): GeneratedConfigs;
}
export declare class MockCodeSynthesizer implements ICodeSynthesizer {
    injectStub: boolean;
    synthesizeCode(spec: StackTopologySpec): GeneratedCodeArtifacts;
    validateZeroStubs(files: Record<string, string>): {
        isClean: boolean;
        stubsFound: string[];
    };
}
export declare class MockWebStudioServer implements IWebStudioServer {
    isRunning: boolean;
    logs: LogStreamMessage[];
    topology: Map<string, TopologyNodeState>;
    port: number;
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    broadcastLog(msg: LogStreamMessage): void;
    updateTopologyNode(state: TopologyNodeState): void;
    getLogs(service?: string): LogStreamMessage[];
    getTopology(): TopologyNodeState[];
    triggerDeploy(serviceId: string): Promise<{
        success: boolean;
        deployId: string;
    }>;
}
export declare class MockVerificationSuite implements IVerificationSuite {
    simulateHttpFailure: boolean;
    simulateDbFailure: boolean;
    simulateCacheFailure: boolean;
    simulateQueueFailure: boolean;
    auditHttp(url: string): Promise<{
        status: number;
        ok: boolean;
    }>;
    auditDb(connectionString: string): Promise<{
        connected: boolean;
        writeOk: boolean;
    }>;
    auditCache(host: string, port: number): Promise<{
        pingOk: boolean;
    }>;
    auditQueueE2E(apiEndpoint: string): Promise<{
        passed: boolean;
        messageId?: string;
    }>;
    runFullAudit(url: string): Promise<HealthAuditResult>;
}
export declare function createMockEnvironment(): {
    zcpClient: MockZcpApiClient;
    synthesizer: MockStackSynthesizer;
    codeGen: MockCodeSynthesizer;
    webStudio: MockWebStudioServer;
    verifier: MockVerificationSuite;
};
export declare function assertValidZeropsYaml(yamlContent: string): void;
export declare function assertValidProjectImportYaml(yamlContent: string): void;
//# sourceMappingURL=harness.d.ts.map