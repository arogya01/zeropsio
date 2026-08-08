/**
 * src/synthesizer/types.ts
 * Standard interface definitions for ZeroOps Stack Synthesizer.
 * Adheres strictly to PROJECT.md § Interface Contracts.
 */

export type SupportedRuntime = 'nodejs' | 'go' | 'python' | 'rust';
export type SupportedManagedService = 'postgresql' | 'valkey';
export type ServiceMode = 'HA' | 'SINGLE';

export interface RuntimeSpec {
  name: string; // e.g. 'frontend', 'api', 'worker'
  runtime: SupportedRuntime; // 'nodejs' | 'go' | 'python' | 'rust'
  ports: number[]; // e.g. [3000], [8080], [8000]
  envVariables: Record<string, string>;
  buildCommands?: string[];
  runCommand?: string;
  entryPoint?: string;
  readinessPath?: string;
}

export interface ManagedServiceSpec {
  name: string; // e.g. 'postgres', 'valkey'
  type: SupportedManagedService; // 'postgresql' | 'valkey'
  mode: ServiceMode; // 'HA' | 'SINGLE'
  user?: string;
  password?: string;
  dbName?: string;
  port?: number;
}

/**
 * Primary interface contract specified in PROJECT.md
 */
export interface StackTopologySpec {
  projectName: string;
  runtimes: RuntimeSpec[];
  managedServices: ManagedServiceSpec[];
}

/**
 * Output interface contract specified in PROJECT.md
 */
export interface GeneratedConfigs {
  zeropsProjectImportYaml: string;
  zeropsYaml: string;
}

/**
 * Zerops Project Import Schema Structures
 */
export interface ZeropsImportServiceItem {
  name: string;
  type: string; // e.g. 'nodejs@20', 'go@1.22', 'postgresql@16', 'valkey@7'
  mode?: ServiceMode | 'NON_HA';
}

export interface ZeropsProjectImportSpec {
  project: {
    name: string;
    services: ZeropsImportServiceItem[];
  };
}

/**
 * zerops.yml Schema Structures
 */
export interface ZeropsPortConfig {
  port: number;
  protocol?: 'TCP' | 'UDP';
  httpSupport?: boolean;
}

export interface ZeropsReadinessCheck {
  httpGet?: {
    path: string;
    port: number;
  };
}

export interface ZeropsServiceBuildConfig {
  base: string; // e.g. 'nodejs@20'
  os?: 'ubuntu' | 'alpine';
  prepareCommands?: string[];
  buildCommands?: string[];
  deployFiles?: string[];
  cache?: string[];
  addToRunPrepare?: string[];
  envVariables?: Record<string, string>;
}

export interface ZeropsServiceRunConfig {
  base: string;
  os?: 'ubuntu' | 'alpine';
  ports?: ZeropsPortConfig[];
  prepareCommands?: string[];
  initCommands?: string[];
  start?: string;
  startCommands?: string[];
  documentRoot?: string;
  envVariables?: Record<string, string>;
}

export interface ZeropsServiceConfig {
  setup: string; // Matches service name from import spec
  extends?: string;
  build?: ZeropsServiceBuildConfig;
  deploy?: {
    temporaryShutdown?: boolean;
    readinessCheck?: ZeropsReadinessCheck;
  };
  run: ZeropsServiceRunConfig;
}

export interface ZeropsYamlSpec {
  zerops: ZeropsServiceConfig[];
}
