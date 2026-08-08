import { WebSocket } from '/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/node_modules/ws/index.js';
import { createStudioServer } from '/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/studio/server.js';
import { WsLogger } from '/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/studio/ws-logger.js';

async function runAdversarialStressTests() {
  console.log('--- STARTING ADVERSARIAL STRESS TESTS FOR M3 ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // Test 1: High-Volume Ring Buffer Overflow (10,000 log entries)
  try {
    const logger = new WsLogger({ maxBufferLength: 1000 });
    for (let i = 0; i < 10000; i++) {
      logger.emit('api-gateway', 'stdout', `Log entry ${i}`);
    }
    const logs = logger.getLogs();
    assert(logs.length === 1000, `Ring buffer clamped to maxBufferLength (1000 logs), got ${logs.length}`);
    assert(logs[0].message === 'Log entry 9000', `Oldest log in buffer is 9000, got ${logs[0].message}`);
    assert(logs[999].message === 'Log entry 9999', `Newest log in buffer is 9999, got ${logs[999].message}`);
  } catch (err: any) {
    assert(false, `Ring buffer test threw error: ${err.message}`);
  }

  // Test 2: Extreme Control Character Sanitization
  try {
    const logger = new WsLogger();
    // Null bytes, bell, backspace, VT, FF, SO, SI, ESC, DEL, C1 control chars
    const toxicInput = '\x00\x01\x02\x07\x08Evil\x0B\x0C\x0E\x0F\x1B[31mRed Alert\x1B[0m\x7F\x80\x9F\x0AEnd';
    const sanitized = logger.sanitizeMessage(toxicInput);
    assert(
      !sanitized.includes('\x00') && !sanitized.includes('\x07') && !sanitized.includes('\x7F'),
      'Sanitized string stripped non-printable control characters'
    );
    assert(sanitized.includes('\x1B[31mRed Alert\x1B[0m'), 'Sanitized string preserved ANSI escape sequences');
  } catch (err: any) {
    assert(false, `Sanitization test threw error: ${err.message}`);
  }

  // Test 3: Concurrent WebSocket Connections & Selective Service Subscriptions
  try {
    const studio = createStudioServer({ mock: true });
    const port = await studio.listen(0, '127.0.0.1');
    const wsUrl = `ws://127.0.0.1:${port}/ws/logs`;

    const clientCount = 20;
    const clients: WebSocket[] = [];
    const clientLogCounts: number[] = new Array(clientCount).fill(0);

    for (let i = 0; i < clientCount; i++) {
      const ws = new WebSocket(wsUrl);
      clients.push(ws);
      const serviceFilter = i % 2 === 0 ? 'web-frontend' : 'db-postgres';
      
      await new Promise<void>((res) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'subscribe', service: serviceFilter }));
          res();
        });
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'log') {
              clientLogCounts[i]++;
            }
          } catch {}
        });
      });
    }

    // Emit logs for web-frontend and db-postgres
    studio.logger.emit('web-frontend', 'stdout', 'Frontend message');
    studio.logger.emit('db-postgres', 'stdout', 'Database message');

    await new Promise((r) => setTimeout(r, 200));

    assert(clientLogCounts.every((c) => c >= 1), `All 20 concurrent clients received filtered logs correctly`);

    for (const ws of clients) ws.close();
    await studio.close();
  } catch (err: any) {
    assert(false, `Concurrent WS connection test threw error: ${err.message}`);
  }

  // Test 4: Static File Resolution from Compiled Dist Context
  try {
    const distStudio = createStudioServer({ mock: true });
    const port = await distStudio.listen(0, '127.0.0.1');
    const resHtml = await fetch(`http://127.0.0.1:${port}/index.html`);
    const resCss = await fetch(`http://127.0.0.1:${port}/style.css`);
    const resCanvas = await fetch(`http://127.0.0.1:${port}/topology-canvas.js`);
    const resApp = await fetch(`http://127.0.0.1:${port}/app.js`);

    assert(resHtml.status === 200, `GET /index.html returns 200 OK`);
    assert(resCss.status === 200, `GET /style.css returns 200 OK`);
    assert(resCanvas.status === 200, `GET /topology-canvas.js returns 200 OK`);
    assert(resApp.status === 200, `GET /app.js returns 200 OK`);

    const htmlText = await resHtml.text();
    assert(htmlText.includes('topology-canvas') && htmlText.includes('terminal-container'), 'HTML contains expected DOM IDs');

    await distStudio.close();
  } catch (err: any) {
    assert(false, `Static file resolution test threw error: ${err.message}`);
  }

  // Test 5: Malformed REST Payloads
  try {
    const studio = createStudioServer({ mock: true });
    const port = await studio.listen(0, '127.0.0.1');

    const resSynthEmpty = await fetch(`http://127.0.0.1:${port}/api/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(resSynthEmpty.status === 400, 'POST /api/synthesize with empty object returns 400 Bad Request');

    const resSynthWhitespace = await fetch(`http://127.0.0.1:${port}/api/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' })
    });
    assert(resSynthWhitespace.status === 400, 'POST /api/synthesize with whitespace prompt returns 400 Bad Request');

    await studio.close();
  } catch (err: any) {
    assert(false, `Malformed REST payload test threw error: ${err.message}`);
  }

  console.log(`\nSTRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialStressTests();
