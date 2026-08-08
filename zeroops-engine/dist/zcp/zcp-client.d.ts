/**
 * src/zcp/zcp-client.ts
 * ZCP API & zcli orchestration bridge with dual execution modes (real REST API vs mock simulation).
 */
export type ZcpClientMode = 'real' | 'mock';
export interface ZcpClientConfig {
    mode?: ZcpClientMode;
    apiToken?: string;
    apiBaseUrl?: string;
    timeoutMs?: number;
    zcliPath?: string;
}
export interface ZcpServiceInfo {
    id: string;
    name: string;
    type: string;
    mode?: string;
    privateIp: string;
    ports: number[];
    status: 'BUILDING' | 'DEPLOYING' | 'RUNNING' | 'FAILED' | 'READY';
}
export interface ZcpProjectInfo {
    id: string;
    name: string;
    orgId: string;
    status: 'CREATING' | 'READY' | 'ERROR';
    createdAt: string;
    services: ZcpServiceInfo[];
}
export interface ZcpDeploymentResult {
    deploymentId: string;
    serviceName: string;
    status: 'SUCCESS' | 'FAILED';
    publicUrl?: string;
    privateIp: string;
    logs: string[];
    durationMs: number;
}
export interface PrivateTopologyMap {
    [serviceName: string]: {
        privateIp: string;
        port: number;
        connectionString?: string;
    };
}
export declare class ZcpClient {
    private mode;
    private apiToken;
    private apiBaseUrl;
    private timeoutMs;
    private zcliPath;
    private mockProjects;
    private mockDeployments;
    constructor(config?: ZcpClientConfig);
    getMode(): ZcpClientMode;
    getTimeoutMs(): number;
    getZcliPath(): string;
    /**
     * Imports a project definition from zerops-project-import.yml.
     */
    importProject(importYamlContent: string): Promise<ZcpProjectInfo>;
    /**
     * Deploys a specific service using zerops.yml config.
     */
    deployService(serviceName: string, zeropsYamlContent?: string): Promise<ZcpDeploymentResult>;
    /**
     * Deploys an entire project stack.
     */
    deployProject(_projectName: string, zeropsYamlContent?: string): Promise<ZcpDeploymentResult>;
    /**
     * Polls deployment status until complete, streaming logs via onLog callback.
     */
    pollDeploymentStatus(deploymentId: string, _timeoutMs?: number, onLog?: (msg: string) => void): Promise<ZcpDeploymentResult>;
    /**
     * Gets inter-service private IP topology mapping for project.
     */
    getPrivateTopology(projectId: string): Promise<PrivateTopologyMap>;
    private importProjectMock;
    private deployServiceMock;
    private importProjectReal;
    private deployServiceReal;
}
//# sourceMappingURL=zcp-client.d.ts.map