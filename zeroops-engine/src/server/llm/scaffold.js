/**
 * LLM scaffold orchestrator.
 * Prompt patterns adapted from:
 *  - Dyad BUILD_SYSTEM_PREFIX (structured file writes, concise plan)
 *  - open-lovable generate-ai-code-stream (surgical edits, conversation bounds)
 *
 * OpenAI-only. Uses fetch (no SDK) so we stay dep-light.
 */

const fs = require('fs');
const path = require('path');
const { mapPromptToTemplate } = require('./template-mapper');
const { parseWriteBlocks, applyWritesToMap } = require('./write-protocol');

const TEMPLATES_DIR = path.join(__dirname, '../../templates');

const DEMO_SYSTEM_PROMPT = `You are ZeroOps, an AI that scaffolds multi-service apps for Zerops.

Rules (Dyad-style structured output):
- The stack topology is FIXED. You may NOT invent new services or remove services.
- Services in this stack: webapp, apigateway, aiworker, dbpostgres, cachevalkey.
- First reply with a short plan (3-5 bullets): project name, what each service does for THIS user's idea.
- Then emit at most 3 flavor files using EXACTLY this tag format (one block per file):

<zeroops-write path="webapp/FLAVOR.md" description="Project flavor for the user idea">
# Title
Short description of the app tailored to the user prompt.
</zeroops-write>

- Prefer path webapp/FLAVOR.md and optionally apigateway/README_FLAVOR.md.
- Do NOT rewrite entire services. Do NOT output markdown code fences for code — only <zeroops-write> tags.
- Keep total generated content under 800 words.
- Always end with one line: READY_FOR_ZEROPS`;

/**
 * Load template metadata + import yaml from disk.
 */
function loadTemplate(templateId) {
  const dir = path.join(TEMPLATES_DIR, templateId);
  if (!fs.existsSync(dir)) return null;
  const metaPath = path.join(dir, 'template.json');
  const importPath = path.join(dir, 'zerops-import.yml');
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : { name: templateId };
  const importYaml = fs.existsSync(importPath)
    ? fs.readFileSync(importPath, 'utf8')
    : '';
  return { id: templateId, meta, importYaml, dir };
}

/**
 * Call OpenAI Chat Completions (OpenAI-only, model overridable).
 */
async function callOpenAI({ apiKey, model, system, user, maxTokens = 1200 }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Deterministic fallback flavor when no API key / OpenAI fails.
 */
function fallbackFlavor(prompt, mapping) {
  const title = mapping.name;
  const content = `# ${title}

Built for: ${prompt || 'demo app'}

## Services
${mapping.services.map((s) => `- ${s}`).join('\n')}

Mapped from template \`${mapping.templateId}\` (confidence ${mapping.confidence}).
`;
  return {
    prose: `Scaffolded **${title}** from your prompt. Topology locked to the ZeroOps 5-service stack.`,
    files: {
      'webapp/FLAVOR.md': content,
    },
    raw: content,
  };
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

  const projectName = (prompt || mapping.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || mapping.templateId;

  let flavor = null;
  let llmUsed = false;
  let llmError = null;

  if (opts.useLlm !== false && opts.apiKey) {
    try {
      const userMsg = [
        `User idea: ${prompt || mapping.name}`,
        `Forced template: ${mapping.templateId} (${mapping.name})`,
        `Services: ${mapping.services.join(', ')}`,
        `Matched keywords: ${mapping.matchedKeywords.join(', ') || 'none'}`,
        'Produce plan bullets + zeroops-write flavor file(s).',
      ].join('\n');

      const raw = await callOpenAI({
        apiKey: opts.apiKey,
        system: DEMO_SYSTEM_PROMPT,
        user: userMsg,
      });
      const parsed = parseWriteBlocks(raw);
      flavor = {
        prose: parsed.prose,
        files: applyWritesToMap(parsed.files),
        raw,
        dependencies: parsed.dependencies,
      };
      llmUsed = true;
    } catch (err) {
      llmError = err.message || String(err);
      flavor = fallbackFlavor(prompt, mapping);
    }
  } else {
    flavor = fallbackFlavor(prompt, mapping);
  }

  // Topology for canvas (canonical studio ids)
  const topology = [
    { id: 'web-frontend', name: 'webapp', privateHost: 'webapp:3000', status: 'idle' },
    { id: 'api-gateway', name: 'apigateway', privateHost: 'apigateway:8080', status: 'idle' },
    { id: 'ai-worker', name: 'aiworker', privateHost: 'aiworker:5000', status: 'idle' },
    { id: 'db-postgres', name: 'dbpostgres', privateHost: 'dbpostgres:5432', status: 'idle' },
    { id: 'cache-valkey', name: 'cachevalkey', privateHost: 'cachevalkey:6379', status: 'idle' },
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
    importYaml: template.importYaml,
    meta: template.meta,
    plan: flavor.prose,
    codeFiles: flavor.files,
    llmUsed,
    llmError,
  };
}

module.exports = {
  scaffoldApp,
  loadTemplate,
  callOpenAI,
  DEMO_SYSTEM_PROMPT,
};
