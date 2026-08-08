/**
 * src/synthesizer/yaml-generator.ts
 * Generates spec-compliant zerops-project-import.yml and zerops.yml from StackTopologySpec.
 */

import * as yamlModule from 'js-yaml';
const yaml: typeof import('js-yaml') = (yamlModule as any).default || yamlModule;
import {
  StackTopologySpec,
  GeneratedConfigs,
  SupportedRuntime,
  SupportedManagedService,
  ZeropsProjectImportSpec,
  ZeropsImportServiceItem,
  ZeropsYamlSpec,
  ZeropsServiceConfig
} from './types.js';

/**
 * Maps standard runtime identifier to Zerops version tag.
 */
export function getRuntimeVersionTag(runtime: SupportedRuntime): string {
  switch (runtime) {
    case 'nodejs':
      return 'nodejs@20';
    case 'go':
      return 'go@1.22';
    case 'python':
      return 'python@3.11';
    case 'rust':
      return 'rust@1.75';
    default:
      return 'nodejs@20';
  }
}

/**
 * Maps managed service type to Zerops version tag.
 */
export function getManagedServiceVersionTag(serviceType: SupportedManagedService): string {
  switch (serviceType) {
    case 'postgresql':
      return 'postgresql@16';
    case 'valkey':
      return 'valkey@7';
    default:
      return 'postgresql@16';
  }
}

/**
 * Generates valid zerops-project-import.yml content.
 */
export function generateProjectImportYaml(spec: StackTopologySpec): string {
  const services: ZeropsImportServiceItem[] = [];

  // 1. Managed DB & Cache Services
  for (const managed of spec.managedServices) {
    services.push({
      name: managed.name,
      type: getManagedServiceVersionTag(managed.type),
      mode: managed.mode
    });
  }

  // 2. Runtime Application Containers
  for (const runtime of spec.runtimes) {
    services.push({
      name: runtime.name,
      type: getRuntimeVersionTag(runtime.runtime),
      mode: 'NON_HA'
    });
  }

  const importObj: ZeropsProjectImportSpec = {
    project: {
      name: spec.projectName,
      services
    }
  };

  return yaml.dump(importObj, { lineWidth: -1, noRefs: true, indent: 2 });
}

/**
 * Generates valid zerops.yml content for runtime containers.
 */
export function generateZeropsYaml(spec: StackTopologySpec): string {
  const zeropsServices: ZeropsServiceConfig[] = [];

  for (const runtime of spec.runtimes) {
    const versionTag = getRuntimeVersionTag(runtime.runtime);
    const primaryPort = runtime.ports[0] || 8080;
    const isHttp = primaryPort === 3000 || primaryPort === 8080 || primaryPort === 8000;

    let buildCommands: string[] = [];
    if (runtime.buildCommands && runtime.buildCommands.length > 0) {
      buildCommands = runtime.buildCommands;
    } else {
      if (runtime.runtime === 'nodejs') buildCommands = ['npm ci', 'npm run build'];
      else if (runtime.runtime === 'go') buildCommands = [`go build -o bin/${runtime.name} ./cmd/${runtime.name}`];
      else if (runtime.runtime === 'python') buildCommands = ['pip install -r requirements.txt'];
      else if (runtime.runtime === 'rust') buildCommands = ['cargo build --release'];
    }

    let startCommand = runtime.runCommand;
    if (!startCommand) {
      if (runtime.runtime === 'nodejs') startCommand = 'npm start';
      else if (runtime.runtime === 'go') startCommand = `./bin/${runtime.name}`;
      else if (runtime.runtime === 'python') startCommand = 'python main.py';
      else if (runtime.runtime === 'rust') startCommand = `./target/release/${runtime.name}`;
      else startCommand = 'npm start';
    }

    const serviceConfig: ZeropsServiceConfig = {
      setup: runtime.name,
      build: {
        base: versionTag,
        os: 'ubuntu',
        buildCommands,
        deployFiles: ['.']
      },
      deploy: {
        readinessCheck: {
          httpGet: {
            path: runtime.readinessPath || (runtime.name === 'frontend' ? '/' : '/health'),
            port: primaryPort
          }
        }
      },
      run: {
        base: versionTag,
        os: 'ubuntu',
        ports: [
          {
            port: primaryPort,
            protocol: 'TCP',
            httpSupport: isHttp
          }
        ],
        start: startCommand,
        envVariables: runtime.envVariables || {}
      }
    };

    zeropsServices.push(serviceConfig);
  }

  const zeropsYamlObj: ZeropsYamlSpec = {
    zerops: zeropsServices
  };

  return yaml.dump(zeropsYamlObj, { lineWidth: -1, noRefs: true, indent: 2 });
}

/**
 * Main generator function returning both zerops-project-import.yml and zerops.yml.
 */
export function generateZeropsConfigs(spec: StackTopologySpec): GeneratedConfigs {
  return {
    zeropsProjectImportYaml: generateProjectImportYaml(spec),
    zeropsYaml: generateZeropsYaml(spec)
  };
}
