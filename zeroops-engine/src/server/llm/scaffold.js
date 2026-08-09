/**
 * LLM scaffold orchestrator.
 * Prompt patterns adapted from:
 *  - Dyad BUILD_SYSTEM_PREFIX (structured file writes, concise plan)
 *  - open-lovable generate-ai-code-stream (surgical edits, conversation bounds)
 *
 * OpenAI-only. Uses fetch (no SDK) so we stay dep-light.
 *
 * What this returns is DEPLOYABLE, not decorative: `codeFiles` is the complete
 * file tree that gets written to disk and handed to `zcli push`. The LLM's job
 * is narrow by design — it rewrites `webapp/app.config.json` (the app's title,
 * tagline and seed rows) so the running app reflects the user's prompt. It does
 * not author server code, because a live demo cannot afford a syntax error.
 */

const fs = require('fs');
const path = require('path');
const { mapPromptToTemplate } = require('./template-mapper');
const { parseWriteBlocks, applyWritesToMap } = require('./write-protocol');

/**
 * The demo ships its own template directory, separate from `src/templates/`.
 * That one is the Studio library exposed at `/api/templates`, where every entry
 * is a 5-container stack; the demo's starter is deliberately two services, and
 * mixing them would put a 2-service entry into a catalog whose contract says
 * otherwise.
 */
const TEMPLATES_DIR = path.join(__dirname, '../../demo-templates');

/** The one file the LLM is allowed to write. Anything else is discarded. */
const FLAVOR_FILE = 'webapp/app.config.json';

const DEMO_SYSTEM_PROMPT = `You are ZeroOps, which turns a user's app idea into a real deployment on Zerops.

The stack is FIXED and you may not change it:
- webapp — Node.js 22, public HTTP on port 3000
- db — Zerops-managed PostgreSQL 16, private at db:5432

The application code is already written. Your ONLY job is to tailor its content
to the user's idea by writing exactly one file.

First give a short plan: 2-4 sentences, plain prose, no bullets, no markdown
headings. Say what the app will be and what the two services do for THIS idea.

Then emit exactly one block, in this format, containing STRICT JSON:

<zeroops-write path="${FLAVOR_FILE}" description="App content tailored to the user idea">
{
  "title": "Short app name, max 6 words",
  "tagline": "One sentence describing the app, max 20 words",
  "itemLabel": "Singular noun for one row the app stores, e.g. Task, Order, Note",
  "seeds": ["3 to 5 realistic starter rows", "written as plain strings", "specific to the user's idea"]
}
</zeroops-write>

Rules:
- The JSON must parse. No trailing commas, no comments, no code fences.
- Do NOT write any other file. Do NOT output server code.
- End with exactly one line: READY_FOR_ZEROPS`;

/**
 * Read every file under a directory into a { relativePath: content } map.
 */
function readTree(dir, prefix = '', out = {}) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) readTree(abs, rel, out);
    else out[rel] = fs.readFileSync(abs, 'utf8');
  }
  return out;
}

/**
 * Load template metadata, import spec, and the deployable file tree.
 */
function loadTemplate(templateId) {
  const dir = path.join(TEMPLATES_DIR, templateId);
  if (!fs.existsSync(dir)) return null;

  const metaPath = path.join(dir, 'template.json');
  const importPath = path.join(dir, 'zerops-import.yml');

  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : { name: templateId };
  const importYaml = fs.existsSync(importPath) ? fs.readFileSync(importPath, 'utf8') : '';

  // Everything under webapp/ is what `zcli push` uploads for that service.
  const codeFiles = readTree(path.join(dir, 'webapp'), 'webapp');

  return { id: templateId, meta, importYaml, codeFiles, dir };
}

/**
 * Zerops project names: lowercase alphanumerics and hyphens, must start with a
 * letter. A short suffix keeps repeated demo deploys distinguishable in the
 * dashboard (and makes quota cleanup obvious).
 */
