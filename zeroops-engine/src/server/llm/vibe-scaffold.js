/**
 * Vibe LLM scaffold — Dyad-style multi-file React+Vite SPA generation.
 *
 * Flow (Build only; Ship is separate):
 *   1. Mint workspace under os.tmpdir()/zeroops-vibe/<id>/
 *   2. Copy frozen src/vibe-scaffold/ tree (skip node_modules)
 *   3. Call OpenAI with BUILD-style system prompt → plan + <zeroops-write> blocks
 *   4. Path-sanitize + apply writes to disk
 *   5. Return plan + codeFiles map for Studio code panel
 *
 * Preview install/vite and Ship packaging are later phases; startBuildJob only
 * runs generate + job-store updates for now.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { parseWriteBlocks } = require('./write-protocol');
const { callOpenAIWithMeta } = require('./scaffold');
const syntaxCheck = require('./syntax-check');
const jobStore = require('../vibe/job-store');

const SCAFFOLD_DIR = path.join(__dirname, '../../vibe-scaffold');
const WORKSPACE_ROOT_DEFAULT = path.join(os.tmpdir(), 'zeroops-vibe');
const MAX_WRITE_FILES = 40;
const MAX_FILE_BYTES = 200_000;
/**
 * A whole app — several pages, components, hooks and state — does not fit in
 * 8k. On reasoning models this budget is also shared with hidden reasoning, so
 * anything tighter truncates mid-file and we lose the last write block.
 */
const MAX_TOKENS = 32_000;
/** Build quality over latency, but not so slow the demo stalls. */
const REASONING_EFFORT = process.env.VIBE_REASONING_EFFORT || 'medium';
/** Cap the repair fan-out: past this the generation is broken, not unlucky. */
const MAX_REPAIR_FILES = 4;

/** Key config files included in the code panel map alongside src/. */
const KEY_CONFIG_NAMES = new Set([
  'package.json',
  'index.html',
  'vite.config.ts',
  'vite.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
]);

