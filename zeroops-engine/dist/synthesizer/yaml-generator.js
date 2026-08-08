"use strict";
/**
 * src/synthesizer/yaml-generator.ts
 * Generates spec-compliant zerops-project-import.yml and zerops.yml from StackTopologySpec.
 */
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
exports.getRuntimeVersionTag = getRuntimeVersionTag;
exports.getManagedServiceVersionTag = getManagedServiceVersionTag;
exports.generateProjectImportYaml = generateProjectImportYaml;
exports.generateZeropsYaml = generateZeropsYaml;
exports.generateZeropsConfigs = generateZeropsConfigs;
const yamlModule = __importStar(require("js-yaml"));
const yaml = yamlModule.default || yamlModule;
/**
 * Maps standard runtime identifier to Zerops version tag.
 */
function getRuntimeVersionTag(runtime) {
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
function getManagedServiceVersionTag(serviceType) {
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
function generateProjectImportYaml(spec) {
    const services = [];
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
    const importObj = {
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
function generateZeropsYaml(spec) {
    const zeropsServices = [];
    for (const runtime of spec.runtimes) {
        const versionTag = getRuntimeVersionTag(runtime.runtime);
        const primaryPort = runtime.ports[0] || 8080;
        const isHttp = primaryPort === 3000 || primaryPort === 8080 || primaryPort === 8000;
        let buildCommands = [];
        if (runtime.buildCommands && runtime.buildCommands.length > 0) {
            buildCommands = runtime.buildCommands;
        }
        else {
            if (runtime.runtime === 'nodejs')
                buildCommands = ['npm ci', 'npm run build'];
            else if (runtime.runtime === 'go')
                buildCommands = [`go build -o bin/${runtime.name} ./cmd/${runtime.name}`];
            else if (runtime.runtime === 'python')
                buildCommands = ['pip install -r requirements.txt'];
            else if (runtime.runtime === 'rust')
                buildCommands = ['cargo build --release'];
        }
        let startCommand = runtime.runCommand;
        if (!startCommand) {
            if (runtime.runtime === 'nodejs')
                startCommand = 'npm start';
            else if (runtime.runtime === 'go')
                startCommand = `./bin/${runtime.name}`;
            else if (runtime.runtime === 'python')
                startCommand = 'python main.py';
            else if (runtime.runtime === 'rust')
                startCommand = `./target/release/${runtime.name}`;
            else
                startCommand = 'npm start';
        }
        const serviceConfig = {
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
    const zeropsYamlObj = {
        zerops: zeropsServices
    };
    return yaml.dump(zeropsYamlObj, { lineWidth: -1, noRefs: true, indent: 2 });
}
/**
 * Main generator function returning both zerops-project-import.yml and zerops.yml.
 */
function generateZeropsConfigs(spec) {
    return {
        zeropsProjectImportYaml: generateProjectImportYaml(spec),
        zeropsYaml: generateZeropsYaml(spec)
    };
}
//# sourceMappingURL=yaml-generator.js.map