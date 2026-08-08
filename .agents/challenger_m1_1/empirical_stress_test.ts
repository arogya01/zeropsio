/**
 * Empirical Stress Test Suite for zeroops-engine (Milestone M1)
 * Location: /Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/challenger_m1_1/empirical_stress_test.ts
 */

import yaml from '../../zeroops-engine/node_modules/js-yaml/index.js';
import {
  synthesizeStack,
  parsePromptToTopology,
  injectPrivateNetEnv,
  generateZeropsConfigs,
  generateProjectImportYaml,
  generateZeropsYaml,
  ZcpClient,
  runSynthesis,
  runDeployment
} from '../../zeroops-engine/src/index.js';

interface TestResult {
  category: string;
  testName: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function recordResult(category: string, testName: string, passed: boolean, durationMs: number, error?: string, details?: any) {
  results.push({ category, testName, passed, durationMs, error, details });
  const icon = passed ? '✔' : '❌';
  console.log(`[${category}] ${icon} ${testName} (${durationMs.toFixed(2)}ms)${error ? ` - ${error}` : ''}`);
}

async function runPromptSynthesisStressTests() {
  console.log('\n==================================================');
  console.log('1. STRESS TESTING NATURAL LANGUAGE PROMPT SYNTHESIS');
  console.log('==================================================');

  const testPrompts = [
    { name: 'Empty string', prompt: '' },
    { name: 'Whitespace string', prompt: '   \n\t  ' },
    { name: 'Single keyword - node', prompt: 'node' },
    { name: 'Single keyword - postgres', prompt: 'postgres' },
    { name: 'Single keyword - python', prompt: 'python' },
    { name: 'Single keyword - valkey', prompt: 'valkey' },
    { name: 'Single keyword - rust', prompt: 'rust' },
    { name: 'Complex prompt with all runtimes & services', prompt: 'Create an e-commerce platform named shop-master with Next.js frontend, Go backend API gateway, Python queue worker, Rust microservice, PostgreSQL HA database, and Valkey cache' },
    { name: 'Conflicting runtime & HA requirements', prompt: 'Build app in single non-ha dev ha postgresql postgres valkey redis minimal mode' },
    { name: 'Special characters & SQL injection payload', prompt: 'Build app; DROP TABLE users; -- <script>alert("xss")</script> 🚀 project_name=$foo!@#$%^&*()' },
    { name: 'Unicode & foreign script prompt', prompt: '创建 Next.js 和 Python 应用程序并在 Zerops 上部署 聊天机器人' },
    { name: 'Very long prompt (10,000+ chars)', prompt: 'Create fullstack app with node and python ' + 'and postgres valkey '.repeat(1000) },
    { name: 'Custom project slug option override', prompt: 'Simple prompt', options: { projectName: 'Custom-Slug-123!!!' } }
  ];

  for (const item of testPrompts) {
    const start = performance.now();
    try {
      const topology = synthesizeStack(item.prompt, item.options);
      const enriched = injectPrivateNetEnv(topology);
      const end = performance.now();

      // Assertions
      if (!topology.projectName || typeof topology.projectName !== 'string' || topology.projectName.trim().length === 0) {
        throw new Error('Project name is empty or invalid');
      }

      if (!Array.isArray(topology.runtimes) || topology.runtimes.length < 3) {
        throw new Error(`Expected at least 3 runtimes, got ${topology.runtimes.length}`);
      }

      if (!Array.isArray(topology.managedServices) || topology.managedServices.length < 2) {
        throw new Error(`Expected at least 2 managed services, got ${topology.managedServices.length}`);
      }

      const hasPostgres = topology.managedServices.some(s => s.type === 'postgresql');
      const hasValkey = topology.managedServices.some(s => s.type === 'valkey');
      if (!hasPostgres || !hasValkey) {
        throw new Error(`Missing mandatory database service: hasPostgres=${hasPostgres}, hasValkey=${hasValkey}`);
      }

      // Verify Private Network Injection in enriched topology
      for (const rt of enriched.runtimes) {
        if (!rt.envVariables.DB_HOST || !rt.envVariables.VALKEY_HOST || !rt.envVariables.DATABASE_URL || !rt.envVariables.REDIS_URL) {
          throw new Error(`Missing private network env variables in runtime ${rt.name}`);
        }
      }

      recordResult('Synthesis Stress', item.name, true, end - start, undefined, {
        projectName: topology.projectName,
        runtimeCount: topology.runtimes.length,
        serviceCount: topology.managedServices.length
      });
    } catch (err: any) {
      const end = performance.now();
      recordResult('Synthesis Stress', item.name, false, end - start, err.message);
    }
  }
}

async function runYamlValidationTests() {
  console.log('\n==================================================');
  console.log('2. VALIDATING GENERATED YAML SCHEMA & SYNTAX (js-yaml)');
  console.log('==================================================');

  const testCases = [
    { name: 'Default Stack Yaml Synthesis', prompt: 'Default full stack app' },
    { name: 'Rust Microservice Stack Yaml', prompt: 'Next.js frontend with Rust microservice and Postgres' },
    { name: 'Single Mode Stack Yaml', prompt: 'Dev stack in single mode' }
  ];

  for (const item of testCases) {
    const start = performance.now();
    try {
      const synth = await runSynthesis(item.prompt);
      const importYamlStr = synth.configs.zeropsProjectImportYaml;
      const zeropsYamlStr = synth.configs.zeropsYaml;

      // 1. js-yaml parse validation
      const parsedImport: any = yaml.load(importYamlStr);
      const parsedZerops: any = yaml.load(zeropsYamlStr);

      if (!parsedImport || typeof parsedImport !== 'object') {
        throw new Error('zerops-project-import.yml did not parse to object');
      }
      if (!parsedZerops || typeof parsedZerops !== 'object') {
        throw new Error('zerops.yml did not parse to object');
      }

      // 2. Required top-level key assertions
      if (!parsedImport.project) {
        throw new Error('Missing top-level key `project` in project-import.yml');
      }
      if (!parsedImport.project.name || typeof parsedImport.project.name !== 'string') {
        throw new Error('Missing or invalid `project.name` in project-import.yml');
      }
      if (!Array.isArray(parsedImport.project.services) || parsedImport.project.services.length < 5) {
        throw new Error(`Expected >= 5 services in project-import.yml, found ${parsedImport.project.services?.length}`);
      }

      if (!parsedZerops.zerops || !Array.isArray(parsedZerops.zerops)) {
        throw new Error('Missing top-level key `zerops` array in zerops.yml');
      }

      // 3. Check service runtime ports and configs in zerops.yml
      for (const serviceConfig of parsedZerops.zerops) {
        if (!serviceConfig.setup || typeof serviceConfig.setup !== 'string') {
          throw new Error('zerops.yml item missing `setup` field');
        }
        if (!serviceConfig.build || !serviceConfig.build.base || !serviceConfig.build.buildCommands) {
          throw new Error(`zerops.yml service ${serviceConfig.setup} missing valid build spec`);
        }
        if (!serviceConfig.run || !Array.isArray(serviceConfig.run.ports) || serviceConfig.run.ports.length === 0) {
          throw new Error(`zerops.yml service ${serviceConfig.setup} missing runtime ports`);
        }
        const portObj = serviceConfig.run.ports[0];
        if (typeof portObj.port !== 'number' || portObj.port <= 0 || portObj.port > 65535) {
          throw new Error(`Invalid port number ${portObj.port} in service ${serviceConfig.setup}`);
        }
        if (portObj.protocol !== 'TCP') {
          throw new Error(`Invalid protocol ${portObj.protocol} in service ${serviceConfig.setup}`);
        }

        // Verify private env vars inside zerops.yml run section
        const envs = serviceConfig.run.envVariables;
        if (!envs || envs.DB_HOST !== 'postgres' || envs.VALKEY_HOST !== 'valkey') {
          throw new Error(`zerops.yml service ${serviceConfig.setup} missing DB_HOST or VALKEY_HOST env vars`);
        }
      }

      const end = performance.now();
      recordResult('YAML Validation', item.name, true, end - start, undefined, {
        projectName: parsedImport.project.name,
        importServiceCount: parsedImport.project.services.length,
        zeropsServiceCount: parsedZerops.zerops.length
      });
    } catch (err: any) {
      const end = performance.now();
      recordResult('YAML Validation', item.name, false, end - start, err.message);
    }
  }
}

async function runZcpClientMockDeploymentStressTests() {
  console.log('\n==================================================');
  console.log('3. TESTING ZCP CLIENT MOCK DEPLOYMENT & RAPID POLLING');
  console.log('==================================================');

  // Test 3.1: Client Mode Auto-Detection & Fallback
  {
    const start = performance.now();
    try {
      const client = new ZcpClient({ mode: 'real' }); // no ZEROPS_TOKEN env set -> should fallback to mock
      if (client.getMode() !== 'mock') {
        throw new Error(`Expected fallback to mode 'mock', got '${client.getMode()}'`);
      }
      const end = performance.now();
      recordResult('ZCP Client', 'Real mode fallback without token', true, end - start);
    } catch (err: any) {
      const end = performance.now();
      recordResult('ZCP Client', 'Real mode fallback without token', false, end - start, err.message);
    }
  }

  // Test 3.2: Project Import & Topology Mapping
  {
    const start = performance.now();
    try {
      const client = new ZcpClient({ mode: 'mock' });
      const synth = await runSynthesis('Full E-Commerce Stack');
      const proj = await client.importProject(synth.configs.zeropsProjectImportYaml);

      if (!proj.id || !proj.name || proj.services.length < 5) {
        throw new Error(`Project import returned invalid structure: ${JSON.stringify(proj)}`);
      }

      const topologyMap = await client.getPrivateTopology(proj.id);
      if (!topologyMap.postgres || topologyMap.postgres.port !== 5432) {
        throw new Error('Topology map missing postgres port 5432');
      }
      if (!topologyMap.valkey || topologyMap.valkey.port !== 6379) {
        throw new Error('Topology map missing valkey port 6379');
      }
      if (!topologyMap.api || !topologyMap.frontend || !topologyMap.worker) {
        throw new Error('Topology map missing runtime services');
      }

      const end = performance.now();
      recordResult('ZCP Client', 'Project import and private topology mapping', true, end - start);
    } catch (err: any) {
      const end = performance.now();
      recordResult('ZCP Client', 'Project import and private topology mapping', false, end - start, err.message);
    }
  }

  // Test 3.3: Rapid Concurrent Polling Stress Test (100 parallel deployments)
  {
    const start = performance.now();
    try {
      const client = new ZcpClient({ mode: 'mock' });
      const deployCount = 100;
      const deployPromises: Promise<any>[] = [];

      for (let i = 0; i < deployCount; i++) {
        const p = (async () => {
          const deployRes = await client.deployService('frontend');
          let loggedLines = 0;
          const statusRes = await client.pollDeploymentStatus(deployRes.deploymentId, 5000, (log) => {
            if (log) loggedLines++;
          });

          if (statusRes.status !== 'SUCCESS') {
            throw new Error(`Deployment status for ${deployRes.deploymentId} was not SUCCESS`);
          }
          if (loggedLines === 0) {
            throw new Error(`No log lines received for ${deployRes.deploymentId}`);
          }
          return statusRes;
        })();
        deployPromises.push(p);
      }

      const allResults = await Promise.all(deployPromises);
      if (allResults.length !== deployCount) {
        throw new Error(`Expected ${deployCount} completed deployments, got ${allResults.length}`);
      }

      const end = performance.now();
      recordResult('ZCP Client', `Rapid polling stress test (${deployCount} concurrent deployments)`, true, end - start);
    } catch (err: any) {
      const end = performance.now();
      recordResult('ZCP Client', 'Rapid polling stress test', false, end - start, err.message);
    }
  }

  // Test 3.4: Rapid High-Throughput Single Deployment Log Polling Loop
  {
    const start = performance.now();
    try {
      const client = new ZcpClient({ mode: 'mock' });
      const deployRes = await client.deployService('api');
      const iterations = 25;
      let totalLogsReceived = 0;

      for (let i = 0; i < iterations; i++) {
        await client.pollDeploymentStatus(deployRes.deploymentId, 1000, (_log) => {
          totalLogsReceived++;
        });
      }

      if (totalLogsReceived < iterations) {
        throw new Error(`Expected at least ${iterations} logs received, got ${totalLogsReceived}`);
      }

      const end = performance.now();
      recordResult('ZCP Client', `Rapid high-throughput polling loop (${iterations} cycles)`, true, end - start);
    } catch (err: any) {
      const end = performance.now();
      recordResult('ZCP Client', 'Rapid high-throughput polling loop', false, end - start, err.message);
    }
  }
}

async function main() {
  console.log('🚀 STARTING EMPIRICAL CHALLENGER STRESS TEST SUITE 🚀\n');
  const totalStart = performance.now();

  await runPromptSynthesisStressTests();
  await runYamlValidationTests();
  await runZcpClientMockDeploymentStressTests();

  const totalEnd = performance.now();

  console.log('\n==================================================');
  console.log('SUMMARY & VERDICT');
  console.log('==================================================');

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total tests executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total execution time: ${(totalEnd - totalStart).toFixed(2)}ms`);

  if (failed === 0) {
    console.log('\nFINAL VERDICT: APPROVE');
    process.exit(0);
  } else {
    console.log('\nFINAL VERDICT: REQUEST_CHANGES');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled failure in stress test suite:', err);
  process.exit(1);
});
