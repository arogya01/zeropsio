/**
 * ZeroOps Engine - Server & WebSocket Gateway
 * Express REST API + WebSockets for real-time ZCP container log streaming.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const ZCPClient = require('./zcp-client');
const Synthesizer = require('./synthesizer');
const HealthChecker = require('./health-checker');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const zcpClient = new ZCPClient();
const synthesizer = new Synthesizer();
const healthChecker = new HealthChecker();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// API Endpoint: Synthesize Full-Stack Code & zerops.yml from prompt
app.post('/api/synthesize', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const result = synthesizer.synthesize(prompt);
  res.json({
    success: true,
    projectName: result.projectName,
    zeropsYml: result.zeropsYml,
    codeFiles: result.codeFiles
  });
});

// WebSocket Connection handling for live ZCP deployment log streaming
wss.on('connection', (ws) => {
  console.log('[WS] Client connected to ZeroOps Studio log stream');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'deploy') {
        const { projectName, prompt } = data;
        const synthResult = synthesizer.synthesize(prompt || 'AI SaaS');

        const sendLog = (text) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'log', text }));
          }
        };

        const sendState = (serviceId, status) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'topology-update', serviceId, status }));
          }
        };

        sendLog(`🚀 Beginning ZeroOps Full-Stack Cloud Factory Pipeline...`);
        sendLog(`[PROMPT]: "${prompt}"`);

        // Simulate interactive topology transitions
        const services = ['web-frontend', 'api-gateway', 'ai-worker', 'db-postgres', 'cache-valkey'];
        for (const s of services) {
          sendState(s, 'building');
        }

        const deployResult = await zcpClient.provisionProject(projectName || synthResult.projectName, synthResult.zeropsYml, sendLog);

        for (const s of services) {
          sendState(s, 'healthy');
        }

        // Run automated health audit
        const auditResult = await healthChecker.runAudit(deployResult.projectName, deployResult.liveUrl, sendLog);

        ws.send(JSON.stringify({
          type: 'complete',
          liveUrl: deployResult.liveUrl,
          projectName: deployResult.projectName,
          services: deployResult.services,
          audit: auditResult
        }));
      }
    } catch (err) {
      console.error('[WS ERROR]', err);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 ZeroOps Engine Studio running on http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