const VIBE_BUILD_SYSTEM_PROMPT = `You are ZeroOps Vibe, an AI that turns a user's app idea into a polished React + Vite + Tailwind SPA.

The user will see a live preview of their app after you finish. You write complete files using structured tags — never shell commands, never markdown code fences for code.

# Stack (fixed)
- React 19 + TypeScript + Vite
- Tailwind CSS utility classes
- react-router-dom for routing
- lucide-react for icons
- Small UI primitives already in the scaffold:
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/lib/utils.ts (cn helper)
- Client-side SPA only. No backend, no API routes, no database, no Postgres, no env secrets.
- Use local React state / localStorage when the idea needs persistence.
- CRITICAL routing: use <BrowserRouter> from react-router-dom and ALWAYS set
  basename={(import.meta.env.BASE_URL || "/").replace(/\\/$/, "") || "/"}
  so the preview under /api/vibe/preview/<id>/ works. Do NOT use createBrowserRouter,
  and do NOT use HashRouter. Rewrite src/App.tsx with your real routes — keep the
  basename and keep the catch-all "*" route last.

# Response format (mandatory)
1. First: a short plan in plain prose (2–5 sentences). No bullet lists, no markdown headings. Describe what the app is and the main screens/features.
2. Then: one or more file write blocks. Prefer <zeroops-write>; <dyad-write> is also accepted.
3. Optional: <zeroops-add-dependency packages="pkg1 pkg2"></zeroops-add-dependency> if you need npm packages not already installed. Spaces between packages, not commas.
4. End with one concise non-technical sentence summarizing the app.

Write tag format:
<zeroops-write path="src/pages/Index.tsx" description="Main landing page">
...full file contents...
</zeroops-write>

# Build the WHOLE app, not a landing page
This is the only generation pass — whatever you write is what the user runs. A
single decorated page is a failure. Ship the product:
- Every core screen the idea implies, wired as real routes in src/App.tsx, reachable
  from persistent navigation (nav bar or sidebar) — never dead links.
- The full create / read / update / delete loop for the app's main entity, held in
  React state and persisted to localStorage so a refresh keeps the data.
- Real interactivity: forms with validation and error text, search/filter/sort where
  it makes sense, empty states, loading/disabled states, confirmation before destroy.
- Seed data that looks like a real account in use (8+ plausible records, not "Item 1").
- Shared layout, reusable components, and typed models in src/types.ts or similar —
  not one giant file.

# What to edit
- Existing scaffold files you should customize:
  - src/pages/Index.tsx (main page — always customize this)
  - src/App.tsx (routes — rewrite with your real route table)
  - src/index.css (theme tokens / global styles — give the app its own look)
  - src/components/* (new components as needed)
- Add new files under src/ freely: pages/, components/, hooks/, lib/, types.
- Do NOT rewrite package.json unless you also emit <zeroops-add-dependency> for new packages. Prefer the preinstalled deps.
- Do NOT touch node_modules, lockfiles, or vite config unless strictly necessary.
- Budget: up to 40 files. Aim for 10–20 files — that is the size of a real app.
  Files past the cap are dropped, so write the important ones first.
- ALWAYS write the ENTIRE file content for each path (no partial patches, no "// ... keep existing").
- Only one write block per path.
- Every import you use must resolve: create missing project files with write tags; install missing npm packages with add-dependency.
- Do not invent backend endpoints. Fake data in-memory is fine.
- No TODOs, no "coming soon" panels, no stubbed handlers — every button you render must do something.

# Code quality
- Write normally formatted code: one statement per line, JSX children on their own
  lines, indented. Do NOT minify or pack a component onto a single long line —
  compressed JSX is where unbalanced braces and syntax errors come from, and a
  file that does not parse takes the whole preview down.
- Modern, accessible, responsive Tailwind layout.
- Clear component structure; keep files focused.
- TypeScript/TSX is preferred for components.
- UI primitives use named exports: import { Button } from "@/components/ui/button" and import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card". Do not use default imports for these.
- Prefer @/ path aliases (already configured) over relative ../components paths.
- The shared layout must render its page content, and the two ways of wrapping
  pages are not interchangeable. If App.tsx writes <Layout><Routes>…</Routes></Layout>,
  Layout takes { children } and renders {children}. If it writes
  <Route element={<Layout />}> with nested routes, Layout renders <Outlet />.
  Safest: have Layout accept optional children and render {children ?? <Outlet />}.
- No markdown fences around code. Tags only.`;

const VIBE_REPAIR_SYSTEM_PROMPT = `You fix one broken source file (TypeScript, TSX or CSS) in a React 19 + Vite + Tailwind app.

You are given the file's path, the exact build error, and its current contents.
Return the COMPLETE corrected file — same path, same intent, same features — with
the error fixed. Do not redesign it, do not drop functionality, do not leave
placeholders, and do not add imports beyond what the fix needs.

Two kinds of error show up here:
- Parse errors: an unbalanced brace or parenthesis, or a stray non-code artifact
  such as a trailing "EOF" line or a closing "</style>" tag. Delete the artifact,
  balance the delimiters.
- Import errors: this file imports a binding the other module does not export —
  usually a default import of a named export. Fix THIS file's import to match the
  exports listed below. Never invent an export that isn't there.
- Layout contract errors: a shell component is called one way and written the
  other, so the page area renders empty. Make the shell work either way: accept
  an optional \`children\` prop and render \`{children ?? <Outlet />}\` where the
  page content belongs. Keep the chrome (nav, header, sidebar) exactly as is.

Emit only valid source — nothing that isn't code.

Respond with exactly one block and nothing else — no prose, no code fences:

<zeroops-write path="THE SAME PATH">
...full corrected file...
</zeroops-write>

Write normally formatted code: one statement per line, JSX children on their own
indented lines. Never minify.`;

/**
 * For an import error, quote the other module's actual export lines.
 *
 * Without them the model is guessing at what it should have imported, and
 * guessing is how the mismatch happened in the first place.
 *
 * @param {string} workspacePath
 * @param {string} message  esbuild error text, which names the module in quotes
 * @returns {string} empty when the error isn't about another module
 */
