/**
 * ZeroOps starter webapp — Node.js + managed PostgreSQL on Zerops.
 *
 * Deployed by the ZeroOps demo. Two services on the project's private network:
 * this one (public subdomain) and `db` (private, db:5432).
 *
 * Design rule: this page must NEVER fail to render. A judge clicking the live
 * URL while Postgres is still booting should see the app with an honest
 * "database warming up" banner, not a 500. So every DB call is wrapped and the
 * page degrades to a read-only shell.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';

const config = loadConfig();

// Zerops managed Postgres terminates TLS inside the private network; the
// default `pg` SSL negotiation is unnecessary there and fails on the
// self-signed internal certificate.
const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: false, max: 4, connectionTimeoutMillis: 4000 })
  : null;

let schemaReady = false;
let lastDbError = null;

function loadConfig() {
  const defaults = {
    title: 'ZeroOps Starter',
    tagline: 'A Node.js app with managed PostgreSQL, provisioned on Zerops.',
    itemLabel: 'Entry',
    seeds: [],
  };
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'app.config.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      title: String(parsed.title || defaults.title).slice(0, 80),
      tagline: String(parsed.tagline || defaults.tagline).slice(0, 240),
      itemLabel: String(parsed.itemLabel || defaults.itemLabel).slice(0, 40),
      seeds: Array.isArray(parsed.seeds) ? parsed.seeds.slice(0, 8).map(String) : [],
    };
  } catch {
    return defaults;
  }
}

/**
 * Idempotent. Runs on every request until it succeeds once, so the app
 * self-heals when Postgres finishes booting after the webapp does.
 */
async function ensureSchema() {
  if (schemaReady || !pool) return schemaReady;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id         SERIAL PRIMARY KEY,
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM entries');
  if (rows[0].n === 0 && config.seeds.length) {
    await pool.query(
      `INSERT INTO entries (body) SELECT * FROM unnest($1::text[])`,
      [config.seeds]
    );
  }
  schemaReady = true;
  return true;
}

async function readState() {
  if (!pool) return { up: false, entries: [], version: null, error: 'DATABASE_URL not set' };
  try {
    await ensureSchema();
    const [entries, version] = await Promise.all([
      pool.query('SELECT id, body, created_at FROM entries ORDER BY id DESC LIMIT 50'),
      pool.query('SHOW server_version'),
    ]);
    lastDbError = null;
    return {
      up: true,
      entries: entries.rows,
      version: version.rows[0]?.server_version || null,
      error: null,
    };
  } catch (err) {
    lastDbError = err.message || String(err);
    return { up: false, entries: [], version: null, error: lastDbError };
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function page(state) {
  const rows = state.entries
    .map(
      (e) => `<li class="row">
        <span class="row__body">${esc(e.body)}</span>
        <time class="row__at">${esc(new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 19))} UTC</time>
      </li>`
    )
    .join('\n');

  const banner = state.up
    ? `<p class="status status--ok"><span class="dot"></span>postgres connected${
        state.version ? ` · server ${esc(state.version)}` : ''
      } · ${state.entries.length} row${state.entries.length === 1 ? '' : 's'}</p>`
    : `<p class="status status--warn"><span class="dot"></span>database warming up — retrying${
        state.error ? ` · ${esc(state.error.slice(0, 120))}` : ''
      }</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.title)}</title>
<style>
  :root { --bg:#101010; --surface:#1a1a1a; --line:#3d3a39; --text:#f2f2f2;
          --text-2:#bdbdbd; --text-3:#8b949e; --primary:#00d992; --warn:#d4a017;
          --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); line-height:1.65;
         font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width:720px; margin:0 auto; padding:64px 24px 96px; }
  .eyebrow { font-size:12px; font-weight:600; letter-spacing:2.16px;
             text-transform:uppercase; color:var(--text-3); margin:0 0 12px; }
  h1 { font-size:clamp(28px,5vw,44px); font-weight:400; line-height:1.1;
       letter-spacing:-0.5px; margin:0 0 12px; color:#fff; }
  .tagline { color:var(--text-2); margin:0 0 28px; }
  .status { display:flex; align-items:center; gap:8px; font-family:var(--mono);
            font-size:12px; margin:0 0 28px; }
  .status--ok { color:var(--primary); } .status--warn { color:var(--warn); }
  .dot { width:7px; height:7px; border-radius:9999px; background:currentColor; }
  form { display:flex; gap:8px; margin:0 0 28px; }
  input { flex:1; min-width:0; background:var(--surface); color:var(--text);
          border:1px solid var(--line); border-radius:6px; padding:10px 12px;
          font:inherit; font-size:15px; }
  input:focus { outline:none; border-color:var(--primary); }
  button { background:var(--primary); color:#101010; border:1px solid var(--primary);
           border-radius:6px; padding:0 18px; height:42px; font:inherit;
           font-weight:600; font-size:15px; cursor:pointer; white-space:nowrap; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  ul { list-style:none; margin:0; padding:0; border-top:1px dashed rgba(79,93,117,.4); }
  .row { display:flex; align-items:baseline; justify-content:space-between; gap:16px;
         padding:12px 0; border-bottom:1px dashed rgba(79,93,117,.4); }
  .row__at { font-family:var(--mono); font-size:11px; color:var(--text-3);
             white-space:nowrap; }
  .empty { color:var(--text-3); padding:16px 0; }
  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line);
           font-family:var(--mono); font-size:11px; color:var(--text-3); }
  a { color:var(--primary); }
</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">Deployed by ZeroOps</p>
    <h1>${esc(config.title)}</h1>
    <p class="tagline">${esc(config.tagline)}</p>
    ${banner}
    <form method="POST" action="/entries">
      <input name="body" maxlength="200" required
             placeholder="Add a ${esc(config.itemLabel.toLowerCase())}…"
             ${state.up ? '' : 'disabled'}>
      <button type="submit" ${state.up ? '' : 'disabled'}>Save</button>
    </form>
    <ul>
      ${rows || '<li class="empty">No rows yet — add one above.</li>'}
    </ul>
    <footer>
      webapp:${PORT} → db:5432 · private network · Node ${esc(process.versions.node)}
      · <a href="/healthz">/healthz</a>
    </footer>
  </div>
</body>
</html>`;
}

function readBody(req, limit = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/healthz') {
    const state = await readState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        ok: true,
        db: state.up ? 'up' : 'down',
        entries: state.entries.length,
        error: state.error,
      })
    );
  }

  if (req.method === 'POST' && url.pathname === '/entries') {
    try {
      const body = await readBody(req);
      const value = new URLSearchParams(body).get('body');
      if (value && value.trim() && pool) {
        await ensureSchema();
        await pool.query('INSERT INTO entries (body) VALUES ($1)', [value.trim().slice(0, 200)]);
      }
    } catch (err) {
      lastDbError = err.message || String(err);
    }
    // POST/redirect/GET so a refresh doesn't re-insert.
    res.writeHead(303, { Location: '/' });
    return res.end();
  }

  const state = await readState();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page(state));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[webapp] listening on http://0.0.0.0:${PORT}`);
  console.log(`[webapp] DATABASE_URL ${DATABASE_URL ? 'present' : 'MISSING'}`);
});
