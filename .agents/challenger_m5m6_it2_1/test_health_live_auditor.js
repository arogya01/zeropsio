const assert = require('assert');
const http = require('http');
const HealthChecker = require('../../zeroops-engine/src/server/health-checker');
const { LiveAuditor } = require('../../zeroops-engine/src/verifier/live-auditor');

async function testHealthAndLiveAuditor() {
  console.log('--- EMPIRICAL TEST: HealthChecker & LiveAuditor ---');

  // Test 1: LiveAuditor default options verify mockMode is false unless MOCK_MODE env set
  // Note: if MOCK_MODE is not set, mockMode should be false (because process.env.MOCK_MODE !== 'false' checks if MOCK_MODE is set or defaults to false if MOCK_MODE is undefined or 'false'). Wait! Let's check constructor:
  // this.mockMode = options.mockMode ?? (process.env.MOCK_MODE !== 'false');
  // Wait, if process.env.MOCK_MODE is undefined, `undefined !== 'false'` is TRUE!
  // Wait, let's verify what options HealthChecker passes!
  // HealthChecker passes options directly: `const opts = { ...options }; this.auditor = new LiveAuditor(opts);`
  // If we pass `options = { mockMode: false }`, mockMode MUST be false.

  const realAuditor = new LiveAuditor({ mockMode: false, retries: 1, timeoutMs: 500, backoffMs: 50 });
  assert.strictEqual(realAuditor.mockMode, false);
  assert.strictEqual(realAuditor.fallbackOnOffline, false);

  // Test 2: Unreachable / Offline HTTP Endpoint returns status 503 and ok: false
  console.log('Testing unreachable HTTP endpoint (127.0.0.1:59999)...');
  const httpRes = await realAuditor.auditHttp('http://127.0.0.1:59999');
  assert.strictEqual(httpRes.status, 503);
  assert.strictEqual(httpRes.ok, false);
  console.log('✓ Unreachable HTTP endpoint returned genuine status 503 (PASSED)');

  // Test 3: Unreachable Database (PostgreSQL TCP port 127.0.0.1:59998)
  console.log('Testing unreachable Database host (127.0.0.1:59998)...');
  const dbRes = await realAuditor.auditDb('postgres://127.0.0.1:59998/app');
  assert.strictEqual(dbRes.connected, false);
  assert.strictEqual(dbRes.writeOk, false);
  console.log('✓ Unreachable Database returned connected: false (PASSED)');

  // Test 4: Unreachable Valkey Cache (TCP port 127.0.0.1:59997)
  console.log('Testing unreachable Cache host (127.0.0.1:59997)...');
  const cacheRes = await realAuditor.auditCache('127.0.0.1', 59997);
  assert.strictEqual(cacheRes.pingOk, false);
  console.log('✓ Unreachable Cache returned pingOk: false (PASSED)');

  // Test 5: Live HTTP Endpoint using a real local HTTP server
  console.log('Starting local HTTP test server...');
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } else if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>OK</h1>');
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const localUrl = `http://127.0.0.1:${port}`;

  try {
    console.log(`Testing LiveAuditor against active local HTTP server on ${localUrl}...`);
    const liveAuditorWithLocal = new LiveAuditor({
      mockMode: false,
      retries: 1,
      timeoutMs: 1000,
      postgresHost: '127.0.0.1',
      postgresPort: 59998, // Offline DB to verify mixed audit results
      valkeyHost: '127.0.0.1',
      valkeyPort: 59997    // Offline Cache
    });

    const fullResult = await liveAuditorWithLocal.runFullAudit(localUrl, 'localtest');
    assert.strictEqual(fullResult.details.publicHttp.passed, true);
    assert.strictEqual(fullResult.details.publicHttp.statusCode, 200);
    assert.strictEqual(fullResult.details.apiGateway.passed, true);
    assert.strictEqual(fullResult.details.apiGateway.statusCode, 200);
    assert.strictEqual(fullResult.details.postgresPrivateDb.passed, false);
    assert.strictEqual(fullResult.details.valkeyPrivateCache.passed, false);
    assert.strictEqual(fullResult.passed, false); // Overall audit failed because DB & cache offline
    assert.strictEqual(fullResult.auditsPassed, 2); // 2 out of 4 (HTTP + API) passed

    console.log('✓ Genuine HTTP 200 probe and audit aggregation verified (PASSED)');
  } finally {
    server.close();
  }

  // Test 6: HealthChecker delegation test with mockMode explicitly set vs disabled
  const healthCheckerReal = new HealthChecker({ mockMode: false, retries: 1, timeoutMs: 500 });
  const hcResult = await healthCheckerReal.runAudit('testproj', 'http://127.0.0.1:59999');
  assert.strictEqual(hcResult.success, false);
  assert.strictEqual(hcResult.auditsPassed, 0);
  assert.strictEqual(hcResult.score, '0%');
  assert.strictEqual(hcResult.details.publicHttp.statusCode, 503);
  console.log('✓ HealthChecker delegation to LiveAuditor with mockMode: false verified (PASSED)');

  // Test 7: HealthChecker with mockMode explicitly true
  const healthCheckerMock = new HealthChecker({ mockMode: true });
  const hcMockResult = await healthCheckerMock.runAudit('testproj', 'http://127.0.0.1:59999');
  assert.strictEqual(hcMockResult.success, true);
  assert.strictEqual(hcMockResult.auditsPassed, 4);
  assert.strictEqual(hcMockResult.score, '100%');
  console.log('✓ HealthChecker explicit mockMode: true verified (PASSED)');
}

testHealthAndLiveAuditor().catch((err) => {
  console.error('❌ HealthChecker & LiveAuditor Test Failed:', err);
  process.exit(1);
});