function describeReferencedExports(workspacePath, message) {
  const quoted = String(message || '').match(/"([^"]+\.(?:tsx?|jsx?))"/);
  if (!quoted) return '';

  const rel = sanitizeRelPath(quoted[1]);
  if (!rel) return '';

  let source;
  try {
    source = fs.readFileSync(resolveUnderWorkspace(workspacePath, rel), 'utf8');
  } catch {
    return '';
  }

  const exports = source
    .split('\n')
    .filter((line) => /^\s*export\b/.test(line))
    .map((line) => line.trim().slice(0, 160));

  return exports.length
    ? [`Exports actually declared by ${rel}:`, ...exports.map((e) => `  ${e}`)].join('\n')
    : `${rel} declares no exports at all.`;
}

/**
 * Ask the model to fix files that failed to parse, and rewrite them in place.
 *
 * Runs concurrently — each repair is one small independent call, and a build
 * that stalls is nearly as bad for a demo as one that breaks.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} [opts.model]
 * @param {string} opts.workspacePath
 * @param {import('./syntax-check').SyntaxProblem[]} opts.problems
 * @returns {Promise<{ repaired: string[], remaining: object[] }>}
 */
async function repairBrokenFiles(opts) {
  const targets = (opts.problems || []).slice(0, MAX_REPAIR_FILES);
  if (!targets.length) return { repaired: [], remaining: [] };

  const results = await Promise.all(
    targets.map(async (problem) => {
      const abs = resolveUnderWorkspace(opts.workspacePath, problem.path);
      let current;
      try {
        current = fs.readFileSync(abs, 'utf8');
      } catch {
        return { problem, fixed: false };
      }

      const user = [
        `Path: ${problem.path}`,
        `Build error: ${problem.message}${problem.line ? ` (line ${problem.line})` : ''}`,
        problem.snippet ? `Offending line: ${problem.snippet}` : '',
        describeReferencedExports(opts.workspacePath, problem.message),
        '',
        'Current contents:',
        current,
      ]
        .filter(Boolean)
        .join('\n');

      let raw;
      try {
        const res = await callOpenAIWithMeta({
          apiKey: opts.apiKey,
          model: opts.model,
          system: VIBE_REPAIR_SYSTEM_PROMPT,
          user,
          maxTokens: MAX_TOKENS,
          reasoningEffort: 'low',
        });
        raw = res.content;
      } catch {
        return { problem, fixed: false };
      }

      const parsed = parseWriteBlocks(raw);
      // Prefer the block that names this path; a lone unlabelled block is still
      // unambiguous, since we asked about exactly one file.
      const block =
        parsed.files.find((f) => sanitizeRelPath(f.path) === problem.path) ||
        (parsed.files.length === 1 ? parsed.files[0] : null);
      if (!block || typeof block.content !== 'string' || !block.content.trim()) {
        return { problem, fixed: false };
      }

      // Only accept a fix that actually parses — otherwise keep the original,
      // whose error we can at least report accurately.
      const stillBroken = syntaxCheck.checkSource(problem.path, block.content);
      if (stillBroken) return { problem: stillBroken, fixed: false };

      fs.writeFileSync(abs, block.content, 'utf8');
      return { problem, fixed: true };
    }),
  );

  return {
    repaired: results.filter((r) => r.fixed).map((r) => r.problem.path),
    remaining: [
      ...results.filter((r) => !r.fixed).map((r) => r.problem),
      // Anything past the cap was never attempted; report it rather than hide it.
      ...(opts.problems || []).slice(MAX_REPAIR_FILES),
    ],
  };
}

/**
 * @param {string} root
 * @param {string} [prefix]
 * @param {Record<string, string>} [out]
 */
function readTree(root, prefix = '', out = {}) {
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }
    const abs = path.join(root, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) readTree(abs, rel, out);
    else {
      try {
        out[rel] = fs.readFileSync(abs, 'utf8');
      } catch {
        // skip unreadable binaries
      }
    }
  }
  return out;
}

/**
 * Copy scaffold tree into workspace, skipping node_modules / .git / dist.
 * @param {string} src
 * @param {string} dest
 */
function copyScaffoldTree(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Vibe scaffold not found at ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyScaffoldTree(from, to);
    } else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

/**
 * Sanitize a relative write path: no absolute, no .., posix separators.
 * @param {string} raw
 * @returns {string|null}
 */
function sanitizeRelPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let p = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!p) return null;
  if (p.includes('\0')) return null;
  const parts = p.split('/').filter((seg) => seg && seg !== '.');
  if (parts.some((seg) => seg === '..')) return null;
  if (parts[0] === 'node_modules') return null;
  return parts.join('/');
}

/**
 * Resolve a sanitized relative path under workspace; throws if it escapes.
 * @param {string} workspacePath
 * @param {string} rel
 */
function resolveUnderWorkspace(workspacePath, rel) {
  const root = path.resolve(workspacePath);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Path escapes workspace: ${rel}`);
  }
  return abs;
}

/**
 * Apply parsed write blocks to disk under workspacePath.
 * @param {string} workspacePath
 * @param {Array<{path:string, content:string}>} files
 * @returns {Array<{path:string, content:string}>} applied files (sanitized paths)
 */
function applyWritesToDisk(workspacePath, files) {
  // Models revise: when the same path is written twice, the later block is the
  // corrected one, so last-wins. Map keeps first-seen order for the cap, so the
  // file's position in the response — not its revision — decides what survives.
  const byPath = new Map();

  for (const f of files) {
    const rel = sanitizeRelPath(f.path);
    if (!rel) continue;
    const content = typeof f.content === 'string' ? f.content : '';
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) continue;
    byPath.set(rel, content);
  }

  const applied = [];
  for (const [rel, content] of byPath) {
    if (applied.length >= MAX_WRITE_FILES) break;
    const abs = resolveUnderWorkspace(workspacePath, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    applied.push({ path: rel, content });
  }
  return applied;
}

/**
 * Collect src/** and key config files for the Studio code panel.
 * @param {string} workspacePath
 * @returns {Record<string, string>}
 */
function listCodeFiles(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) return {};
  const out = {};
  const srcDir = path.join(workspacePath, 'src');
  if (fs.existsSync(srcDir)) {
    readTree(srcDir, 'src', out);
  }
  for (const name of KEY_CONFIG_NAMES) {
    const abs = path.join(workspacePath, name);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      try {
        out[name] = fs.readFileSync(abs, 'utf8');
      } catch {
        // ignore
      }
    }
  }
  return out;
}

/**
 * Generate a vibe app from a user prompt (sync helper: LLM + disk only).
 *
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} opts.apiKey OpenAI API key (required)
 * @param {string} [opts.workspaceRoot] Override parent dir for workspaces
 * @param {string} [opts.model]
 * @param {string} [opts.scaffoldDir]
 * @returns {Promise<{
 *   workspaceId: string,
 *   workspacePath: string,
 *   plan: string,
 *   codeFiles: Record<string, string>,
 *   dependencies: string[],
 *   appliedFiles: Array<{path:string, content:string}>,
 *   raw: string,
 * }>}
 */
async function generateVibeApp(opts = {}) {
  const prompt = String(opts.prompt || '').trim();
  const apiKey = opts.apiKey;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY required');
    err.code = 'OPENAI_API_KEY_REQUIRED';
    err.status = 503;
    throw err;
  }
  if (!prompt) {
    throw new Error('prompt is required');
  }

  const workspaceRoot = opts.workspaceRoot || WORKSPACE_ROOT_DEFAULT;
  const scaffoldDir = opts.scaffoldDir || SCAFFOLD_DIR;
  const workspaceId = crypto.randomBytes(12).toString('hex');
  const workspacePath = path.join(workspaceRoot, workspaceId);

  fs.mkdirSync(workspacePath, { recursive: true });
  copyScaffoldTree(scaffoldDir, workspacePath);

  const existingSrc = listCodeFiles(workspacePath);
  const fileList = Object.keys(existingSrc).sort().join('\n') || '(empty scaffold)';

  const userMsg = [
    `Build the complete app for this idea:`,
    prompt,
    '',
    `Existing scaffold files you may edit or extend:`,
    fileList,
    '',
    `Write a short plan, then emit <zeroops-write> blocks for every file the app needs.`,
    `Build all the screens the idea implies, wire them as routes in src/App.tsx behind`,
    `persistent navigation, and implement the full data loop (create, edit, delete,`,
    `persist to localStorage) with realistic seed data — not a single static page.`,
    `Use Tailwind + the existing Button/Card primitives. Client-side only.`,
  ].join('\n');

  const {
    content: raw,
    finishReason,
    usage,
  } = await callOpenAIWithMeta({
    apiKey,
    model: opts.model,
    system: VIBE_BUILD_SYSTEM_PROMPT,
    user: userMsg,
    maxTokens: opts.maxTokens || MAX_TOKENS,
    reasoningEffort: opts.reasoningEffort || REASONING_EFFORT,
  });

  const parsed = parseWriteBlocks(raw);
  if (!parsed.files.length) {
    // On reasoning models an exhausted budget returns an empty string, not an
    // error — say which of the two happened instead of blaming the prompt.
    if (finishReason === 'length') {
      throw new Error(
        `Generation ran out of token budget before writing any files (used ${
          usage.completion_tokens || 0
        } of ${opts.maxTokens || MAX_TOKENS}). Try a simpler prompt or raise MAX_TOKENS.`,
      );
    }
    throw new Error('Generation failed — no file writes in model response. Try a clearer prompt.');
  }

  const applied = applyWritesToDisk(workspacePath, parsed.files);
  if (!applied.length) {
    throw new Error('Generation failed — no usable file writes after path sanitization.');
  }

  // LLM often rewrites App.tsx with a bare BrowserRouter — blank iframe under
  // the proxy base. Patch the basename in; never discard its routes.
  ensureRouterBasename(workspacePath);

  // A whole app is more code and more chances to drop a brace or default-import
  // a named export. Catch both here, where one cheap call can fix them, rather
  // than in the preview iframe.
  const repair = await verifyAndRepair({
    apiKey,
    model: opts.model,
    workspacePath,
    applied,
  });

  const codeFiles = listCodeFiles(workspacePath);
  const plan = (parsed.prose || '').trim() || `Built a React SPA for: ${prompt.slice(0, 120)}`;

  return {
    workspaceId,
    workspacePath,
    plan,
    codeFiles,
    dependencies: parsed.dependencies || [],
    appliedFiles: applied,
    repairedFiles: repair.repaired,
    syntaxErrors: repair.remaining,
    truncated: finishReason === 'length',
    raw,
  };
}

/** App.tsx can arrive from both the write list and the router patch. */
function dedupeProblems(problems) {
  const seen = new Set();
  return problems.filter((p) => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });
}

/** Resolve a component imported by `src/App.tsx` to a workspace-relative file. */
function resolveComponentFile(workspacePath, appSource, name) {
  const importRe = new RegExp(
    `import\\s+(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name})\\s+from\\s*['"]([^'"]+)['"]`,
  );
  const hit = appSource.match(importRe);
  if (!hit) return null;

  const spec = hit[1];
  let rel;
  if (spec.startsWith('@/')) rel = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) rel = path.posix.join('src', spec.replace(/^\.\//, ''));
  else return null; // a package, not our source

  for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
    const candidate = sanitizeRelPath(rel + ext);
    if (!candidate) continue;
    try {
      const abs = resolveUnderWorkspace(workspacePath, candidate);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return candidate;
    } catch {
      // keep trying
    }
  }
  return null;
}

/**
 * Catch a shell component that is called one way and written the other.
 *
 * React Router gives two ways to wrap pages in a layout, and the model picks one
 * in App.tsx and sometimes the other in the layout file itself:
 *
 *   <Layout><Routes>…</Routes></Layout>   needs the layout to render {children}
 *   <Route element={<Layout />}>…</Route>  needs the layout to render <Outlet />
 *
 * Mismatch them and the chrome renders perfectly while every page body is empty
 * — no parse error, no link error, no console error, just a blank app. Neither
 * of the other passes can see it, because both files are individually valid.
 *
 * @param {string} workspacePath
 * @returns {import('./syntax-check').SyntaxProblem[]}
 */
function checkLayoutContract(workspacePath) {
  let app;
  try {
    app = fs.readFileSync(path.join(workspacePath, 'src', 'App.tsx'), 'utf8');
  } catch {
    return [];
  }

  /** @type {Array<{name: string, needs: 'children'|'outlet'}>} */
  const usages = [];

  // <Layout> … <Routes> — the layout is handed its pages as children.
  const wrapper = app.match(/<([A-Z]\w*)\b[^>]*>\s*<Routes\b/);
  if (wrapper) usages.push({ name: wrapper[1], needs: 'children' });

  // <Route element={<Layout />}> with routes nested inside — pages arrive via Outlet.
  const layoutRouteRe = /<Route\b(?![^>]*\/>)[^>]*element=\{\s*<([A-Z]\w*)[^>]*\/>\s*\}[^>]*>([\s\S]{0,400})/g;
  let m;
  while ((m = layoutRouteRe.exec(app)) !== null) {
    if (/<Route\b/.test(m[2])) usages.push({ name: m[1], needs: 'outlet' });
  }

  const problems = [];
  const seen = new Set();
  for (const { name, needs } of usages) {
    if (seen.has(name)) continue;
    seen.add(name);

    const rel = resolveComponentFile(workspacePath, app, name);
    if (!rel) continue;

    let source;
    try {
      source = fs.readFileSync(resolveUnderWorkspace(workspacePath, rel), 'utf8');
    } catch {
      continue;
    }

    const rendersOutlet = /<Outlet\b/.test(source);
    const rendersChildren = /\bchildren\b/.test(source);
    if (needs === 'children' ? rendersChildren : rendersOutlet) continue;
    // A shell that renders neither is a different bug; leave it alone rather
    // than guess where its page content was meant to go.
    if (!rendersOutlet && !rendersChildren) continue;

    problems.push({
      path: rel,
      message:
        needs === 'children'
          ? `Layout contract: src/App.tsx renders <${name}><Routes>…</Routes></${name}>, so ${name} receives its page content as \`children\`. ${name} renders <Outlet /> instead and never renders \`children\`, so every page body is blank.`
          : `Layout contract: src/App.tsx renders <Route element={<${name} />}> with nested routes, so ${name} receives its page content through <Outlet />. ${name} renders \`children\` instead, which is never passed, so every page body is blank.`,
      line: 0,
      snippet: '',
    });
  }

  return problems;
}

