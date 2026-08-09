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
const { scaffoldApp } = require('./llm/scaffold');
const { listTemplates: listMappedTemplates } = require('./llm/template-mapper');
const demoQuota = require('./llm/demo-quota');
const deployJobs = require('./demo-deploy-jobs');
const { deployApp, zcliInfo } = require('./deploy-pipeline');

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
  users[cleanEmail] = {
    email: cleanEmail,
    password: hashedPassword,
    name: userName,
    zeropsToken: null,
    openaiApiKey: null,
  };

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
    res.json({
      success: true,
      user: req.session.user,
      hasToken: !!user.zeropsToken,
      hasOpenAIKey: !!user.openaiApiKey,
    });
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
    hasToken: !!(user && user.zeropsToken),
    hasOpenAIKey: !!(user && user.openaiApiKey),
  });
});

// ─── OPENAI KEY (BYOK — post-login synth) ───
app.post('/api/auth/openai-key', requireAuth, (req, res) => {
  const { apiKey } = req.body || {};
  const cleanKey = apiKey ? String(apiKey).trim() : '';
  if (!cleanKey || !cleanKey.startsWith('sk-')) {
    return res.status(400).json({ error: 'Valid OpenAI API key required (sk-...)' });
  }

  const cleanEmail = req.session.user.email ? req.session.user.email.toLowerCase().trim() : '';
  const user = users[cleanEmail];
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.openaiApiKey = cleanKey;
  res.json({ success: true, hasOpenAIKey: true });
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

// ─── SYNTHESIZE (legacy topology + optional LLM scaffold when user has key) ───
app.post('/api/synthesize', async (req, res) => {
  const { prompt, templateId, useLlm } = req.body || {};
  if (!prompt && !templateId) return res.status(400).json({ error: 'Prompt is required' });

  // Prefer LLM scaffold when authenticated user has OpenAI key (or server demo key)
  let apiKey = null;
  if (req.session && req.session.user && req.session.user.email) {
    const u = users[req.session.user.email.toLowerCase().trim()];
    if (u && u.openaiApiKey) apiKey = u.openaiApiKey;
  }
  if (!apiKey) apiKey = demoQuota.getDemoOpenAIKey();

  if (useLlm !== false && apiKey) {
    try {
      const scaffolded = await scaffoldApp({
        prompt: prompt || '',
        templateId,
        apiKey,
        useLlm: true,
      });
      return res.json({
        success: true,
        projectName: scaffolded.projectName,
        zeropsYml: scaffolded.importYaml,
        codeFiles: scaffolded.codeFiles,
        templateId: scaffolded.templateId,
        plan: scaffolded.plan,
        topology: scaffolded.topology,
        llmUsed: scaffolded.llmUsed,
        llmError: scaffolded.llmError,
      });
    } catch (err) {
      console.error('[synthesize/llm]', err);
      // fall through to deterministic synth
    }
  }

  const result = synthesizer.synthesize(prompt || templateId || 'AI SaaS');
  res.json({
    success: true,
    projectName: result.projectName,
    zeropsYml: result.zeropsYml,
    codeFiles: result.codeFiles,
    llmUsed: false,
  });
});

// ─── DEMO APIs (public, judge-day; server keys only) ───
app.get('/api/demo/status', (req, res) => {
  res.json({
    ok: true,
    ...demoQuota.status(),
    zcli: zcliInfo(),
    templates: listMappedTemplates(),
  });
});

app.post('/api/demo/scaffold', async (req, res) => {
  const { prompt, templateId } = req.body || {};
  if (!prompt && !templateId) {
    return res.status(400).json({ error: 'prompt or templateId required' });
  }

  try {
    const result = await scaffoldApp({
      prompt: prompt || '',
      templateId,
      apiKey: demoQuota.getDemoOpenAIKey(),
      useLlm: true,
    });
    res.json(result);
  } catch (err) {
    console.error('[demo/scaffold]', err);
    res.status(500).json({ error: err.message || 'Scaffold failed' });
  }
});

/**
 * Scripted topology animation payload for the demo canvas when real deploy is off
 * or slots are full. Client can also animate locally; this is the shared-stack story.
 */
app.post('/api/demo/simulate', async (req, res) => {
  const { prompt, templateId } = req.body || {};
  try {
    const result = await scaffoldApp({
      prompt: prompt || 'demo',
      templateId,
      apiKey: demoQuota.getDemoOpenAIKey(),
      useLlm: !!demoQuota.getDemoOpenAIKey(),
    });

    const steps = result.topology.map((s, i) => ({
      serviceId: s.id,
      privateHost: s.privateHost,
      delayMs: 400 + i * 500,
      status: 'healthy',
    }));

    res.json({
      success: true,
      mode: 'simulate',
      projectName: result.projectName,
      templateId: result.templateId,
      plan: result.plan,
      codeFiles: result.codeFiles,
      importYaml: result.importYaml,
      topology: result.topology,
      steps,
      // No invented URL. `https://zeroops-demo.zerops.app` used to be hardcoded
      // here and does not resolve — it handed judges a dead link at the exact
      // moment the demo claimed success. If no shared stack is configured, the
      // client shows this run as the simulation it is.
      liveUrl: process.env.DEMO_SHARED_URL || null,
      llmUsed: result.llmUsed,
      quota: demoQuota.status(),
    });
  } catch (err) {
    console.error('[demo/simulate]', err);
    res.status(500).json({ error: err.message || 'Simulate failed' });
  }
});

app.post('/api/demo/deploy', (req, res) => {
  const { prompt, templateId } = req.body || {};
  const quota = demoQuota.status();

  if (!demoQuota.isRealDeployEnabled()) {
    return res.status(503).json({
      error: 'Real demo deploy disabled (DEMO_REAL_DEPLOY=0). Use simulate.',
      quota,
    });
  }
  // In-flight deploys hold a slot too — they each become a real project a few
  // minutes from now, and are not registered against the quota until they do.
  const inFlight = deployJobs.activeCount();
  if (!demoQuota.canProvision() || quota.activeCount + inFlight >= quota.maxProjects) {
    return res.status(429).json({
      error: `Demo deploy slots full (${quota.activeCount + inFlight}/${quota.maxProjects}). Showing shared stack instead.`,
      quota,
      fallback: 'simulate',
    });
  }

  const pat = demoQuota.getDemoPat();
  if (!pat) {
    return res.status(503).json({
      error: 'No ZEROPS_DEMO_PAT / ZEROPS_TOKEN on server. Use simulate or set env.',
      quota,
      fallback: 'simulate',
    });
  }

  // A real build takes minutes. Streaming it down this response used to get the
  // connection killed by the L7 balancer during the first long silent stretch,
  // so the deploy now runs detached and the client polls the job below.
  const jobId = deployJobs.create();
  res.status(202).json({ jobId, poll: `/api/demo/deploy/${jobId}`, quota });

  runDemoDeploy({ jobId, prompt, templateId, pat });
});

/** Events recorded since `from`. Short request — it cannot idle out. */
app.get('/api/demo/deploy/:jobId', (req, res) => {
  const from = Number.parseInt(req.query.from, 10);
  const snapshot = deployJobs.read(req.params.jobId, Number.isNaN(from) ? 0 : from);
  if (!snapshot) {
    return res.status(404).json({ error: 'Unknown or expired deploy job' });
  }
  res.set('Cache-Control', 'no-store');
  res.json(snapshot);
});

/**
 * The deploy itself. Deliberately not tied to a request: it records into the job
 * store and never touches `res`, so nothing it does depends on a client still
 * being connected.
 */
async function runDemoDeploy({ jobId, prompt, templateId, pat }) {
  const send = (obj) => deployJobs.append(jobId, obj);

  try {
    send({ type: 'stage', stage: 'scaffold', text: 'mapping prompt and generating files', level: 'run' });

    const scaffolded = await scaffoldApp({
      prompt: prompt || '',
      templateId,
      apiKey: demoQuota.getDemoOpenAIKey(),
      useLlm: true,
    });

    // Push the artifacts down immediately so the workbench fills in while the
    // build runs, rather than everything appearing at the end.
    send({
      type: 'scaffold',
      projectName: scaffolded.projectName,
      templateId: scaffolded.templateId,
      templateName: scaffolded.templateName,
      confidence: scaffolded.confidence,
      matchedKeywords: scaffolded.matchedKeywords,
      plan: scaffolded.plan,
      codeFiles: scaffolded.codeFiles,
      importYaml: scaffolded.importYaml,
      topology: scaffolded.topology,
      llmUsed: scaffolded.llmUsed,
      llmError: scaffolded.llmError,
    });

    const result = await deployApp({
      pat,
      projectName: scaffolded.projectName,
      importYaml: scaffolded.importYaml,
      codeFiles: scaffolded.codeFiles,
      onEvent: (e) => {
        if (e.stage === 'log') send({ type: 'log', text: e.text });
        else send({ type: 'stage', stage: e.stage, text: e.text, level: e.level });
      },
    });

    const id = `demo-${Date.now()}`;
    demoQuota.registerProject(id, {
      projectName: result.projectName,
      liveUrl: result.liveUrl || null,
    });

    deployJobs.finish(jobId, {
      type: 'done',
      mode: 'real',
      id,
      projectId: result.projectId,
      projectName: result.projectName,
      liveUrl: result.liveUrl,
      verified: result.verified,
      httpStatus: result.httpStatus,
      services: result.services,
      topology: scaffolded.topology.map((s) => ({ ...s, status: 'healthy' })),
      quota: demoQuota.status(),
    });
  } catch (err) {
    console.error('[demo/deploy]', err);
    deployJobs.finish(jobId, {
      type: 'error',
      error: err.message || 'Deploy failed',
      fallback: 'simulate',
      quota: demoQuota.status(),
    });
  }
}

// ─── UI routes ───
// Always expose product HTML for demo/studio (works even when web/dist SPA exists).
app.get('/demo', (req, res) => {
  res.sendFile(path.join(publicDir, 'demo.html'));
});
app.get('/studio', (req, res) => {
  res.sendFile(path.join(publicDir, 'studio.html'));
});
app.get('/login', (req, res) => {
  // Prefer public login when present (session cookie same-origin)
  const legacy = path.join(publicDir, 'login.html');
  if (fs.existsSync(legacy)) return res.sendFile(legacy);
  if (useReactUi) return res.sendFile(path.join(webDistDir, 'index.html'));
  res.status(404).send('Login not found');
});

// Static assets from public/ (design system, studio.css, demo.js, …)
app.use(express.static(publicDir, { index: false }));

if (useReactUi) {
  app.use(express.static(webDistDir, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    // Already handled: /demo /studio /login
    if (req.path === '/demo' || req.path === '/studio' || req.path === '/login') return next();
    res.sendFile(path.join(webDistDir, 'index.html'));
  });
  console.log('[UI] React web/dist + public/demo + public/studio');
} else {
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'landing.html'));
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
  console.log('[UI] Serving legacy public/ HTML');
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
