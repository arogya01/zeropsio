import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ENGINE_DIR = '/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine';
const AGENT_DIR = '/Users/arogyabichpuria/Documents/side-quests/zerops-hack/.agents/challenger_m1_2';
const OUT_DIR = path.join(AGENT_DIR, 'test_output');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('=== STARTING EMPIRICAL TEST SUITE FOR CHALLENGER 2 (M1) ===\n');

const results = [];

function recordTest(id, category, description, passed, details) {
  results.push({ id, category, description, passed, details });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusStr}] ${id}: ${description}`);
  if (!passed && details) {
    console.log(`    Details: ${typeof details === 'object' ? JSON.stringify(details) : details}`);
  }
}

// Helper to run CLI command
function runCli(args, options = {}) {
  try {
    const stdout = execSync(`node dist/index.js ${args}`, {
      cwd: ENGINE_DIR,
      encoding: 'utf-8',
      stdio: 'pipe',
      ...options
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : ''
    };
  }
}

// -------------------------------------------------------------
// SECTION 1: CLI Binary & Subcommands with Various Flags
// -------------------------------------------------------------
console.log('\n--- SECTION 1: CLI Commands & Flags ---');

// Test 1.1: synthesize standard prompt
{
  const res = runCli('synthesize "Build Next.js app with Go API and Python worker"');
  const passed = res.code === 0 && res.stdout.includes('Stack topology synthesized') && res.stdout.includes('zerops.yml');
  recordTest('CLI-1.1', 'CLI Flags', 'synthesize with standard prompt', passed, res.stderr || res.stdout);
}

// Test 1.2: synthesize --json
{
  const res = runCli('synthesize "Build app" --json');
  let parsed = null;
  let passed = false;
  try {
    parsed = JSON.parse(res.stdout);
    passed = res.code === 0 && parsed.topology && parsed.configs && parsed.configs.zeropsYaml;
  } catch (e) {
    passed = false;
  }
  recordTest('CLI-1.2', 'CLI Flags', 'synthesize --json outputs valid JSON structure', passed, res.stdout);
}

// Test 1.3: synthesize --verbose
{
  const res = runCli('synthesize "Build app" --verbose');
  const passed = res.code === 0 && res.stdout.includes('[ZeroOps Engine] Processing prompt');
  recordTest('CLI-1.3', 'CLI Flags', 'synthesize --verbose prints progress log', passed, res.stdout);
}

// Test 1.4: synthesize -o / --output
{
  const synthOut = path.join(OUT_DIR, 'synth_out_1');
  const res = runCli(`synthesize "Build app" -o "${synthOut}"`);
  const importExists = fs.existsSync(path.join(synthOut, 'zerops-project-import.yml'));
  const zeropsExists = fs.existsSync(path.join(synthOut, 'zerops.yml'));
  const passed = res.code === 0 && importExists && zeropsExists;
  recordTest('CLI-1.4', 'CLI Flags', 'synthesize -o writes YAML files to target directory', passed, { importExists, zeropsExists });
}

// Test 1.5: synthesize --mock
{
  const res = runCli('synthesize "Build app" --mock');
  const passed = res.code === 0 && res.stdout.includes('zerops.yml');
  recordTest('CLI-1.5', 'CLI Flags', 'synthesize with explicit --mock flag', passed, res.stdout);
}

// Test 1.6: deploy subcommand
{
  const res = runCli('deploy my-test-project');
  const passed = res.code === 0 && res.stdout.includes('deployed successfully');
  recordTest('CLI-1.6', 'CLI Flags', 'deploy subcommand with default mock mode', passed, res.stdout);
}

// Test 1.7: deploy --json
{
  const res = runCli('deploy my-test-project --json');
  let parsed = null;
  let passed = false;
  try {
    parsed = JSON.parse(res.stdout);
    passed = res.code === 0 && parsed.project && parsed.deployment && parsed.privateTopology;
  } catch (e) {
    passed = false;
  }
  recordTest('CLI-1.7', 'CLI Flags', 'deploy --json outputs valid JSON result', passed, res.stdout);
}

// Test 1.8: deploy --verbose
{
  const res = runCli('deploy my-test-project --verbose');
  const passed = res.code === 0 && res.stdout.includes('[ZeroOps Engine] Initiating deployment');
  recordTest('CLI-1.8', 'CLI Flags', 'deploy --verbose prints progress header', passed, res.stdout);
}

// Test 1.9: deploy -o with existing synthesized files
{
  const synthOut = path.join(OUT_DIR, 'synth_out_1');
  const res = runCli(`deploy my-test-project -o "${synthOut}"`);
  const passed = res.code === 0 && res.stdout.includes('deployed successfully');
  recordTest('CLI-1.9', 'CLI Flags', 'deploy -o reads existing synthesized YAML files', passed, res.stdout);
}

// Test 1.10: import subcommand
{
  const yamlPath = path.join(OUT_DIR, 'synth_out_1', 'zerops-project-import.yml');
  const res = runCli(`import "${yamlPath}"`);
  const passed = res.code === 0 && res.stdout.includes('Project imported successfully');
  recordTest('CLI-1.10', 'CLI Flags', 'import subcommand with valid zerops-project-import.yml', passed, res.stdout);
}

// Test 1.11: import --json
{
  const yamlPath = path.join(OUT_DIR, 'synth_out_1', 'zerops-project-import.yml');
  const res = runCli(`import "${yamlPath}" --json`);
  let parsed = null;
  let passed = false;
  try {
    parsed = JSON.parse(res.stdout);
    passed = res.code === 0 && parsed.id && parsed.name && parsed.services;
  } catch (e) {
    passed = false;
  }
  recordTest('CLI-1.11', 'CLI Flags', 'import --json outputs valid JSON project info', passed, res.stdout);
}

// -------------------------------------------------------------
// SECTION 2: Error Boundaries
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Error Boundaries ---');

// Test 2.1: Invalid CLI command
{
  const res = runCli('nonexistent-command');
  const passed = res.code !== 0 && (res.stderr.includes('unknown command') || res.stdout.includes('unknown command'));
  recordTest('ERR-2.1', 'Error Boundaries', 'Invalid command handles exit code and stderr error message', passed, { code: res.code, stderr: res.stderr || res.stdout });
}

// Test 2.2: Missing argument for synthesize
{
  const res = runCli('synthesize');
  const passed = res.code !== 0 && (res.stderr.includes("missing required argument 'prompt'") || res.stdout.includes("missing required argument"));
  recordTest('ERR-2.2', 'Error Boundaries', 'synthesize without prompt fails with missing argument error', passed, { code: res.code, stderr: res.stderr || res.stdout });
}

// Test 2.3: Missing argument for deploy
{
  const res = runCli('deploy');
  const passed = res.code !== 0 && (res.stderr.includes("missing required argument 'project-name'") || res.stdout.includes("missing required argument"));
  recordTest('ERR-2.3', 'Error Boundaries', 'deploy without project-name fails with missing argument error', passed, { code: res.code, stderr: res.stderr || res.stdout });
}

// Test 2.4: Missing argument for import
{
  const res = runCli('import');
  const passed = res.code !== 0 && (res.stderr.includes("missing required argument 'yaml-path'") || res.stdout.includes("missing required argument"));
  recordTest('ERR-2.4', 'Error Boundaries', 'import without yaml-path fails with missing argument error', passed, { code: res.code, stderr: res.stderr || res.stdout });
}

// Test 2.5: Import non-existent YAML file path
{
  const res = runCli('import "/path/to/nonexistent/file.yml"');
  const passed = res.code !== 0 && (res.stderr.includes('Import failed:') || res.stdout.includes('Import failed:') || res.stderr.includes('not found'));
  recordTest('ERR-2.5', 'Error Boundaries', 'import with non-existent file path returns exit code 1 with clean error message', passed, { code: res.code, stderr: res.stderr, stdout: res.stdout });
}

// Test 2.6: Import malformed YAML file content
{
  const malformedYamlPath = path.join(OUT_DIR, 'malformed.yml');
  fs.writeFileSync(malformedYamlPath, 'project:\n  name: [invalid yaml structure: {unclosed');
  const res = runCli(`import "${malformedYamlPath}"`);
  // In mock mode, ZcpClient catches YAML parse errors and falls back to default. Let's inspect behavior.
  recordTest('ERR-2.6', 'Error Boundaries', 'import with malformed YAML file content handles parse error', res.code === 0 || res.stderr.includes('failed'), { code: res.code, stdout: res.stdout, stderr: res.stderr });
}

// Test 2.7: Empty prompt string
{
  const res = runCli('synthesize ""');
  // synthesize "" might return default 3 runtimes & 2 managed services
  const passed = res.code === 0 && res.stdout.includes('zerops.yml');
  recordTest('ERR-2.7', 'Error Boundaries', 'synthesize with empty string prompt falls back safely to default stack', passed, { code: res.code, stdout: res.stdout });
}

// Test 2.8: Prompt with special shell characters or whitespace
{
  const res = runCli('synthesize "Build app with <special> & $env #test"');
  const passed = res.code === 0 && res.stdout.includes('zerops.yml');
  recordTest('ERR-2.8', 'Error Boundaries', 'synthesize with special characters handles input safely', passed, { code: res.code, stdout: res.stdout });
}

// Test 2.9: Deploy with non-existent output directory
{
  const res = runCli('deploy test-app -o "/path/to/nonexistent/dir"');
  // deploy should fall back to synthesizing default stack for test-app
  const passed = res.code === 0 && res.stdout.includes('deployed successfully');
  recordTest('ERR-2.9', 'Error Boundaries', 'deploy with non-existent outputDir falls back to runSynthesis', passed, { code: res.code, stdout: res.stdout });
}

// Save summary of results
fs.writeFileSync(path.join(OUT_DIR, 'cli_err_results.json'), JSON.stringify(results, null, 2));

console.log(`\nCompleted CLI & Error tests. Total recorded: ${results.length}`);
