/**
 * ZeroOps Engine - Multi-Tenant Server
 * Express REST API + Session Auth + WebSockets for real-time ZCP log streaming.
 * Each user brings their own Zerops token.
 */

const express = require('express');
const session = require('express-session');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const ZCPClient = require('./zcp-client');
const Synthesizer = require('./synthesizer');
const HealthChecker = require('./health-checker');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const synthesizer = new Synthesizer();
const healthChecker = new HealthChecker();

// In-memory user store (hackathon-grade; swap for DB in prod)
const users = {};

app.use(express.json());
app.use(session({
  secret: 'zeroops-studio-hackathon-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// Static files
app.use(express.static(path.join(__dirname, '../../public')));

// ─── AUTH MIDDLEWARE ───
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// ─── AUTH ROUTES ───
app.post('/api/auth/signup', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (users[email]) return res.status(409).json({ error: 'User already exists' });

  users[email] = { email, password, name: name || email.split('@')[0], zeropsToken: null };
  req.session.user = { email, name: users[email].name };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = users[email];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = { email, name: user.name };
  res.json({ success: true, user: req.session.user, hasToken: !!user.zeropsToken });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  const user = users[req.session.user.email];
  res.json({
    user: req.session.user,
    hasToken: !!(user && user.zeropsToken)
  });
});

// ─── ZEROPS TOKEN ───
app.post('/api/auth/token', requireAuth, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const user = users[req.session.user.email];
  if (user) {
    user.zeropsToken = token;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// ─── TEMPLATES API ───
app.get('/api/templates', (req, res) => {
  const templatesDir = path.join(__dirname, '../templates');
  try {
    const dirs = fs.readdirSync(templatesDir).filter(d =>
      fs.statSync(path.join(templatesDir, d)).isDirectory()
    );

    const templates = dirs.map(dir => {
      const metaPath = path.join(templatesDir, dir, 'template.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        return { id: dir, ...meta };
      }
      return { id: dir, name: dir, description: '', icon: '📦', services: [] };
    });

    res.json({ templates });
  } catch (err) {
    res.json({ templates: [] });
  }
});

app.get('/api/templates/:id', (req, res) => {
  const templateDir = path.join(__dirname, '../templates', req.params.id);
  if (!fs.existsSync(templateDir)) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const metaPath = path.join(templateDir, 'template.json');
  const importPath = path.join(templateDir, 'zerops-import.yml');

  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
  const importYaml = fs.existsSync(importPath) ? fs.readFileSync(importPath, 'utf-8') : '';

  res.json({ id: req.params.id, ...meta, importYaml });
});

// ─── SYNTHESIZE (legacy) ───
app.post('/api/synthesize', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const result = synthesizer.synthesize(prompt);
  res.json({
    success: true,
    projectName: result.projectName,
    zeropsYml: result.zeropsYml,
    codeFiles: result.codeFiles
  });
});

// ─── PAGES ───
// Serve login page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/login.html'));
});

// Serve studio at /studio
app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/studio.html'));
});

// ─── WEBSOCKET ───
// Map sessionId -> zeropsToken for WS auth
const wsTokenMap = new Map();

app.post('/api/ws-token', requireAuth, (req, res) => {
  const user = users[req.session.user.email];
  if (user && user.zeropsToken) {
    wsTokenMap.set(req.sessionID, user.zeropsToken);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'No Zerops token configured' });
  }
});

wss.on('connection', (ws, req) => {
  console.log('[WS] Client connected to ZeroOps Studio log stream');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.action === 'deploy') {
        const { prompt, templateId, zeropsToken } = data;

        // Use the token sent by the client (from their session)
        const token = zeropsToken || null;
        const zcpClient = new ZCPClient(token);

        let synthResult;
        let importYaml;

        if (templateId) {
          // Template-based deploy
          const templateDir = path.join(__dirname, '../templates', templateId);
          const metaPath = path.join(templateDir, 'template.json');
          const importPath = path.join(templateDir, 'zerops-import.yml');

          if (fs.existsSync(importPath)) {
            importYaml = fs.readFileSync(importPath, 'utf-8');
          }

          synthResult = {
            projectName: templateId.replace(/-/g, ''),
            zeropsYml: importYaml || '',
            codeFiles: {}
          };
        } else {
          synthResult = synthesizer.synthesize(prompt || 'AI SaaS');
        }

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
        sendLog(`[PROMPT]: "${prompt || templateId}"`);

        const services = ['web-frontend', 'api-gateway', 'ai-worker', 'db-postgres', 'cache-valkey'];
        for (const s of services) {
          sendState(s, 'building');
        }

        const deployResult = await zcpClient.provisionProject(
          synthResult.projectName,
          synthResult.zeropsYml,
          sendLog
        );

        for (const s of services) {
          sendState(s, 'healthy');
        }

        const auditResult = await healthChecker.runAudit(
          deployResult.projectName,
          deployResult.liveUrl,
          sendLog
        );

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
