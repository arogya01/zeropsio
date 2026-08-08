"use strict";
/**
 * src/index.ts
 * Main ZeroOps Engine CLI & Programmatic Library Entry Point.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsLogger = exports.createStudioServer = exports.ZcpClient = exports.getManagedServiceVersionTag = exports.getRuntimeVersionTag = exports.generateZeropsConfigs = exports.generateZeropsYaml = exports.generateProjectImportYaml = exports.injectPrivateNetworkEnvs = exports.injectPrivateNetEnv = exports.synthesizeStack = exports.parsePromptToTopology = void 0;
exports.runSynthesis = runSynthesis;
exports.runDeployment = runDeployment;
exports.runImport = runImport;
const commander_1 = require("commander");
const picocolors_1 = __importDefault(require("picocolors"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const stack_synthesizer_js_1 = require("./synthesizer/stack-synthesizer.js");
const private_net_js_1 = require("./synthesizer/private-net.js");
const yaml_generator_js_1 = require("./synthesizer/yaml-generator.js");
const zcp_client_js_1 = require("./zcp/zcp-client.js");
const server_js_1 = require("./studio/server.js");
// --- Programmatic API Exports ---
__exportStar(require("./synthesizer/types.js"), exports);
var stack_synthesizer_js_2 = require("./synthesizer/stack-synthesizer.js");
Object.defineProperty(exports, "parsePromptToTopology", { enumerable: true, get: function () { return stack_synthesizer_js_2.parsePromptToTopology; } });
Object.defineProperty(exports, "synthesizeStack", { enumerable: true, get: function () { return stack_synthesizer_js_2.synthesizeStack; } });
var private_net_js_2 = require("./synthesizer/private-net.js");
Object.defineProperty(exports, "injectPrivateNetEnv", { enumerable: true, get: function () { return private_net_js_2.injectPrivateNetEnv; } });
Object.defineProperty(exports, "injectPrivateNetworkEnvs", { enumerable: true, get: function () { return private_net_js_2.injectPrivateNetworkEnvs; } });
var yaml_generator_js_2 = require("./synthesizer/yaml-generator.js");
Object.defineProperty(exports, "generateProjectImportYaml", { enumerable: true, get: function () { return yaml_generator_js_2.generateProjectImportYaml; } });
Object.defineProperty(exports, "generateZeropsYaml", { enumerable: true, get: function () { return yaml_generator_js_2.generateZeropsYaml; } });
Object.defineProperty(exports, "generateZeropsConfigs", { enumerable: true, get: function () { return yaml_generator_js_2.generateZeropsConfigs; } });
Object.defineProperty(exports, "getRuntimeVersionTag", { enumerable: true, get: function () { return yaml_generator_js_2.getRuntimeVersionTag; } });
Object.defineProperty(exports, "getManagedServiceVersionTag", { enumerable: true, get: function () { return yaml_generator_js_2.getManagedServiceVersionTag; } });
var zcp_client_js_2 = require("./zcp/zcp-client.js");
Object.defineProperty(exports, "ZcpClient", { enumerable: true, get: function () { return zcp_client_js_2.ZcpClient; } });
// --- Code & Schema Synthesizer Exports (M2) ---
__exportStar(require("./code-gen/index.js"), exports);
// --- Web Studio & WebSocket Log Streamer Exports (M3) ---
var server_js_2 = require("./studio/server.js");
Object.defineProperty(exports, "createStudioServer", { enumerable: true, get: function () { return server_js_2.createStudioServer; } });
var ws_logger_js_1 = require("./studio/ws-logger.js");
Object.defineProperty(exports, "WsLogger", { enumerable: true, get: function () { return ws_logger_js_1.WsLogger; } });
// --- Programmatic Helper Functions ---
async function runSynthesis(prompt, options = {}) {
    const rawTopology = (0, stack_synthesizer_js_1.synthesizeStack)(prompt, { projectName: options.projectName });
    const enrichedTopology = (0, private_net_js_1.injectPrivateNetEnv)(rawTopology);
    const configs = (0, yaml_generator_js_1.generateZeropsConfigs)(enrichedTopology);
    if (options.outputDir) {
        const targetDir = path.resolve(options.outputDir);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.writeFileSync(path.join(targetDir, 'zerops-project-import.yml'), configs.zeropsProjectImportYaml, 'utf-8');
        fs.writeFileSync(path.join(targetDir, 'zerops.yml'), configs.zeropsYaml, 'utf-8');
    }
    return {
        topology: enrichedTopology,
        configs
    };
}
async function runDeployment(projectName, options = {}) {
    const isMock = options.mock !== false;
    const client = new zcp_client_js_1.ZcpClient({ mode: isMock ? 'mock' : 'real' });
    let importYaml = '';
    let zeropsYaml = '';
    if (options.outputDir) {
        const importPath = path.join(options.outputDir, 'zerops-project-import.yml');
        const zeropsPath = path.join(options.outputDir, 'zerops.yml');
        if (fs.existsSync(importPath))
            importYaml = fs.readFileSync(importPath, 'utf-8');
        if (fs.existsSync(zeropsPath))
            zeropsYaml = fs.readFileSync(zeropsPath, 'utf-8');
    }
    if (!importYaml || !zeropsYaml) {
        const synthResult = await runSynthesis(`Project ${projectName} default stack`, { ...options, projectName });
        importYaml = synthResult.configs.zeropsProjectImportYaml;
        zeropsYaml = synthResult.configs.zeropsYaml;
    }
    const projectInfo = await client.importProject(importYaml);
    const deployResult = await client.deployProject(projectName, zeropsYaml);
    const topologyMap = await client.getPrivateTopology(projectInfo.id);
    return {
        project: projectInfo,
        deployment: deployResult,
        privateTopology: topologyMap
    };
}
async function runImport(yamlPath, options = {}) {
    const isMock = options.mock !== false;
    const client = new zcp_client_js_1.ZcpClient({ mode: isMock ? 'mock' : 'real' });
    const absolutePath = path.resolve(yamlPath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Import YAML file not found at path: ${absolutePath}`);
    }
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const projectInfo = await client.importProject(content);
    return projectInfo;
}
// --- CLI Setup ---
const program = new commander_1.Command();
program
    .name('zeroops')
    .description('ZeroOps Engine — Autonomous Cloud Factory & ZCP Synthesizer CLI')
    .version('1.0.0');
program
    .command('synthesize <prompt>')
    .description('Synthesize Zerops stack topology and YAML configuration from natural language prompt')
    .option('-o, --output <dir>', 'Directory to save zerops-project-import.yml and zerops.yml')
    .option('--mock', 'Run synthesis in mock mode', true)
    .option('--json', 'Output results formatted as JSON', false)
    .option('--verbose', 'Print verbose progress output', false)
    .action(async (promptStr, options) => {
    try {
        if (options.verbose) {
            console.log(picocolors_1.default.cyan(`[ZeroOps Engine] Processing prompt: "${promptStr}"`));
        }
        const result = await runSynthesis(promptStr, {
            outputDir: options.output,
            mock: options.mock
        });
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(picocolors_1.default.green(`✔ Stack topology synthesized for project: ${result.topology.projectName}`));
            console.log(picocolors_1.default.bold('\n--- zerops-project-import.yml ---'));
            console.log(result.configs.zeropsProjectImportYaml);
            console.log(picocolors_1.default.bold('\n--- zerops.yml ---'));
            console.log(result.configs.zeropsYaml);
            if (options.output) {
                console.log(picocolors_1.default.cyan(`\n📁 YAML configuration files written to: ${path.resolve(options.output)}`));
            }
        }
    }
    catch (err) {
        console.error(picocolors_1.default.red(`❌ Synthesis failed: ${err.message}`));
        process.exit(1);
    }
});
program
    .command('deploy <project-name>')
    .description('Deploy synthesized project stack to Zerops via ZCP API or mock bridge')
    .option('-o, --output <dir>', 'Directory containing zerops-project-import.yml and zerops.yml')
    .option('--mock', 'Run deployment in mock mode', true)
    .option('--json', 'Output results formatted as JSON', false)
    .option('--verbose', 'Print verbose progress output', false)
    .action(async (projectName, options) => {
    try {
        if (options.verbose) {
            console.log(picocolors_1.default.cyan(`[ZeroOps Engine] Initiating deployment for project: ${projectName}`));
        }
        const result = await runDeployment(projectName, {
            outputDir: options.output,
            mock: options.mock
        });
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(picocolors_1.default.green(`✔ Project ${projectName} deployed successfully.`));
            console.log(picocolors_1.default.bold(`Public URL: `) + picocolors_1.default.cyan(result.deployment.publicUrl || 'N/A (Internal Services Only)'));
            console.log(picocolors_1.default.bold('\nPrivate IP Topology Map:'));
            console.log(JSON.stringify(result.privateTopology, null, 2));
        }
    }
    catch (err) {
        console.error(picocolors_1.default.red(`❌ Deployment failed: ${err.message}`));
        process.exit(1);
    }
});
program
    .command('import <yaml-path>')
    .description('Import project spec directly into Zerops')
    .option('--mock', 'Run import in mock mode', true)
    .option('--json', 'Output results formatted as JSON', false)
    .action(async (yamlPath, options) => {
    try {
        const projectInfo = await runImport(yamlPath, { mock: options.mock });
        if (options.json) {
            console.log(JSON.stringify(projectInfo, null, 2));
        }
        else {
            console.log(picocolors_1.default.green(`✔ Project imported successfully: ${projectInfo.name} (ID: ${projectInfo.id})`));
            console.log(picocolors_1.default.bold('Services:'));
            for (const s of projectInfo.services) {
                console.log(`  - ${s.name} (${s.type}) -> Private IP: ${s.privateIp}`);
            }
        }
    }
    catch (err) {
        console.error(picocolors_1.default.red(`❌ Import failed: ${err.message}`));
        process.exit(1);
    }
});
program
    .command('studio')
    .description('Launch ZeroOps Web Studio HTTP & WebSocket Log Streaming server')
    .option('-p, --port <number>', 'Port to run Web Studio server', '3000')
    .option('--host <host>', 'Host address to bind server', 'localhost')
    .action(async (options) => {
    try {
        const port = parseInt(options.port, 10) || 3000;
        const studio = (0, server_js_1.createStudioServer)({ port, host: options.host });
        const actualPort = await studio.listen(port, options.host);
        console.log(picocolors_1.default.green(`✔ ZeroOps Web Studio running at http://localhost:${actualPort}`));
        console.log(picocolors_1.default.cyan(`  WebSocket log streamer listening at ws://localhost:${actualPort}/ws/logs`));
    }
    catch (err) {
        console.error(picocolors_1.default.red(`❌ Failed to launch Web Studio server: ${err.message}`));
        process.exit(1);
    }
});
// Execute CLI parser when executed directly
if (process.argv[1]?.endsWith('index.js') ||
    process.argv[1]?.endsWith('zeroops') ||
    process.argv[1]?.includes('dist/index')) {
    program.parseAsync(process.argv);
}
//# sourceMappingURL=index.js.map