const assert = require('assert');
const childProcess = require('child_process');
const ZCPClient = require('../../zeroops-engine/src/server/zcp-client');

async function testZCPClient() {
  console.log('--- EMPIRICAL TEST: ZCPClient ---');

  // Test 1: Instantiation with custom token or default env
  const client = new ZCPClient('test-token-123');
  assert.strictEqual(client.apiToken, 'test-token-123');

  // Test 2: Dynamic YAML parsing with custom services
  const customYaml = `
project:
  name: mycustomapp
services:
  - hostname: customui
    type: nextjs@14
  - hostname: customapi
    type: rust@1.75
  - hostname: customdb
    type: postgresql@15
`;

  // We spy/mock childProcess.spawn to capture stdin and arguments
  let spawnedCmd = null;
  let spawnedArgs = null;
  let stdinContent = '';
  let spawnedEnv = null;

  const originalSpawn = childProcess.spawn;
  childProcess.spawn = (cmd, args, options) => {
    spawnedCmd = cmd;
    spawnedArgs = args;
    spawnedEnv = options.env;

    const mockStdin = {
      write: (data) => { stdinContent += data.toString(); },
      end: () => {}
    };

    const mockStdout = {
      on: (event, handler) => {
        if (event === 'data') {
          handler(Buffer.from('Importing project mycustomapp...\nSuccessfully imported.'));
        }
      }
    };

    const mockStderr = {
      on: (event, handler) => {}
    };

    const listeners = {};
    const mockProc = {
      stdin: mockStdin,
      stdout: mockStdout,
      stderr: mockStderr,
      on: (event, handler) => {
        listeners[event] = handler;
        if (event === 'close') {
          setTimeout(() => handler(0), 10);
        }
      }
    };
    return mockProc;
  };

  try {
    const logs = [];
    const result = await client.provisionProject('mycustomapp', customYaml, (msg) => logs.push(msg));

    assert.strictEqual(spawnedCmd, 'zcli');
    assert.deepStrictEqual(spawnedArgs, ['project', 'project-import', '-']);
    assert.strictEqual(spawnedEnv.ZEROPS_TOKEN, 'test-token-123');
    assert.strictEqual(stdinContent, customYaml);

    assert.strictEqual(result.status, 'active');
    assert.strictEqual(result.projectName, 'mycustomapp');
    assert.strictEqual(result.liveUrl, 'https://mycustomapp.zerops.app');

    // Check parsed services array
    assert.strictEqual(result.services.length, 3);
    assert.strictEqual(result.services[0].id, 'customui');
    assert.strictEqual(result.services[0].port, 3000);
    assert.strictEqual(result.services[1].id, 'customapi');
    assert.strictEqual(result.services[1].port, 8080); // rust/api defaults to 8080
    assert.strictEqual(result.services[2].id, 'customdb');
    assert.strictEqual(result.services[2].port, 5432);

    console.log('✓ ZCPClient YAML parsing & process spawning test PASSED');
  } finally {
    childProcess.spawn = originalSpawn;
  }

  // Test 3: Standard fallback when zeropsYmlContent is null/empty
  childProcess.spawn = (cmd, args, options) => {
    return {
      stdin: { write: () => {}, end: () => {} },
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      on: (event, handler) => {
        if (event === 'close') setTimeout(() => handler(0), 10);
      }
    };
  };

  try {
    const resultDefault = await client.provisionProject('testapp', null);
    assert.strictEqual(resultDefault.services.length, 5);
    assert.strictEqual(resultDefault.services[0].id, 'webapp');
    assert.strictEqual(resultDefault.services[3].id, 'dbpostgres');
    assert.strictEqual(resultDefault.services[4].id, 'cachevalkey');
    console.log('✓ ZCPClient default spec YAML parsing test PASSED');
  } finally {
    childProcess.spawn = originalSpawn;
  }

  // Test 4: Handling process error event
  childProcess.spawn = (cmd, args, options) => {
    return {
      stdin: { write: () => {}, end: () => {} },
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      on: (event, handler) => {
        if (event === 'error') setTimeout(() => handler(new Error('ENOENT zcli not found')), 10);
      }
    };
  };

  try {
    const resultErr = await client.provisionProject('errtest', null);
    assert.strictEqual(resultErr.status, 'error');
    console.log('✓ ZCPClient process error handling test PASSED');
  } finally {
    childProcess.spawn = originalSpawn;
  }
}

testZCPClient().catch((err) => {
  console.error('❌ ZCPClient Test Failed:', err);
  process.exit(1);
});