/**
 * Three verification passes, each with its own repair round:
 *
 *   1. per-file parse — a dropped brace, a stray `EOF` or `</style>` line
 *   2. whole-app link — a default import of a named export, a missing module
 *   3. layout contract — children/Outlet mismatch that renders a blank page area
 *
 * They run in this order because a file that does not parse cannot be linked,
 * and the link pass re-runs after repairs so a fix that breaks a different
 * import still gets reported. The contract pass runs last: it reads the shapes
 * of files that by then are known to parse and link.
 *
 * @param {{ apiKey: string, model?: string, workspacePath: string, applied: Array<{path:string}> }} opts
 * @returns {Promise<{ repaired: string[], remaining: object[] }>}
 */
async function verifyAndRepair(opts) {
  const repaired = [];

  const parseProblems = dedupeProblems(
    syntaxCheck.checkFiles(opts.workspacePath, [
      ...opts.applied,
      // ensureRouterBasename may have rewritten App.tsx after the fact.
      { path: 'src/App.tsx' },
    ]),
  );

  let remaining = [];
  if (parseProblems.length) {
    const round = await repairBrokenFiles({ ...opts, problems: parseProblems });
    repaired.push(...round.repaired);
    remaining = round.remaining;
  }

  // Link-check whatever the files look like now, including any repairs.
  const linkProblems = dedupeProblems(await syntaxCheck.checkBundle(opts.workspacePath));
  if (linkProblems.length) {
    const round = await repairBrokenFiles({ ...opts, problems: linkProblems });
    repaired.push(...round.repaired);

    // A repaired importer can still not link — re-check rather than assume.
    const stillBroken = round.repaired.length
      ? await syntaxCheck.checkBundle(opts.workspacePath)
      : round.remaining;
    remaining = [...remaining, ...dedupeProblems(stillBroken)];
  }

  const contractProblems = checkLayoutContract(opts.workspacePath);
  if (contractProblems.length) {
    const round = await repairBrokenFiles({ ...opts, problems: contractProblems });
    repaired.push(...round.repaired);
    // Re-read the shapes: a fix that satisfies neither side is still a blank app.
    remaining = [
      ...remaining,
      ...(round.repaired.length ? checkLayoutContract(opts.workspacePath) : round.remaining),
    ];
  }

  return { repaired, remaining };
}

