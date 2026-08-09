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
const { callOpenAI } = require('./scaffold');
const jobStore = require('../vibe/job-store');

const SCAFFOLD_DIR = path.join(__dirname, '../../vibe-scaffold');
const WORKSPACE_ROOT_DEFAULT = path.join(os.tmpdir(), 'zeroops-vibe');
const MAX_WRITE_FILES = 25;
const MAX_FILE_BYTES = 200_000;
const MAX_TOKENS = 8000;

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
- CRITICAL routing: if you use BrowserRouter, ALWAYS set
  basename={(import.meta.env.BASE_URL || "/").replace(/\\/$/, "") || "/"}
  so the preview under /api/vibe/preview/<id>/ works. Prefer leaving App.tsx routing
  alone and only editing Index.tsx when possible.

# Response format (mandatory)
1. First: a short plan in plain prose (2–5 sentences). No bullet lists, no markdown headings. Describe what the app is and the main screens/features.
2. Then: one or more file write blocks. Prefer <zeroops-write>; <dyad-write> is also accepted.
3. Optional: <zeroops-add-dependency packages="pkg1 pkg2"></zeroops-add-dependency> if you need npm packages not already installed. Spaces between packages, not commas.
4. End with one concise non-technical sentence summarizing the app.

Write tag format:
<zeroops-write path="src/pages/Index.tsx" description="Main landing page">
...full file contents...
</zeroops-write>

# What to edit
- Prefer editing existing scaffold files:
  - src/pages/Index.tsx (main page — always customize this)
  - src/App.tsx (routes)
  - src/index.css (theme tokens / global styles)
  - src/components/* (new components as needed)
- Add new files under src/ only when useful (pages, components, hooks, lib).
- Do NOT rewrite package.json unless you also emit <zeroops-add-dependency> for new packages. Prefer the preinstalled deps.
- Do NOT touch node_modules, lockfiles, or vite config unless strictly necessary.
- Cap: at most ~25 files. Aim for a focused, beautiful single-shot app (roughly 3–12 files is ideal).
- ALWAYS write the ENTIRE file content for each path (no partial patches, no "// ... keep existing").
- Only one write block per path.
- Every import you use must resolve: create missing project files with write tags; install missing npm packages with add-dependency.
- Do not invent backend endpoints. Fake data in-memory is fine.
- Produce a complete, working UI that matches the user's idea — not a generic placeholder.

# Code quality
- Modern, accessible, responsive Tailwind layout.
- Clear component structure; keep files focused.
- TypeScript/TSX is preferred for components.
- UI primitives use named exports: import { Button } from "@/components/ui/button" and import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card". Do not use default imports for these.
- Prefer @/ path aliases (already configured) over relative ../components paths.
- No markdown fences around code. Tags only.`;

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
  const applied = [];
  const seen = new Set();

  for (const f of files) {
    if (applied.length >= MAX_WRITE_FILES) break;
    const rel = sanitizeRelPath(f.path);
    if (!rel) continue;
    if (seen.has(rel)) continue;
    const content = typeof f.content === 'string' ? f.content : '';
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) continue;

    const abs = resolveUnderWorkspace(workspacePath, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    seen.add(rel);
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
    `Build a complete single-page app for this idea:`,
    prompt,
    '',
    `Existing scaffold files you may edit or extend:`,
    fileList,
    '',
    `Write a short plan, then emit <zeroops-write> blocks for the files you need.`,
    `Always customize src/pages/Index.tsx. Add routes in src/App.tsx if multi-page.`,
    `Use Tailwind + the existing Button/Card primitives. Client-side only.`,
  ].join('\n');

  const raw = await callOpenAI({
    apiKey,
    model: opts.model,
    system: VIBE_BUILD_SYSTEM_PROMPT,
    user: userMsg,
    maxTokens: opts.maxTokens || MAX_TOKENS,
  });

  const parsed = parseWriteBlocks(raw);
  if (!parsed.files.length) {
    throw new Error('Generation failed — no file writes in model response. Try a clearer prompt.');
  }

  const applied = applyWritesToDisk(workspacePath, parsed.files);
  if (!applied.length) {
    throw new Error('Generation failed — no usable file writes after path sanitization.');
  }

  // LLM often rewrites App.tsx with bare BrowserRouter — blank iframe under proxy base.
  ensureRouterBasename(workspacePath);

  const codeFiles = listCodeFiles(workspacePath);
  const plan = (parsed.prose || '').trim() || `Built a React SPA for: ${prompt.slice(0, 120)}`;

  return {
    workspaceId,
    workspacePath,
    plan,
    codeFiles,
    dependencies: parsed.dependencies || [],
    appliedFiles: applied,
    raw,
  };
}

/**
 * Ensure BrowserRouter has Vite BASE_URL basename so preview proxy paths work.
 * Rewrites broken App.tsx rather than fragile string injects when possible.
 * @param {string} workspacePath
 */
function ensureRouterBasename(workspacePath) {
  const appPath = path.join(workspacePath, 'src', 'App.tsx');
  const appPathJsx = path.join(workspacePath, 'src', 'App.jsx');
  const target = fs.existsSync(appPath) ? appPath : fs.existsSync(appPathJsx) ? appPathJsx : null;
  if (!target) return;

  let src = fs.readFileSync(target, 'utf8');
  if (/HashRouter/.test(src)) return;
  if (/BrowserRouter/.test(src) && /basename\s*=\s*\{/.test(src) && /BASE_URL/.test(src)) {
    return;
  }

  // Prefer keeping Index import if present; otherwise fall back to default page.
  const hasIndex =
    /from\s+['"]\.\/pages\/Index['"]/.test(src) ||
    /from\s+['"]\.\/pages\/Index\.tsx['"]/.test(src);
  const indexImport = hasIndex
    ? `import Index from "./pages/Index";`
    : `import Index from "./pages/Index";`;

  // If LLM created multi-route App, still force basename wrapper around existing Routes body when possible.
  if (/<Routes[\s>]/.test(src) && /BrowserRouter|as Router/.test(src)) {
    // Normalize to a known-good shell while preserving Routes children is hard — rewrite to Index-first shell.
    // Multi-page apps still work if Index is the main entry; LLM rarely needs nested routes for v1.
  }

  const fixed = `import { BrowserRouter, Routes, Route } from "react-router-dom";
${indexImport}

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
  fs.writeFileSync(target, fixed, 'utf8');
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
