/**
 * src/index.ts
 * Main ZeroOps Engine CLI & Programmatic Library Entry Point.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import * as fs from 'fs';
import * as path from 'path';

import { synthesizeStack } from './synthesizer/stack-synthesizer.js';
import { injectPrivateNetEnv } from './synthesizer/private-net.js';
import { generateZeropsConfigs } from './synthesizer/yaml-generator.js';
import { ZcpClient } from './zcp/zcp-client.js';
import { createStudioServer } from './studio/server.js';

// --- Programmatic API Exports ---
export * from './synthesizer/types.js';
export { parsePromptToTopology, synthesizeStack } from './synthesizer/stack-synthesizer.js';
export { injectPrivateNetEnv, injectPrivateNetworkEnvs } from './synthesizer/private-net.js';
export {
  generateProjectImportYaml,
  generateZeropsYaml,
  generateZeropsConfigs,
  getRuntimeVersionTag,
  getManagedServiceVersionTag
} from './synthesizer/yaml-generator.js';
export { ZcpClient } from './zcp/zcp-client.js';
export type {
  ZcpClientMode,
  ZcpClientConfig,
  ZcpProjectInfo,
  ZcpServiceInfo,
  ZcpDeploymentResult,
  PrivateTopologyMap
} from './zcp/zcp-client.js';

// --- Code & Schema Synthesizer Exports (M2) ---
export * from './code-gen/index.js';

// --- Web Studio & WebSocket Log Streamer Exports (M3) ---
export { createStudioServer } from './studio/server.js';
export type { StudioServerOptions, StudioServerInstance } from './studio/server.js';
export { WsLogger } from './studio/ws-logger.js';
export type { LogStreamMessage, TopologyNodeState, WsLoggerOptions } from './studio/ws-logger.js';


// --- Programmatic Helper Functions ---

export async function runSynthesis(
  prompt: string,
  options: { outputDir?: string; mock?: boolean; projectName?: string } = {}
) {
  const rawTopology = synthesizeStack(prompt, { projectName: options.projectName });
  const enrichedTopology = injectPrivateNetEnv(rawTopology);
  const configs = generateZeropsConfigs(enrichedTopology);

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

export async function runDeployment(
  projectName: string,
  options: { outputDir?: string; mock?: boolean } = {}
) {
  const isMock = options.mock !== false;
  const client = new ZcpClient({ mode: isMock ? 'mock' : 'real' });

  let importYaml = '';
  let zeropsYaml = '';

  if (options.outputDir) {
    const importPath = path.join(options.outputDir, 'zerops-project-import.yml');
    const zeropsPath = path.join(options.outputDir, 'zerops.yml');
    if (fs.existsSync(importPath)) importYaml = fs.readFileSync(importPath, 'utf-8');
    if (fs.existsSync(zeropsPath)) zeropsYaml = fs.readFileSync(zeropsPath, 'utf-8');
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

export async function runImport(
  yamlPath: string,
  options: { mock?: boolean } = {}
) {
  const isMock = options.mock !== false;
  const client = new ZcpClient({ mode: isMock ? 'mock' : 'real' });

  const absolutePath = path.resolve(yamlPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Import YAML file not found at path: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const projectInfo = await client.importProject(content);
  return projectInfo;
}

// --- CLI Setup ---

const program = new Command();

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
  .action(async (promptStr: string, options: any) => {
    try {
      if (options.verbose) {
        console.log(pc.cyan(`[ZeroOps Engine] Processing prompt: "${promptStr}"`));
      }

      const result = await runSynthesis(promptStr, {
        outputDir: options.output,
        mock: options.mock
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(pc.green(`✔ Stack topology synthesized for project: ${result.topology.projectName}`));
        console.log(pc.bold('\n--- zerops-project-import.yml ---'));
        console.log(result.configs.zeropsProjectImportYaml);
        console.log(pc.bold('\n--- zerops.yml ---'));
        console.log(result.configs.zeropsYaml);

        if (options.output) {
          console.log(pc.cyan(`\n📁 YAML configuration files written to: ${path.resolve(options.output)}`));
        }
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Synthesis failed: ${err.message}`));
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
  .action(async (projectName: string, options: any) => {
    try {
      if (options.verbose) {
        console.log(pc.cyan(`[ZeroOps Engine] Initiating deployment for project: ${projectName}`));
      }

      const result = await runDeployment(projectName, {
        outputDir: options.output,
        mock: options.mock
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(pc.green(`✔ Project ${projectName} deployed successfully.`));
        console.log(pc.bold(`Public URL: `) + pc.cyan(result.deployment.publicUrl || 'N/A (Internal Services Only)'));
        console.log(pc.bold('\nPrivate IP Topology Map:'));
        console.log(JSON.stringify(result.privateTopology, null, 2));
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Deployment failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('import <yaml-path>')
  .description('Import project spec directly into Zerops')
  .option('--mock', 'Run import in mock mode', true)
  .option('--json', 'Output results formatted as JSON', false)
  .action(async (yamlPath: string, options: any) => {
    try {
      const projectInfo = await runImport(yamlPath, { mock: options.mock });
      if (options.json) {
        console.log(JSON.stringify(projectInfo, null, 2));
      } else {
        console.log(pc.green(`✔ Project imported successfully: ${projectInfo.name} (ID: ${projectInfo.id})`));
        console.log(pc.bold('Services:'));
        for (const s of projectInfo.services) {
          console.log(`  - ${s.name} (${s.type}) -> Private IP: ${s.privateIp}`);
        }
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Import failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('studio')
  .description('Launch ZeroOps Web Studio HTTP & WebSocket Log Streaming server')
  .option('-p, --port <number>', 'Port to run Web Studio server', '3000')
  .option('--host <host>', 'Host address to bind server', 'localhost')
  .action(async (options: any) => {
    try {
      const port = parseInt(options.port, 10) || 3000;
      const studio = createStudioServer({ port, host: options.host });
      const actualPort = await studio.listen(port, options.host);
      console.log(pc.green(`✔ ZeroOps Web Studio running at http://localhost:${actualPort}`));
      console.log(pc.cyan(`  WebSocket log streamer listening at ws://localhost:${actualPort}/ws/logs`));
    } catch (err: any) {
      console.error(pc.red(`❌ Failed to launch Web Studio server: ${err.message}`));
      process.exit(1);
    }
  });

// Execute CLI parser when executed directly
if (
  process.argv[1]?.endsWith('index.js') ||
  process.argv[1]?.endsWith('zeroops') ||
  process.argv[1]?.includes('dist/index')
) {
  program.parseAsync(process.argv);
}