const BASENAME_DECL = `// Required for preview under /api/vibe/preview/<id>/ (Vite BASE_URL).
const basename = (import.meta.env.BASE_URL || "/").replace(/\\/$/, "") || "/";`;

/** Insert a snippet after the last top-level import so JSX below can use it. */
function insertAfterImports(src, snippet) {
  const importRe = /^\s*import[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*$/gm;
  let last = null;
  let m;
  while ((m = importRe.exec(src)) !== null) last = m;
  if (!last) return `${snippet}\n\n${src}`;
  const at = last.index + last[0].length;
  return `${src.slice(0, at)}\n\n${snippet}${src.slice(at)}`;
}

/**
 * Ensure the app's router carries the Vite BASE_URL basename, so routes match
 * under /api/vibe/preview/<id>/ instead of rendering a blank iframe.
 *
 * This patches the file the model wrote — it never replaces it. An earlier
 * version rewrote App.tsx to a canned Index-only shell, which silently deleted
 * every extra page of a multi-route app moments after generating it.
 *
 * @param {string} workspacePath
 */
function ensureRouterBasename(workspacePath) {
  const appPath = path.join(workspacePath, 'src', 'App.tsx');
  const appPathJsx = path.join(workspacePath, 'src', 'App.jsx');
  const target = fs.existsSync(appPath) ? appPath : fs.existsSync(appPathJsx) ? appPathJsx : null;
  if (!target) {
    // The scaffold ships App.tsx, so this only happens if generation removed it.
    fs.writeFileSync(appPath, defaultAppShell(), 'utf8');
    return;
  }

  let src = fs.readFileSync(target, 'utf8');

  // HashRouter needs no basename — everything after the # is already relative.
  if (/HashRouter/.test(src)) return;
  // Already wired to BASE_URL (untouched scaffold, or a compliant model).
  if (/basename\s*[=:]\s*\{?[^}\n]*BASE_URL/.test(src)) return;

  // BrowserRouter is often aliased: import { BrowserRouter as Router }.
  const named = src.match(/import\s*\{([^}]*)\}\s*from\s*['"]react-router-dom['"]/);
  const alias = named && named[1].match(/\bBrowserRouter\b(?:\s+as\s+(\w+))?/);
  const tag = alias
    ? alias[1] || 'BrowserRouter'
    : /<BrowserRouter[\s/>]/.test(src)
      ? 'BrowserRouter'
      : null;
  const usesDataRouter = /createBrowserRouter\s*\(/.test(src);

  // No browser router at all (App renders a page directly) — nothing to fix.
  if (!tag && !usesDataRouter) return;

  // Collected and inserted once, so the basename declaration stays above the
  // helper that closes over it.
  const preamble = [];
  if (!/\bconst\s+basename\s*=/.test(src)) preamble.push(BASENAME_DECL);

  if (tag) {
    // Drop any non-BASE_URL basename the model guessed at, then add ours.
    src = src.replace(new RegExp(`<${tag}(\\s[^>]*?)?(/?)>`), (_full, attrs, selfClose) => {
      const cleaned = (attrs || '').replace(/\s+basename\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/, '');
      return `<${tag}${cleaned} basename={basename}${selfClose ? ' /' : ''}>`;
    });
  } else {
    // Data router: wrap the call instead of regex-matching balanced parens
    // around a route array that can run to hundreds of lines.
    src = src.replace(/createBrowserRouter\s*\(/g, 'createBrowserRouterWithBase(');
    preamble.push(
      `const createBrowserRouterWithBase = (routes, opts) =>\n  createBrowserRouter(routes, { ...opts, basename });`,
    );
  }

  if (preamble.length) src = insertAfterImports(src, preamble.join('\n\n'));

  fs.writeFileSync(target, src, 'utf8');
}

/**
 * Last-resort App.tsx when the model wrote none — kept as a template string so
 * ensureRouterBasename never has to invent one over a file that exists.
 */
function defaultAppShell() {
  return `import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

// Required for preview under /api/vibe/preview/<id>/ (Vite BASE_URL).
const basename = (import.meta.env.BASE_URL || "/").replace(/\\/$/, "") || "/";

const App = () => (
  <BrowserRouter basename={basename}>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center p-8">
            <p className="text-gray-500">Page not found</p>
          </div>
        }
      />
    </Routes>
  </BrowserRouter>
);

export default App;
`;
}

/**
 * Create a job (status=queued) and kick off generateVibeApp asynchronously.
 * Preview/install stages are left for the Preview phase; this only fills
 * plan + codeFiles and leaves status at 'generating' → ready-for-preview
 * placeholder, or 'failed'.
 *
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} [opts.apiKey]
 * @param {string} [opts.workspaceRoot]
 * @returns {{ jobId: string }}
 */
function startBuildJob(opts = {}) {
  const prompt = String(opts.prompt || '').trim();
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY || '';
  const jobId = jobStore.create({ prompt });

  jobStore.append(jobId, { type: 'stage', stage: 'queued', message: 'Build job created' });

  // Detached async pipeline (generate only; install/preview wired later).
  setImmediate(() => {
    runGenerateStage(jobId, { prompt, apiKey, workspaceRoot: opts.workspaceRoot }).catch((err) => {
      const message = err && err.message ? err.message : String(err);
      jobStore.finish(jobId, { type: 'error', error: message }, {
        status: 'failed',
        error: message,
      });
    });
  });

  return { jobId };
}

/**
 * @param {string} jobId
 * @param {{ prompt: string, apiKey: string, workspaceRoot?: string }} opts
 */
async function runGenerateStage(jobId, opts) {
  if (!opts.apiKey) {
    const message = 'OPENAI_API_KEY required';
    jobStore.finish(
      jobId,
      { type: 'error', error: message, code: 'OPENAI_API_KEY_REQUIRED', status: 503 },
      { status: 'failed', error: message },
    );
    return;
  }

  jobStore.update(jobId, { status: 'generating' });
  jobStore.append(jobId, { type: 'stage', stage: 'generating', message: 'Calling model…' });

  const result = await generateVibeApp({
    prompt: opts.prompt,
    apiKey: opts.apiKey,
    workspaceRoot: opts.workspaceRoot,
  });

  jobStore.update(jobId, {
    status: 'generating',
    workspaceId: result.workspaceId,
    workspacePath: result.workspacePath,
    plan: result.plan,
    codeFiles: result.codeFiles,
    dependencies: result.dependencies,
  });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'generated',
    message: `Wrote ${result.appliedFiles.length} file(s)`,
    workspaceId: result.workspaceId,
    fileCount: result.appliedFiles.length,
  });

  // Preview phase will advance install → preview → ready. For now mark done
  // of generate-only path with status that later stages can pick up.
  // Leave job open (done=false) so install/preview can continue; if callers
  // only need generate, they can treat status+workspaceId as success.
  // Spec: pipeline stages later wired by Preview — keep job in-flight.
  jobStore.update(jobId, {
    // 'installing' is the natural next stage; leave at generated-ish status.
    // Use 'generating' complete signal via event; status stays open for preview.
    status: 'installing',
  });
  jobStore.append(jobId, {
    type: 'stage',
    stage: 'awaiting_preview',
    message: 'Generation complete — install/preview not started yet',
  });
}

module.exports = {
  generateVibeApp,
  startBuildJob,
  listCodeFiles,
  copyScaffoldTree,
  applyWritesToDisk,
  ensureRouterBasename,
  defaultAppShell,
  repairBrokenFiles,
  checkLayoutContract,
  syntaxCheck,
  MAX_REPAIR_FILES,
  sanitizeRelPath,
  resolveUnderWorkspace,
  runGenerateStage,
  VIBE_BUILD_SYSTEM_PROMPT,
  SCAFFOLD_DIR,
  WORKSPACE_ROOT_DEFAULT,
  MAX_WRITE_FILES,
  MAX_FILE_BYTES,
  jobStore,
};
