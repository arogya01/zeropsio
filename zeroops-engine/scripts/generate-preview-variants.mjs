/**
 * Generates preview funnel pages (landing / login / studio shell) for design variants.
 * Run: node scripts/generate-preview-variants.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'public');
const preview = path.join(root, 'preview');

const VARIANTS = [
  {
    id: 1,
    name: 'Signal Deck',
    tag: 'Ops / industrial',
    fonts:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap',
    display: "'Syne', system-ui, sans-serif",
    body: "'IBM Plex Mono', ui-monospace, monospace",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    css: `
body.v1 {
  --bg: #050605;
  --surface: #0d100c;
  --surface-2: #141a13;
  --border: #243022;
  --text-1: #e8f5d8;
  --text-2: #9bb08a;
  --text-3: #5c6b52;
  --brand: #c8f542;
  --brand-ink: #0a1200;
  --accent: #f5a623;
  --ok: #7CFF6B;
  --font-display: ${"'Syne', system-ui, sans-serif"};
  --font-body: ${"'IBM Plex Mono', ui-monospace, monospace"};
  --font-mono: ${"'IBM Plex Mono', ui-monospace, monospace"};
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(200,245,66,0.08), transparent 55%),
    linear-gradient(180deg, #050605 0%, #080a07 100%);
  color: var(--text-1);
  font-family: var(--font-body);
}
.v1 .nav { border-bottom-color: #1c2818; backdrop-filter: blur(8px); background: rgba(5,6,5,0.85); }
.v1 .hero-kicker { color: var(--brand); }
.v1 .display { letter-spacing: -0.03em; text-transform: uppercase; }
.v1 .pipeline { box-shadow: 0 0 0 1px #1c2818, 0 30px 80px rgba(0,0,0,0.55); }
.v1 .grid-bg::before {
  content: '';
  position: absolute; inset: 0; pointer-events: none; opacity: 0.2;
  background-image:
    linear-gradient(rgba(200,245,66,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(200,245,66,0.07) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at center, black 20%, transparent 75%);
}
`
  },
  {
    id: 2,
    name: 'Editorial Factory',
    tag: 'Light / magazine',
    fonts:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
    display: "'Fraunces', Georgia, serif",
    body: "'Manrope', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    css: `
body.v2 {
  --bg: #f6f1e8;
  --surface: #fffdf8;
  --surface-2: #efe8db;
  --border: #ddd2c0;
  --text-1: #14120f;
  --text-2: #5c564c;
  --text-3: #8a8276;
  --brand: #1d4ed8;
  --brand-ink: #f8fafc;
  --accent: #c2410c;
  --ok: #15803d;
  --font-display: ${"'Fraunces', Georgia, serif"};
  --font-body: ${"'Manrope', system-ui, sans-serif"};
  --font-mono: ${"'IBM Plex Mono', ui-monospace, monospace"};
  background: var(--bg);
  color: var(--text-1);
  font-family: var(--font-body);
}
.v2 .nav { background: rgba(246,241,232,0.9); border-bottom-color: var(--border); backdrop-filter: blur(10px); }
.v2 .display { font-style: italic; font-weight: 500; letter-spacing: -0.02em; text-transform: none; }
.v2 .hero-kicker { color: var(--accent); }
.v2 .btn-primary { background: var(--text-1); color: var(--bg); }
.v2 .btn-primary:hover { background: var(--brand); color: #fff; }
.v2 .pipeline { box-shadow: 0 24px 60px rgba(20,18,15,0.08); }
.v2 .section-dark { background: #17140f; color: #f6f1e8; }
.v2 .section-dark .muted { color: #b5aa98; }
`
  },
  {
    id: 3,
    name: 'Circuit Atlas',
    tag: 'Map / copper+ice',
    fonts:
      'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
    display: "'Sora', system-ui, sans-serif",
    body: "'Sora', system-ui, sans-serif",
    mono: "'Space Mono', ui-monospace, monospace",
    css: `
body.v3 {
  --bg: #07111c;
  --surface: #0c1a2b;
  --surface-2: #122438;
  --border: #1e3a55;
  --text-1: #e8f1ff;
  --text-2: #93a9c4;
  --text-3: #5d7593;
  --brand: #7dd3fc;
  --brand-ink: #042f2e;
  --accent: #d97706;
  --ok: #34d399;
  --font-display: ${"'Sora', system-ui, sans-serif"};
  --font-body: ${"'Sora', system-ui, sans-serif"};
  --font-mono: ${"'Space Mono', ui-monospace, monospace"};
  background:
    radial-gradient(900px 500px at 80% 0%, rgba(217,119,6,0.12), transparent 50%),
    radial-gradient(700px 400px at 0% 40%, rgba(125,211,252,0.1), transparent 50%),
    var(--bg);
  color: var(--text-1);
  font-family: var(--font-body);
}
.v3 .nav { background: rgba(7,17,28,0.88); border-bottom-color: #163049; }
.v3 .display { letter-spacing: -0.03em; }
.v3 .hero-kicker { color: var(--accent); font-family: var(--font-mono); }
.v3 .atlas-lines {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.35;
  background:
    linear-gradient(115deg, transparent 40%, rgba(125,211,252,0.08) 50%, transparent 60%),
    repeating-linear-gradient(0deg, transparent, transparent 48px, rgba(30,58,85,0.35) 49px);
}
.v3 .pipeline__node.is-healthy { box-shadow: 0 0 20px rgba(52,211,153,0.15); }
`
  },
  {
    id: 4,
    name: 'Warm Build',
    tag: 'Craft / terracotta',
    fonts:
      'https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
    display: "'Archivo Black', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    css: `
body.v4 {
  --bg: #1a1410;
  --surface: #241c16;
  --surface-2: #2e241c;
  --border: #3d3126;
  --text-1: #faf3ea;
  --text-2: #c4b2a0;
  --text-3: #8a7664;
  --brand: #e07a3d;
  --brand-ink: #1a1008;
  --accent: #f0c987;
  --ok: #86efac;
  --font-display: ${"'Archivo Black', system-ui, sans-serif"};
  --font-body: ${"'DM Sans', system-ui, sans-serif"};
  --font-mono: ${"'JetBrains Mono', ui-monospace, monospace"};
  background:
    radial-gradient(800px 400px at 50% -10%, rgba(224,122,61,0.14), transparent 55%),
    var(--bg);
  color: var(--text-1);
  font-family: var(--font-body);
}
.v4 .nav { background: rgba(26,20,16,0.9); border-bottom-color: var(--border); }
.v4 .display { text-transform: uppercase; letter-spacing: -0.01em; line-height: 0.95; }
.v4 .hero-kicker { color: var(--accent); }
.v4 .btn-primary { background: var(--brand); color: var(--brand-ink); }
.v4 .brick { border-radius: 4px; }
.v4 .pipeline__node { border-radius: 6px; }
`
  }
];

const SHARED_LANDING_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { min-height: 100vh; -webkit-font-smoothing: antialiased; }
a { color: inherit; }
.wrap { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
.nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border);
}
.nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; }
.nav-mark {
  width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center;
  background: var(--brand); color: var(--brand-ink); font-size: 14px; font-weight: 800;
}
.nav-links { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.nav-links a { font-size: 13px; color: var(--text-2); text-decoration: none; }
.nav-links a:hover { color: var(--text-1); }
.variant-bar {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  font-size: 11px; color: var(--text-3);
}
.variant-bar a {
  text-decoration: none; border: 1px solid var(--border); border-radius: 999px;
  padding: 4px 10px; color: var(--text-2); background: var(--surface);
  transition: border-color var(--dur-ui) var(--ease-out), color var(--dur-ui) var(--ease-out);
}
.variant-bar a.active, .variant-bar a:hover {
  border-color: var(--brand); color: var(--text-1);
}
.hero {
  position: relative;
  display: grid; gap: 36px; padding: 56px 0 40px;
}
@media (min-width: 900px) {
  .hero { grid-template-columns: 1fr 1.05fr; align-items: center; padding: 72px 0 56px; }
}
.hero-kicker {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em;
  text-transform: uppercase; margin-bottom: 14px;
}
.display {
  font-family: var(--font-display); font-size: clamp(2.2rem, 5vw, 3.6rem);
  line-height: 1.05; margin-bottom: 16px;
}
.lead { font-size: 1.05rem; line-height: 1.65; color: var(--text-2); max-width: 38ch; margin-bottom: 28px; }
.cta-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.btn-primary, .btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: 999px; padding: 12px 18px; font-size: 14px; font-weight: 600;
  text-decoration: none; border: 1px solid transparent; cursor: pointer;
  font-family: var(--font-body);
}
.btn-primary { background: var(--brand); color: var(--brand-ink); }
.btn-primary:hover { filter: brightness(1.05); }
.btn-ghost { border-color: var(--border); color: var(--text-1); background: transparent; }
.btn-ghost:hover { border-color: var(--text-3); }
.muted { color: var(--text-2); }
.section { padding: 64px 0; }
.section h2 {
  font-family: var(--font-display); font-size: clamp(1.6rem, 3vw, 2.2rem);
  margin-bottom: 12px; letter-spacing: -0.02em;
}
.section .sub { color: var(--text-2); max-width: 52ch; margin-bottom: 28px; line-height: 1.6; }
.steps { display: grid; gap: 14px; }
@media (min-width: 800px) { .steps { grid-template-columns: repeat(4, 1fr); } }
.step {
  border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius);
  padding: 18px; min-height: 150px;
  transition: transform var(--dur-ui) var(--ease-out), border-color var(--dur-ui) var(--ease-out);
}
.step:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--brand) 40%, var(--border)); }
.step-num {
  font-family: var(--font-mono); font-size: 11px; color: var(--brand); letter-spacing: 0.08em;
  margin-bottom: 10px;
}
.step h3 { font-size: 15px; margin-bottom: 8px; }
.step p { font-size: 13px; color: var(--text-2); line-height: 1.55; }
.templates { display: grid; gap: 12px; }
@media (min-width: 800px) { .templates { grid-template-columns: repeat(3, 1fr); } }
.t-card {
  border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius);
  padding: 18px; transition: transform var(--dur-ui) var(--ease-out), border-color var(--dur-ui) var(--ease-out);
}
.t-card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.t-card h3 { font-size: 15px; margin: 8px 0; }
.t-card p { font-size: 13px; color: var(--text-2); line-height: 1.5; }
.t-mini { display: flex; gap: 4px; margin-top: 12px; }
.t-mini span {
  width: 8px; height: 8px; border-radius: 50%; background: var(--text-3); opacity: 0.5;
}
.t-card:hover .t-mini span {
  animation: mini-pulse 1s var(--ease-in-out) infinite;
}
.t-card:hover .t-mini span:nth-child(2) { animation-delay: 0.15s; background: var(--accent); opacity: 1; }
.t-card:hover .t-mini span:nth-child(3) { animation-delay: 0.3s; background: var(--ok); opacity: 1; }
@keyframes mini-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.4); }
}
.footer {
  border-top: 1px solid var(--border); padding: 28px 0 40px;
  display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between;
  font-size: 12px; color: var(--text-3);
}
.footer a { color: var(--text-2); }
.hero-aside { position: relative; }
.grid-bg { position: relative; }
`;

function variantBar(activeId, page) {
  return VARIANTS.map(
    (v) =>
      `<a class="${v.id === activeId ? 'active' : ''}" href="/preview/v${v.id}/${page}">V${v.id} ${v.name}</a>`
  ).join('');
}

function pipelineMarkup() {
  return `
<div class="pipeline" data-pipeline>
  <div class="pipeline__progress"><i></i></div>
  <div class="pipeline__stage-label" data-stage>01 · Describe</div>
  <div class="pipeline__grid">
    <div>
      <div class="pipeline__prompt">
        <span class="pipeline__prompt-text"></span><span class="pipeline__caret"></span>
      </div>
      <div style="height:12px"></div>
      <div class="pipeline__stage-label">Services</div>
      <div class="pipeline__nodes">
        <div class="pipeline__node"><span class="dot"></span>webapp</div>
        <span class="pipeline__edge">→</span>
        <div class="pipeline__node"><span class="dot"></span>apigateway</div>
        <span class="pipeline__edge">→</span>
        <div class="pipeline__node"><span class="dot"></span>aiworker</div>
        <span class="pipeline__edge">⇄</span>
        <div class="pipeline__node"><span class="dot"></span>dbpostgres</div>
        <span class="pipeline__edge">⇄</span>
        <div class="pipeline__node"><span class="dot"></span>cachevalkey</div>
      </div>
      <div class="pipeline__url">
        <span class="pipeline__url-badge">Live</span>
        <a href="https://studio-2cbd-3000.prg1.zerops.app" target="_blank" rel="noopener">studio-2cbd-3000.prg1.zerops.app</a>
      </div>
    </div>
    <div>
      <div class="pipeline__stage-label">zcli stream</div>
      <div class="pipeline__log" aria-live="polite"></div>
    </div>
  </div>
</div>`;
}

function landingHtml(v) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZeroOps — ${v.name} (V${v.id})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${v.fonts}" rel="stylesheet" />
  <link rel="stylesheet" href="/design/tokens.css" />
  <link rel="stylesheet" href="/design/motion.css" />
  <link rel="stylesheet" href="theme.css" />
  <style>${SHARED_LANDING_CSS}</style>
</head>
<body class="v${v.id}">
  <div class="wrap">
    <header class="nav">
      <a class="nav-brand" href="/preview/v${v.id}/landing"><span class="nav-mark">Z</span> ZeroOps</a>
      <div class="variant-bar" title="Design variants">${variantBar(v.id, 'landing')}</div>
      <nav class="nav-links">
        <a href="#how">How it works</a>
        <a href="/preview/v${v.id}/login">Log in</a>
        <a class="btn-primary btn-press" href="/login" style="padding:8px 14px;font-size:13px">Open Studio</a>
      </nav>
    </header>

    <section class="hero grid-bg">
      <div class="reveal">
        <p class="hero-kicker">${v.tag} · Prompt → Zerops</p>
        <h1 class="display">Prompt in.<br/>Multi-service stack out.</h1>
        <p class="lead">ZeroOps turns a template or natural-language prompt into polyglot services, <code style="font-family:var(--font-mono);font-size:0.9em">zerops.yml</code>, live <strong>zcli</strong> provisioning on your Zerops account, health audits, and a real URL.</p>
        <div class="cta-row">
          <a class="btn-primary btn-press" href="/login">Deploy with your PAT</a>
          <a class="btn-ghost btn-press" href="#how">Watch the pipeline</a>
        </div>
        <p class="muted" style="margin-top:16px;font-size:12px;font-family:var(--font-mono)">Live host: studio-2cbd-3000.prg1.zerops.app</p>
      </div>
      <div class="hero-aside reveal">
        ${pipelineMarkup()}
      </div>
    </section>

    <section class="section" id="how">
      <h2 class="reveal">How it works</h2>
      <p class="sub reveal">Motion on this page is the product: each beat is a real stage of the Studio pipeline — not a decorative background.</p>
      <div class="steps reveal-stagger">
        <article class="step reveal"><div class="step-num">01</div><h3>Describe</h3><p>Pick a template or write a prompt. Studio captures intent — no Dockerfiles by hand.</p></article>
        <article class="step reveal"><div class="step-num">02</div><h3>Synthesize</h3><p>Generate multi-service code + import YAML for app, API, worker, Postgres, Valkey.</p></article>
        <article class="step reveal"><div class="step-num">03</div><h3>Provision</h3><p>Run <code style="font-family:var(--font-mono)">zcli project-import</code> with your PAT. Stream build logs over WebSocket.</p></article>
        <article class="step reveal"><div class="step-num">04</div><h3>Verify</h3><p>Health audits probe the live URL and services. Open the verified Zerops subdomain.</p></article>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <h2 class="reveal">Templates</h2>
      <p class="sub reveal">Three polyglot stacks ready for one-click deploy in Studio.</p>
      <div class="templates reveal-stagger">
        <article class="t-card reveal"><div class="step-num">🎬</div><h3>AI Video Clipper</h3><p>Next.js · Go API · Python Whisper · Postgres · Valkey</p><div class="t-mini"><span></span><span></span><span></span></div></article>
        <article class="t-card reveal"><div class="step-num">🛒</div><h3>E-Commerce</h3><p>Bun frontend · Go orders · Python recs · Postgres · Valkey</p><div class="t-mini"><span></span><span></span><span></span></div></article>
        <article class="t-card reveal"><div class="step-num">🧠</div><h3>RAG Search</h3><p>React · FastAPI · embedder · pgvector · Valkey</p><div class="t-mini"><span></span><span></span><span></span></div></article>
      </div>
    </section>

    <section class="section" style="padding-top:12px">
      <div class="reveal" style="border:1px solid var(--border);border-radius:var(--radius);padding:28px;background:var(--surface);display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between">
        <div>
          <h2 style="margin-bottom:8px">Open the factory floor</h2>
          <p class="muted" style="max-width:42ch">Sign in, paste your Zerops PAT, deploy a stack, and watch topology chips move from idle → building → healthy.</p>
        </div>
        <a class="btn-primary btn-press" href="/login">Enter Studio</a>
      </div>
    </section>

    <footer class="footer">
      <span>ZeroOps · Zerops Challenge · V${v.id} ${v.name}</span>
      <span>
        <a href="/preview">All variants</a> ·
        <a href="/preview/v${v.id}/login">Login skin</a> ·
        <a href="/preview/v${v.id}/studio">Studio shell</a> ·
        <a href="/studio">Production studio</a>
      </span>
    </footer>
  </div>
  <script src="/design/motion.js"></script>
  <script src="/design/pipeline.js"></script>
</body>
</html>`;
}

function loginHtml(v) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in · ZeroOps V${v.id}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${v.fonts}" rel="stylesheet" />
  <link rel="stylesheet" href="/design/tokens.css" />
  <link rel="stylesheet" href="/design/motion.css" />
  <link rel="stylesheet" href="theme.css" />
  <style>
    body { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card {
      width: min(420px, 100%); border: 1px solid var(--border); background: var(--surface);
      border-radius: calc(var(--radius) + 4px); padding: 28px; box-shadow: var(--shadow);
      opacity: 0; transform: translateY(12px) scale(0.98);
      animation: card-in var(--dur-panel) var(--ease-out) forwards;
    }
    @keyframes card-in { to { opacity: 1; transform: none; } }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; font-weight: 700; }
    .mark { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: var(--brand); color: var(--brand-ink); font-weight: 800; }
    h1 { font-family: var(--font-display); font-size: 1.75rem; line-height: 1.15; margin-bottom: 8px; }
    .sub { color: var(--text-2); font-size: 14px; line-height: 1.55; margin-bottom: 22px; }
    label { display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); margin-bottom: 6px; }
    input {
      width: 100%; margin-bottom: 12px; padding: 11px 12px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--surface-2); color: var(--text-1);
      font: 14px var(--font-body);
    }
    input:focus { outline: none; border-color: var(--brand); }
    button[type=submit] {
      width: 100%; margin-top: 6px; padding: 12px; border: 0; border-radius: 999px;
      background: var(--brand); color: var(--brand-ink); font-weight: 700; cursor: pointer; font-family: var(--font-body);
    }
    .toggle { margin-top: 14px; text-align: center; font-size: 13px; color: var(--text-3); }
    .toggle a { color: var(--brand); cursor: pointer; }
    .error {
      display: none; margin-bottom: 12px; padding: 8px 10px; border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
      background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); font-size: 13px;
    }
    .error.is-on { display: block; animation: shake 0.35s var(--ease-out); }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    .back { display: inline-block; margin-bottom: 16px; font-size: 12px; color: var(--text-3); text-decoration: none; }
    .variant-bar { margin-top: 18px; justify-content: center; }
    @media (prefers-reduced-motion: reduce) {
      .card { animation: none; opacity: 1; transform: none; }
      .error.is-on { animation: none; }
    }
  </style>
</head>
<body class="v${v.id}">
  <div class="card">
    <a class="back" href="/preview/v${v.id}/landing">← Back to landing</a>
    <div class="brand"><span class="mark">Z</span> ZeroOps</div>
    <h1>Enter the studio</h1>
    <p class="sub">Sign in to connect your Zerops PAT and deploy multi-service stacks with live zcli streaming.</p>
    <div class="error" id="login-error"></div>
    <form id="auth-form">
      <div id="name-field" style="display:none">
        <label for="name">Name</label>
        <input id="name" type="text" placeholder="Your name" />
      </div>
      <label for="email">Email</label>
      <input id="email" type="email" required placeholder="you@company.com" />
      <label for="password">Password</label>
      <input id="password" type="password" required placeholder="••••••••" />
      <button class="btn-press" type="submit" id="auth-btn">Sign In</button>
    </form>
    <div class="toggle">
      <span id="toggle-text">Don't have an account?</span>
      <a id="toggle-link">Create one</a>
    </div>
    <div class="variant-bar">${variantBar(v.id, 'login')}</div>
  </div>
  <script>
    let isSignup = false;
    document.getElementById('toggle-link').onclick = () => {
      isSignup = !isSignup;
      document.getElementById('name-field').style.display = isSignup ? 'block' : 'none';
      document.getElementById('auth-btn').textContent = isSignup ? 'Create Account' : 'Sign In';
      document.getElementById('toggle-text').textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
      document.getElementById('toggle-link').textContent = isSignup ? 'Sign in' : 'Create one';
      document.getElementById('login-error').classList.remove('is-on');
    };
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('login-error');
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
      const body = isSignup
        ? { email: email.value, password: password.value, name: name.value }
        : { email: email.value, password: password.value };
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) window.location.href = '/studio';
        else {
          errorEl.textContent = data.error || 'Auth failed';
          errorEl.classList.add('is-on');
        }
      } catch {
        errorEl.textContent = 'Connection error';
        errorEl.classList.add('is-on');
      }
    });
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) location.href = '/studio'; }).catch(() => {});
  </script>
</body>
</html>`;
}

function studioHtml(v) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Studio shell · ZeroOps V${v.id}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${v.fonts}" rel="stylesheet" />
  <link rel="stylesheet" href="/design/tokens.css" />
  <link rel="stylesheet" href="/design/motion.css" />
  <link rel="stylesheet" href="theme.css" />
  <style>
    body { min-height: 100vh; display: flex; flex-direction: column; }
    .top {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 18px; border-bottom: 1px solid var(--border); background: var(--surface);
    }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; }
    .mark { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; background: var(--brand); color: var(--brand-ink); font-size: 12px; font-weight: 800; }
    .status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); font-family: var(--font-mono); }
    .status i { width: 8px; height: 8px; border-radius: 50%; background: var(--text-3); display: inline-block; }
    .status.is-ready i { background: var(--ok); box-shadow: 0 0 8px color-mix(in srgb, var(--ok) 60%, transparent); }
    .layout { flex: 1; display: grid; min-height: 0; }
    @media (min-width: 900px) { .layout { grid-template-columns: 360px 1fr; } }
    .left, .right { border-right: 1px solid var(--border); padding: 16px; min-height: 280px; }
    .right { border-right: 0; display: flex; flex-direction: column; gap: 12px; }
    .welcome h2 { font-family: var(--font-display); font-size: 1.35rem; margin-bottom: 8px; }
    .welcome p { color: var(--text-2); font-size: 13px; line-height: 1.55; margin-bottom: 14px; }
    .tpl { display: grid; gap: 8px; }
    .tpl button {
      text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-1);
      border-radius: 10px; padding: 12px; cursor: pointer; font-family: var(--font-body);
      opacity: 0; transform: translateY(8px);
      animation: rise var(--dur-panel) var(--ease-out) forwards;
    }
    .tpl button:nth-child(2) { animation-delay: 60ms; }
    .tpl button:nth-child(3) { animation-delay: 120ms; }
    .tpl button:hover { border-color: var(--brand); }
    @keyframes rise { to { opacity: 1; transform: none; } }
    .term {
      flex: 1; font-family: var(--font-mono); font-size: 12px; line-height: 1.5;
      background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px; color: var(--text-2);
      min-height: 180px;
    }
    .topo { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding-top: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px;
      border: 1px solid var(--border); background: var(--surface-2); font-family: var(--font-mono); font-size: 11px; color: var(--text-2);
    }
    .chip .d { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); }
    .chip.building .d { background: var(--accent); animation: pulse-dot 0.9s ease-in-out infinite; }
    .chip.healthy .d { background: var(--ok); box-shadow: 0 0 8px color-mix(in srgb, var(--ok) 50%, transparent); }
    .note { font-size: 12px; color: var(--text-3); padding: 10px 18px; border-top: 1px solid var(--border); }
    .note a { color: var(--brand); }
    @media (prefers-reduced-motion: reduce) {
      .tpl button { animation: none; opacity: 1; transform: none; }
      .chip.building .d { animation: none; }
    }
  </style>
</head>
<body class="v${v.id}">
  <header class="top">
    <div class="brand"><span class="mark">Z</span> ZeroOps Studio · V${v.id}</div>
    <div class="status is-ready"><i></i> Ready · waiting for deploy</div>
    <div class="variant-bar">${variantBar(v.id, 'studio')}</div>
  </header>
  <div class="layout">
    <aside class="left welcome">
      <h2>What do you want to deploy?</h2>
      <p>Shell preview — production studio keeps real WS logs &amp; topology IDs. Motion shows idle → building → healthy on chips.</p>
      <div class="tpl">
        <button type="button" data-demo>🎬 AI Video Clipper</button>
        <button type="button" data-demo>🛒 E-Commerce</button>
        <button type="button" data-demo>🧠 RAG Search</button>
      </div>
    </aside>
    <main class="right">
      <div class="term" id="term">ZeroOps Studio shell ready.
Click a template to preview motion…</div>
      <div class="topo" id="topo">
        <div class="chip" data-n="0"><span class="d"></span>webapp</div>
        <span>→</span>
        <div class="chip" data-n="1"><span class="d"></span>apigateway</div>
        <span>→</span>
        <div class="chip" data-n="2"><span class="d"></span>aiworker</div>
        <span>⇄</span>
        <div class="chip" data-n="3"><span class="d"></span>dbpostgres</div>
        <span>⇄</span>
        <div class="chip" data-n="4"><span class="d"></span>cachevalkey</div>
      </div>
    </main>
  </div>
  <div class="note">Preview only. <a href="/studio">Open production studio</a> · <a href="/preview/v${v.id}/landing">Landing</a> · <a href="/preview">Gallery</a></div>
  <script>
    const term = document.getElementById('term');
    const chips = [...document.querySelectorAll('.chip')];
    async function demo() {
      chips.forEach(c => c.className = 'chip');
      term.textContent = '';
      const lines = ['[synth] generating stack…','[zcli] project-import','[zcli] build ok','[audit] probing…','[ok] healthy'];
      for (let i = 0; i < chips.length; i++) {
        chips[i].classList.add('building');
        term.textContent += lines[Math.min(i, lines.length-1)] + '\\n';
        await new Promise(r => setTimeout(r, 280));
      }
      chips.forEach(c => { c.classList.remove('building'); c.classList.add('healthy'); });
      term.textContent += 'Live URL ready.\\n';
    }
    document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', demo));
  </script>
</body>
</html>`;
}

// Write files
fs.mkdirSync(preview, { recursive: true });

const gallery = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZeroOps · Design variants</title>
  <link rel="stylesheet" href="/design/tokens.css" />
  <link rel="stylesheet" href="/design/motion.css" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    body {
      --bg:#070708; --surface:#121214; --border:#2a2a30; --text-1:#fafafa; --text-2:#a1a1aa; --brand:#c8f542; --brand-ink:#111;
      background: var(--bg); color: var(--text-1); font-family: 'IBM Plex Mono', monospace; min-height: 100vh; padding: 40px 20px;
    }
    .wrap { width: min(1000px, 100%); margin: 0 auto; }
    h1 { font-family: Syne, sans-serif; font-size: clamp(2rem, 5vw, 3rem); margin: 0 0 10px; }
    p { color: var(--text-2); max-width: 55ch; line-height: 1.6; margin-bottom: 28px; }
    .grid { display: grid; gap: 14px; }
    @media (min-width: 800px) { .grid { grid-template-columns: 1fr 1fr; } }
    a.card {
      display: block; text-decoration: none; color: inherit; border: 1px solid var(--border);
      background: var(--surface); border-radius: 14px; padding: 20px;
      transition: transform 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
    }
    a.card:hover { transform: translateY(-4px); border-color: var(--brand); }
    .tag { font-size: 11px; color: var(--brand); letter-spacing: 0.08em; text-transform: uppercase; }
    h2 { font-family: Syne, sans-serif; margin: 8px 0; font-size: 1.4rem; }
    .links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; font-size: 12px; }
    .links span { color: var(--text-2); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; }
    .top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .top a { color: var(--brand); }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>Design variants</h1>
        <p>Four full-funnel skins (landing · login · studio shell). Each landing runs the animated product pipeline. Pick one and we'll promote it to production <code>/</code>, <code>/login</code>, and <code>/studio</code>.</p>
      </div>
      <div><a href="/">← Production landing</a></div>
    </div>
    <div class="grid">
      ${VARIANTS.map(
        (v) => `<a class="card btn-press" href="/preview/v${v.id}/landing">
        <div class="tag">V${v.id} · ${v.tag}</div>
        <h2>${v.name}</h2>
        <p style="margin:0;font-size:13px">Landing with pipeline motion, login card motion, studio chip demo.</p>
        <div class="links">
          <span>Landing</span><span>Login</span><span>Studio shell</span>
        </div>
      </a>`
      ).join('\n')}
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(preview, 'index.html'), gallery);

for (const v of VARIANTS) {
  const dir = path.join(preview, `v${v.id}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'theme.css'), v.css.trim() + '\n');
  fs.writeFileSync(path.join(dir, 'landing.html'), landingHtml(v));
  fs.writeFileSync(path.join(dir, 'login.html'), loginHtml(v));
  fs.writeFileSync(path.join(dir, 'studio.html'), studioHtml(v));
}

// Production landing = V1 copy (can swap after pick)
const prodLanding = landingHtml(VARIANTS[0])
  .replaceAll('/preview/v1/landing', '/')
  .replaceAll('href="/preview/v1/login"', 'href="/login"')
  .replace(
    /<div class="variant-bar"[^>]*>[\s\S]*?<\/div>/,
    `<div class="variant-bar"><a href="/preview">Compare design variants →</a></div>`
  )
  .replace('theme.css', '/preview/v1/theme.css')
  .replace('<title>ZeroOps — Signal Deck (V1)</title>', '<title>ZeroOps — Prompt to multi-service stack on Zerops</title>');

fs.writeFileSync(path.join(root, 'landing.html'), prodLanding);

// Production login — V1 skin with real paths
const prodLogin = loginHtml(VARIANTS[0])
  .replaceAll('/preview/v1/landing', '/')
  .replace('theme.css', '/preview/v1/theme.css')
  .replace(
    /<div class="variant-bar">[\s\S]*?<\/div>/,
    `<div class="variant-bar"><a href="/preview">Design variants</a></div>`
  );
fs.writeFileSync(path.join(root, 'login.html'), prodLogin);

console.log('Generated preview v1–v4 + production landing/login (V1 default).');