function safeProjectName(prompt, fallback) {
  const slug = String(prompt || fallback || 'zeroops-app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '');

  // Truncate on a hyphen boundary so we get "task-tracker" rather than
  // "task-tracker-for-a-baker" — the name is visible in the Zerops dashboard.
  let base = slug;
  if (base.length > 24) {
    base = base.slice(0, 24);
    const cut = base.lastIndexOf('-');
    if (cut > 8) base = base.slice(0, cut);
  }
  base = base.replace(/-+$/, '') || 'zeroops-app';

  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

/** Default model for every OpenAI call in the engine. Override with OPENAI_MODEL. */
const DEFAULT_MODEL = 'gpt-5.6-luna';

/**
 * gpt-5+ and the o-series speak a different dialect of Chat Completions:
 * `max_tokens` is rejected outright (`max_completion_tokens` instead) and
 * `temperature` only accepts its default. Sending the legacy shape is a hard
 * 400, so pick the body per model rather than per call site.
 */
function isReasoningModel(model) {
  return /^(gpt-5|o[1-9])/i.test(String(model || ''));
}

/**
 * Call OpenAI Chat Completions and return the message plus the metadata a
 * caller needs to tell "the model finished" from "the model ran out of room" —
 * on reasoning models the token budget is shared with hidden reasoning, so a
 * too-small budget comes back as an empty string rather than an error.
 *
 * @returns {Promise<{ content: string, finishReason: string, usage: object, model: string }>}
 */
async function callOpenAIWithMeta({
  apiKey,
  model,
  system,
  user,
  maxTokens = 900,
  temperature = 0.4,
  reasoningEffort,
}) {
  const resolvedModel = model || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const body = {
    model: resolvedModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  if (isReasoningModel(resolvedModel)) {
    body.max_completion_tokens = maxTokens;
    const effort = reasoningEffort || process.env.OPENAI_REASONING_EFFORT;
    if (effort) body.reasoning_effort = effort;
  } else {
    body.max_tokens = maxTokens;
    body.temperature = temperature;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0] || {};
  return {
    content: choice.message?.content || '',
    finishReason: choice.finish_reason || '',
    usage: data.usage || {},
    model: data.model || resolvedModel,
  };
}

/**
 * Content-only wrapper — the shape most call sites want.
 */
async function callOpenAI(opts) {
  const { content } = await callOpenAIWithMeta(opts);
  return content;
}

/**
 * Title-case a prompt into something usable as an app name.
 */
function titleFromPrompt(prompt) {
  const clean = String(prompt || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'ZeroOps Starter';

  const words = clean.split(' ').slice(0, 5);
  // Drop trailing filler so "task board for a bakery's daily" ends at
  // "Task Board" rather than dangling on a preposition or article.
  const FILLER = new Set(['for', 'a', 'an', 'the', 'of', 'with', 'to', 'and', 'my', 'our']);
  while (words.length > 1 && FILLER.has(words[words.length - 1].toLowerCase())) words.pop();

  return words
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .slice(0, 60);
}

/**
 * Deterministic flavor when there's no API key or OpenAI fails.
 * Produces the same shape as the LLM path so downstream code can't tell them
 * apart — the app still reflects the prompt, just less imaginatively.
 */
function fallbackFlavor(prompt, mapping) {
  const title = titleFromPrompt(prompt) || mapping.name;
  const config = {
    title,
    tagline: prompt
      ? `${title} — running on Node.js with managed PostgreSQL, provisioned on Zerops from your prompt.`
      : 'A Node.js app with managed PostgreSQL, provisioned on Zerops.',
    itemLabel: 'Entry',
    seeds: [
      `${title} is live on Zerops`,
      'This row was written to managed PostgreSQL',
      'Add another below — it persists in the database',
    ],
  };

  return {
    prose: `Scaffolded **${title}** as a Node.js webapp backed by managed PostgreSQL. Two services, private network, public URL on the webapp.`,
    files: { [FLAVOR_FILE]: `${JSON.stringify(config, null, 2)}\n` },
    raw: '',
  };
}

/**
 * Accept the LLM's flavor file only if it is valid JSON with the fields the
 * running app reads. Anything malformed is dropped rather than deployed —
 * a broken app.config.json would ship a nameless app to a judge.
 */
function sanitizeFlavor(files, prompt, mapping) {
  const raw = files[FLAVOR_FILE];
  if (typeof raw !== 'string') return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const fallback = JSON.parse(fallbackFlavor(prompt, mapping).files[FLAVOR_FILE]);
  const config = {
    title: String(parsed.title || fallback.title).trim().slice(0, 80),
    tagline: String(parsed.tagline || fallback.tagline).trim().slice(0, 240),
    itemLabel: String(parsed.itemLabel || fallback.itemLabel).trim().slice(0, 40),
    seeds: (Array.isArray(parsed.seeds) ? parsed.seeds : fallback.seeds)
      .filter((s) => typeof s === 'string' && s.trim())
      .slice(0, 5)
      .map((s) => s.trim().slice(0, 200)),
  };
  if (!config.title || !config.seeds.length) return null;

  return { [FLAVOR_FILE]: `${JSON.stringify(config, null, 2)}\n` };
}

/**
 * Full scaffold pipeline for demo or authenticated user.
 *
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} [opts.templateId]
 * @param {string} [opts.apiKey] OpenAI key (server demo key or user BYOK)
 * @param {boolean} [opts.useLlm=true]
 */
async function scaffoldApp(opts = {}) {
  const prompt = (opts.prompt || '').trim();
  const mapping = mapPromptToTemplate(prompt, opts.templateId);
  const template = loadTemplate(mapping.templateId);

  if (!template) {
    throw new Error(`Template not found: ${mapping.templateId}`);
  }

  const projectName = safeProjectName(prompt, mapping.name);

  let flavor = null;
  let llmUsed = false;
  let llmError = null;

  if (opts.useLlm !== false && opts.apiKey) {
    try {
      const userMsg = [
        `User idea: ${prompt || mapping.name}`,
        `Project name: ${projectName}`,
        `Services: webapp (nodejs@22, public), db (postgresql@16, private)`,
        'Write the plan, then the app.config.json block.',
      ].join('\n');

      const raw = await callOpenAI({
        apiKey: opts.apiKey,
        system: DEMO_SYSTEM_PROMPT,
        user: userMsg,
        // The flavor file is tiny, but on reasoning models this budget is shared
        // with hidden reasoning tokens — 900 would be spent before a single
        // visible character, and we'd silently drop to fallbackFlavor().
        maxTokens: 4000,
        reasoningEffort: 'low',
      });

      const parsed = parseWriteBlocks(raw);
      const clean = sanitizeFlavor(applyWritesToMap(parsed.files), prompt, mapping);

      if (!clean) throw new Error('LLM returned no usable app.config.json');

      flavor = { prose: parsed.prose, files: clean, raw };
      llmUsed = true;
    } catch (err) {
      llmError = err.message || String(err);
      flavor = fallbackFlavor(prompt, mapping);
    }
  } else {
    flavor = fallbackFlavor(prompt, mapping);
  }

  // Template tree first, LLM flavor layered on top. The result is the exact
  // set of files that will be written to disk and pushed.
  const codeFiles = { ...template.codeFiles, ...flavor.files };

  const importYaml = template.importYaml.replace(/__PROJECT_NAME__/g, projectName);

  const topology = [
    { id: 'webapp', name: 'webapp', role: 'nodejs@22', privateHost: 'webapp:3000', status: 'idle' },
    { id: 'db', name: 'db', role: 'postgresql@16', privateHost: 'db:5432', status: 'idle' },
  ];

  return {
    success: true,
    projectName,
    templateId: mapping.templateId,
    templateName: mapping.name,
    confidence: mapping.confidence,
    matchedKeywords: mapping.matchedKeywords,
    services: mapping.services,
    topology,
    importYaml,
    meta: template.meta,
    plan: flavor.prose,
    codeFiles,
    llmUsed,
    llmError,
  };
}

module.exports = {
  scaffoldApp,
  loadTemplate,
  callOpenAI,
  callOpenAIWithMeta,
  isReasoningModel,
  DEFAULT_MODEL,
  safeProjectName,
  sanitizeFlavor,
  fallbackFlavor,
  DEMO_SYSTEM_PROMPT,
  FLAVOR_FILE,
};
