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
const crypto = require('crypto');
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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || !storedPassword.includes(':')) return false;
  const [salt, key] = storedPassword.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'zeroops-studio-hackathon-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

const publicDir = path.join(__dirname, '../../public');
const webDistDir = path.join(__dirname, '../../web/dist');
const useReactUi = fs.existsSync(path.join(webDistDir, 'index.html'));

// Static + page routes are registered AFTER API routes (see bottom of file).

// ─── AUTH MIDDLEWARE ───
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// ─── AUTH ROUTES ───
app.post('/api/auth/signup', (req, res) => {
  const { email, password, name } = req.body;
  const cleanEmail = email ? email.toLowerCase().trim() : '';
  if (!cleanEmail || !password) return res.status(400).json({ error: 'Email and password required' });
  if (users[cleanEmail]) return res.status(409).json({ error: 'User already exists' });

  const hashedPassword = hashPassword(password);
  const userName = (name && name.trim()) ? name.trim() : cleanEmail.split('@')[0];
  users[cleanEmail] = { email: cleanEmail, password: hashedPassword, name: userName, zeropsToken: null };

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session regeneration failed' });
    req.session.user = { email: cleanEmail, name: userName };
    res.json({ success: true, user: req.session.user });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.toLowerCase().trim() : '';
  if (!cleanEmail || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = users[cleanEmail];
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session regeneration failed' });
    req.session.user = { email: cleanEmail, name: user.name };
    res.json({ success: true, user: req.session.user, hasToken: !!user.zeropsToken });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  const cleanEmail = req.session.user.email ? req.session.user.email.toLowerCase().trim() : '';
  const user = users[cleanEmail];
  res.json({
    user: req.session.user,
    hasToken: !!(user && user.zeropsToken)
  });
});

// ─── ZEROPS TOKEN ───
app.post('/api/auth/token', requireAuth, (req, res) => {
  const { token } = req.body;
  const cleanToken = token ? token.trim() : '';
  if (!cleanToken) return res.status(400).json({ error: 'Token required' });

  const cleanEmail = req.session.user.email ? req.session.user.email.toLowerCase().trim() : '';
  const user = users[cleanEmail];
  if (user) {
    user.zeropsToken = cleanToken;
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

// ─── UI (React SPA when web/dist exists; else legacy public HTML) ───
if (useReactUi) {
  app.use(express.static(webDistDir, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(webDistDir, 'index.html'));
  });
  console.log('[UI] Serving React app from web/dist');
} else {
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'landing.html'));
  });
  app.get('/login', (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
  });
  app.get('/studio', (req, res) => {
    res.sendFile(path.join(publicDir, 'studio.html'));
  });
  app.get('/preview', (req, res) => {
    res.sendFile(path.join(publicDir, 'preview', 'index.html'));
  });
  app.get('/preview/v:n', (req, res) => {
    const n = String(req.params.n || '');
    if (!/^[1-5]$/.test(n)) return res.status(404).send('Variant not found');
    const file = path.join(publicDir, 'preview', `v${n}`, 'landing.html');
    if (!fs.existsSync(file)) return res.status(404).send('Page not found');
    res.sendFile(file);
  });
  app.get('/preview/v:n/:page(landing|login|studio)', (req, res) => {
    const n = String(req.params.n || '');
    if (!/^[1-5]$/.test(n)) return res.status(404).send('Variant not found');
    const page = req.params.page || 'landing';
    const file = path.join(publicDir, 'preview', `v${n}`, `${page}.html`);
    if (!fs.existsSync(file)) return res.status(404).send('Page not found');
    res.sendFile(file);
  });
  app.use(express.static(publicDir, { index: false }));
  console.log('[UI] Serving legacy public/ HTML (run: npm run build:web)');
}

// ─── WEBSOCKET ───
// Map sessionId -> zeropsToken for WS auth
const wsTokenMap = new Map();

app.post('/api/ws-token', requireAuth, (req, res) => {
  const cleanEmail = req.session.user.email ? req.session.user.email.toLowerCase().trim() : '';
  const user = users[cleanEmail];
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

        // Use the token sent by the client (from their session), or fallback to session user / wsTokenMap
        let token = zeropsToken || null;
        if (!token && req.session && req.session.user && req.session.user.email) {
          const cleanEmail = req.session.user.email.toLowerCase().trim();
          if (users[cleanEmail] && users[cleanEmail].zeropsToken) {
            token = users[cleanEmail].zeropsToken;
          }
        }
        if (!token && req.sessionID && wsTokenMap.has(req.sessionID)) {
          token = wsTokenMap.get(req.sessionID);
        }
        if (!token && req.headers && req.headers.cookie) {
          const match = req.headers.cookie.match(/connect\.sid=s%3A([^.]+)/);
          if (match) {
            const rawSessionId = decodeURIComponent(match[1]);
            if (wsTokenMap.has(rawSessionId)) {
              token = wsTokenMap.get(rawSessionId);
            }
          }
        }

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
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', error: err.message || String(err) }));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 ZeroOps Engine Studio running on http://localhost:${PORT}`);
    console.log(`==================================================\n`);
  });
}

module.exports = { app, server, wss, users };
