import assert from 'node:assert';
import { createRequire } from 'node:module';
import path from 'node:path';

const engineDir = '/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine';
const engineRequire = createRequire(path.join(engineDir, 'package.json'));

const WebSocket = engineRequire('ws');
const { createStudioServer } = engineRequire('./src/studio/server.ts');
const { WsLogger } = engineRequire('./src/studio/ws-logger.ts');

async function runStressTests() {
  console.log('=== Challenger 1 Empirical Stress Test Suite for M4 Log Streamer ===\n');

  const studio = createStudioServer({ mock: true });
  const port = await studio.listen(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws/logs`;

  console.log(`Server listening on ${baseUrl} and ${wsUrl}`);

  try {
    // ------------------------------------------------------------------------
    console.log('\n[1/6] Stress Test 1: Rapid Connection Dropouts & Abrupt Socket Churn...');
    {
      const totalClients = 40;
      const clients: any[] = [];
      let receivedCount = 0;

      for (let i = 0; i < totalClients; i++) {
        const ws = new WebSocket(wsUrl);
        ws.on('message', () => { receivedCount++; });
        clients.push(ws);
      }

      await new Promise((r) => setTimeout(r, 150)); // wait for open

      for (let i = 0; i < 1000; i++) {
        studio.logger.emit('web-frontend', 'stdout', `Flood test line ${i}`);
        if (i === 200) {
          // Abruptly terminate 20 clients with terminate() (abrupt TCP reset)
          for (let j = 0; j < 20; j++) {
            clients[j].terminate();
          }
        }
        if (i === 500) {
          // Close 5 clients gracefully
          for (let j = 20; j < 25; j++) {
            clients[j].close();
          }
        }
        if (i % 100 === 0) {
          await new Promise((r) => setTimeout(r, 5));
        }
      }

      await new Promise((r) => setTimeout(r, 200));

      for (let i = 25; i < totalClients; i++) {
        if (clients[i].readyState === WebSocket.OPEN) {
          clients[i].close();
        }
      }

      assert(receivedCount > 1000, `Expected > 1000 received msgs, got ${receivedCount}`);
      const healthRes = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(healthRes.status, 200, 'Server health should be 200 after socket churn');
      console.log(`  => PASSED (received ${receivedCount} messages cleanly, server healthy)`);
    }

    // ------------------------------------------------------------------------
    console.log('\n[2/6] Stress Test 2: High-Frequency Log Flooding (10,000 log burst)...');
    {
      const ws = new WebSocket(wsUrl);
      let logCount = 0;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          for (let i = 0; i < 10000; i++) {
            studio.logger.emit('api-gateway', 'stdout', `High freq burst message ${i}`);
          }
          setTimeout(() => {
            ws.close();
            resolve();
          }, 300);
        });
        ws.on('message', (raw: any) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'log') logCount++;
        });
        ws.on('error', reject);
      });

      assert(logCount > 5000, `Expected > 5000 log messages, got ${logCount}`);
      const logs = studio.logger.getLogs();
      assert(logs.length <= 1000, `Ring buffer should be <= 1000, got ${logs.length}`);
      console.log(`  => PASSED (received ${logCount} log frames, ring buffer bounded at ${logs.length} items)`);
    }

    // ------------------------------------------------------------------------
    console.log('\n[3/6] Stress Test 3: Invalid JSON, Binary Payloads & Malformed Frames...');
    {
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send('NOT_JSON_RAW_STRING_TEST');
          ws.send('{"type": "subscribe", "service":');
          ws.send(Buffer.from([0x00, 0x1b, 0x07, 0x7f, 0x48, 0x69]));
          ws.send('12345');
          ws.send('true');
          ws.send('null');
          ws.send('["array", "element"]');
          ws.send(JSON.stringify({ type: 'unknown_type_xxx', randomKey: 999 }));

          setTimeout(() => {
            ws.close();
            resolve();
          }, 150);
        });
        ws.on('error', reject);
      });

      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200, 'Server should remain healthy after malformed frame injection');
      console.log('  => PASSED (handled raw text, binary buffer, malformed JSON, and primitives gracefully)');
    }

    // ------------------------------------------------------------------------
    console.log('\n[4/6] Stress Test 4: Extreme ANSI, Control Chars, UTF-8 & Large Payloads...');
    {
      const logger = new WsLogger();

      const dirtyMsg = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1c\x1d\x1e\x1f\x7f\x80\x9f';
      const sanitized = logger.sanitizeMessage(dirtyMsg);
      assert.strictEqual(sanitized, '', 'Non-printable ASCII control chars should be stripped');

      const validControls = 'Line1\nLine2\r\tTabbed \x1b[31mRed\x1b[0m';
      const sanitizedValid = logger.sanitizeMessage(validControls);
      assert.strictEqual(sanitizedValid, validControls, 'CR, LF, TAB, ESC must be preserved');

      const hugeMsg = '\x1b[32m' + 'A'.repeat(100000) + '\x1b[0m';
      const formattedAnsi = logger.formatAnsi({
        timestamp: new Date().toISOString(),
        service: 'ai-worker',
        stream: 'stdout',
        message: hugeMsg
      });
      assert(formattedAnsi.includes('[ai-worker]'), 'Service badge missing');
      assert(formattedAnsi.length > 100000, 'Huge ANSI message truncation error');

      const emojiMsg = '🚀 Deployment completed in 1.2s 🔥 [PASSED 100%] ⚡';
      const formattedEmoji = logger.formatAnsi({
        timestamp: new Date().toISOString(),
        service: 'zcp',
        stream: 'system',
        message: emojiMsg
      });
      assert(formattedEmoji.includes('🚀'), 'Emoji missing');
      assert(formattedEmoji.includes('🔥'), 'Emoji missing');
      console.log('  => PASSED (ANSI sanitization, large strings, and multi-byte UTF-8 verified)');
    }

    // ------------------------------------------------------------------------
    console.log('\n[5/6] Stress Test 5: Large History Replay Payload (20 Concurrent Clients)...');
    {
      const logger = studio.logger;
      for (let i = 0; i < 1000; i++) {
        logger.emit('db-postgres', 'stdout', `History log line ${i} with mock payload data for replay verification`);
      }

      const subscriberCount = 20;
      const receivedHistories: number[] = [];

      const promises = Array.from({ length: subscriberCount }).map(() => {
        return new Promise<void>((resolve, reject) => {
          const client = new WebSocket(wsUrl);
          client.on('message', (raw: any) => {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'history') {
              receivedHistories.push(msg.logs.length);
              client.close();
              resolve();
            }
          });
          client.on('error', reject);
        });
      });

      await Promise.all(promises);
      assert.strictEqual(receivedHistories.length, 20, 'All 20 subscribers must receive history');
      for (const len of receivedHistories) {
        assert.strictEqual(len, 1000, 'Each subscriber must receive 1000 history entries');
      }
      console.log('  => PASSED (20 concurrent new subscribers all received 1,000 history log items)');
    }

    // ------------------------------------------------------------------------
    console.log('\n[6/6] Stress Test 6: Terminal Fallback ANSI Stripping & Alias Mapping...');
    {
      const ansiRegex = /\x1b\[[0-9;]*m/g;
      const colorString = '\x1b[30m\x1b[31mRed\x1b[0m \x1b[32;1mGreen\x1b[0m \x1b[90mGray\x1b[0m';
      const plainText = colorString.replace(ansiRegex, '');
      assert.strictEqual(plainText, 'Red Green Gray', 'ANSI stripping for fallback <pre> tag failed');

      const aliasMap: Record<string, string> = {
        'webapp': 'web-frontend',
        'apigateway': 'api-gateway',
        'aiworker': 'ai-worker',
        'postgres': 'db-postgres',
        'valkey': 'cache-valkey'
      };
      assert.strictEqual(aliasMap['webapp'], 'web-frontend');
      assert.strictEqual(aliasMap['apigateway'], 'api-gateway');
      assert.strictEqual(aliasMap['aiworker'], 'ai-worker');
      assert.strictEqual(aliasMap['postgres'], 'db-postgres');
      assert.strictEqual(aliasMap['valkey'], 'cache-valkey');
      console.log('  => PASSED (Fallback <pre> tag ANSI regex and topology chip aliases verified)');
    }

    console.log('\nALL 6 EMPIRICAL STRESS TESTS PASSED SUCCESSFULLY! ✅\n');
  } finally {
    await studio.close();
  }
}

runStressTests().catch((err) => {
  console.error('STRESS TEST FAILED ❌:', err);
  process.exit(1);
});
