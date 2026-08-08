import yaml from '../../zeroops-engine/node_modules/js-yaml/index.js';
import { synthesizeStack, injectPrivateNetEnv, generateZeropsConfigs } from '../../zeroops-engine/dist/index.js';

console.log('=== TASK 3: INTER-SERVICE ENV VAR INJECTION CONSISTENCY TEST ===\n');

// 1. Synthesize a stack with all 4 runtimes: Node (frontend), Go (api), Python (worker), Rust (rust-service)
const prompt = 'Build Next.js frontend with Go API, Python queue worker, and Rust microservice, backed by Postgres HA and Valkey Cache';
const rawSpec = synthesizeStack(prompt);
const enrichedSpec = injectPrivateNetEnv(rawSpec);
const configs = generateZeropsConfigs(enrichedSpec);

console.log(`Synthesized project: ${enrichedSpec.projectName}`);
console.log(`Runtimes count: ${enrichedSpec.runtimes.length}`);
for (const r of enrichedSpec.runtimes) {
  console.log(`  - Runtime Name: ${r.name}, Language: ${r.runtime}, Port: ${r.ports.join(',')}`);
}

const runtimes = enrichedSpec.runtimes;
const runtimeTypes = runtimes.map(r => r.runtime);
console.log('\nRuntime languages present:', runtimeTypes.join(', '));

// Expected standard inter-service env vars
const expectedEnvKeys = [
  'PORT',
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DATABASE_URL',
  'VALKEY_HOST',
  'VALKEY_PORT',
  'REDIS_URL',
  'API_HOST',
  'API_PORT',
  'API_URL'
];

let allPassed = true;

// Check 3.1: Direct in-memory topology check across all 4 runtimes
console.log('\n--- Test 3.1: In-Memory Topology Spec Env Var Inspection ---');
const envMapByRuntime = {};

