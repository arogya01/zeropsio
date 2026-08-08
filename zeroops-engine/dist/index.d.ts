/**
 * src/index.ts
 * Main ZeroOps Engine CLI & Programmatic Library Entry Point.
 */
export * from './synthesizer/types.js';
export { parsePromptToTopology, synthesizeStack } from './synthesizer/stack-synthesizer.js';
export { injectPrivateNetEnv, injectPrivateNetworkEnvs } from './synthesizer/private-net.js';
export { generateProjectImportYaml, generateZeropsYaml, generateZeropsConfigs, getRuntimeVersionTag, getManagedServiceVersionTag } from './synthesizer/yaml-generator.js';
export { ZcpClient } from './zcp/zcp-client.js';
export type { ZcpClientMode, ZcpClientConfig, ZcpProjectInfo, ZcpServiceInfo, ZcpDeploymentResult, PrivateTopologyMap } from './zcp/zcp-client.js';
export * from './code-gen/index.js';
export { createStudioServer } from './studio/server.js';
export type { StudioServerOptions, StudioServerInstance } from './studio/server.js';
export { WsLogger } from './studio/ws-logger.js';
export type { LogStreamMessage, TopologyNodeState, WsLoggerOptions } from './studio/ws-logger.js';
export declare function runSynthesis(prompt: string, options?: {
    outputDir?: string;
    mock?: boolean;
    projectName?: string;
}): Promise<{
    topology: import("./synthesizer/types.js").StackTopologySpec;
    configs: import("./synthesizer/types.js").GeneratedConfigs;
}>;
export declare function runDeployment(projectName: string, options?: {
    outputDir?: string;
    mock?: boolean;
}): Promise<{
    project: import("./zcp/zcp-client.js").ZcpProjectInfo;
    deployment: import("./zcp/zcp-client.js").ZcpDeploymentResult;
    privateTopology: import("./zcp/zcp-client.js").PrivateTopologyMap;
}>;
export declare function runImport(yamlPath: string, options?: {
    mock?: boolean;
}): Promise<import("./zcp/zcp-client.js").ZcpProjectInfo>;
//# sourceMappingURL=index.d.ts.map