for (const runtime of runtimes) {
  const env = runtime.envVariables || {};
  envMapByRuntime[runtime.runtime] = env;

  console.log(`\nChecking runtime [${runtime.name}] (${runtime.runtime}):`);
  const missingKeys = [];
  for (const key of expectedEnvKeys) {
    if (!(key in env)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    console.error(`  ❌ Missing env keys for ${runtime.runtime}:`, missingKeys);
    allPassed = false;
  } else {
    console.log(`  ` + `✅ All 14 expected inter-service env keys present.`);
    console.log(`     DB_HOST=${env.DB_HOST}, VALKEY_HOST=${env.VALKEY_HOST}, API_HOST=${env.API_HOST}`);
    console.log(`     DATABASE_URL=${env.DATABASE_URL}`);
    console.log(`     REDIS_URL=${env.REDIS_URL}`);
    console.log(`     API_URL=${env.API_URL}`);
  }
}

// Check 3.2: Cross-runtime consistency
console.log('\n--- Test 3.2: Inter-Service Values Cross-Consistency ---');
const nodeEnv = envMapByRuntime['nodejs'];
const goEnv = envMapByRuntime['go'];
const pythonEnv = envMapByRuntime['python'];
const rustEnv = envMapByRuntime['rust'];

const compareKeys = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DATABASE_URL', 'VALKEY_HOST', 'VALKEY_PORT', 'REDIS_URL', 'API_HOST', 'API_PORT', 'API_URL'];

for (const key of compareKeys) {
  const valNode = nodeEnv[key];
  const valGo = goEnv[key];
  const valPy = pythonEnv[key];
  const valRust = rustEnv ? rustEnv[key] : valNode;

  if (valNode !== valGo || valNode !== valPy || valNode !== valRust) {
    console.error(`❌ Inconsistency detected for ${key}:`);
    console.error(`   Node: ${valNode}, Go: ${valGo}, Python: ${valPy}, Rust: ${valRust}`);
    allPassed = false;
  } else {
    console.log(`  ✅ ${key} is consistent across all containers: "${valNode}"`);
  }
}

// Check 3.3: Parsed zerops.yml output verification
console.log('\n--- Test 3.3: Serialized zerops.yml Inspection ---');
const parsedZeropsYaml = yaml.load(configs.zeropsYaml);
const zeropsServices = parsedZeropsYaml.zerops || [];

console.log(`zerops.yml service configs generated: ${zeropsServices.length}`);

for (const s of zeropsServices) {
  const sName = s.setup;
  const envVars = s.run?.envVariables || {};
  console.log(`\nService in zerops.yml [${sName}] (base: ${s.run?.base}):`);
  console.log(`  Env count: ${Object.keys(envVars).length}`);

  for (const key of compareKeys) {
    if (!envVars[key]) {
      console.error(`  ❌ Missing env variable ${key} in zerops.yml for service ${sName}`);
      allPassed = false;
    }
  }
}

// Check 3.4: Custom database/valkey names and custom ports edge case
console.log('\n--- Test 3.4: Custom DB / Cache Service Names & Ports Edge Case ---');
const customSpec = {
  projectName: 'custom-app',
  managedServices: [
    { name: 'db-cluster', type: 'postgresql', mode: 'HA', user: 'myuser', password: 'mypassword', dbName: 'mydb', port: 5433 },
    { name: 'cache-cluster', type: 'valkey', mode: 'HA', port: 6380 }
  ],
  runtimes: [
    { name: 'fe', runtime: 'nodejs', ports: [3000], envVariables: {} },
    { name: 'api-service', runtime: 'go', ports: [9000], envVariables: {} },
    { name: 'py-worker', runtime: 'python', ports: [8000], envVariables: {} },
    { name: 'rs-micro', runtime: 'rust', ports: [8090], envVariables: {} }
  ]
};

const wiredCustom = injectPrivateNetEnv(customSpec);
for (const r of wiredCustom.runtimes) {
  const env = r.envVariables;
  if (env.DB_HOST !== 'db-cluster' || env.DB_PORT !== '5433' || env.DB_USER !== 'myuser' || env.DB_NAME !== 'mydb') {
    console.error(`❌ Custom DB env injection failed for ${r.name}: DB_HOST=${env.DB_HOST}, DB_PORT=${env.DB_PORT}`);
    allPassed = false;
  }
  if (env.VALKEY_HOST !== 'cache-cluster' || env.VALKEY_PORT !== '6380') {
    console.error(`❌ Custom Valkey env injection failed for ${r.name}: VALKEY_HOST=${env.VALKEY_HOST}`);
    allPassed = false;
  }
  if (env.API_HOST !== 'api-service' || env.API_PORT !== '9000' || env.API_URL !== 'http://api-service:9000') {
    console.error(`❌ Custom API env injection failed for ${r.name}: API_HOST=${env.API_HOST}, API_PORT=${env.API_PORT}`);
    allPassed = false;
  }
}
if (allPassed) {
  console.log('✅ Custom DB/Cache/API service names and ports correctly injected into Node, Go, Python, and Rust runtimes.');
}

// Check 3.5: NODE_ENV injection nuance check
console.log('\n--- Test 3.5: NODE_ENV Nuance Inspection ---');
console.log(`Node NODE_ENV: ${nodeEnv.NODE_ENV}`);
console.log(`Go NODE_ENV: ${goEnv.NODE_ENV}`);
console.log(`Python NODE_ENV: ${pythonEnv.NODE_ENV}`);
console.log(`Rust NODE_ENV: ${rustEnv ? rustEnv.NODE_ENV : 'N/A'}`);
console.log('Note: NODE_ENV is injected globally across all runtimes by default for production environment tagging.');

if (allPassed) {
  console.log('\n🎉 ALL INTER-SERVICE ENV VAR INJECTION TESTS PASSED VERIFICATION!');
} else {
  console.error('\n❌ SOME INTER-SERVICE ENV VAR INJECTION TESTS FAILED!');
  process.exit(1);
}
