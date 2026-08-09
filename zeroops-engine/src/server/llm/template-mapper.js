/**
 * Demo template catalog.
 *
 * ONE template on purpose. The demo's job is to prove that a prompt becomes a
 * genuinely running app on Zerops — not to show off a picker. A single small,
 * reliably-buildable stack (Node + managed Postgres) deploys live in a couple
 * of minutes; the previous 5-service catalog (Node + Go + Python + Postgres +
 * Valkey) never actually shipped code to its containers and could not produce
 * a working URL.
 *
 * This is the DEMO catalog only. The Studio template library at
 * `/api/templates` still reads every directory under `src/templates/`.
 */

const TEMPLATE_CATALOG = [
  {
    id: 'starter-node-postgres',
    name: 'Node + Postgres App',
    keywords: [],
    services: ['webapp', 'db'],
  },
];

const PRIMARY = TEMPLATE_CATALOG[0];

/** Words we never echo back as "understood" — they carry no app meaning. */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'app', 'application', 'build', 'create', 'for', 'make',
  'me', 'my', 'of', 'on', 'simple', 'that', 'the', 'to', 'with', 'using',
  'want', 'need', 'please', 'it', 'is', 'in', 'so', 'can', 'you',
]);

/**
 * Pull the content words out of a prompt, for display as "what we understood".
 * Purely cosmetic — it never changes which template is used.
 */
function extractKeywords(prompt) {
  return [
    ...new Set(
      String(prompt || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    ),
  ].slice(0, 6);
}

/**
 * Map a prompt to a template.
 *
 * With a single-template catalog this always resolves to that template; the
 * prompt shapes the app's *content* (title, tagline, seed rows) through the
 * LLM flavor step in scaffold.js, not its topology.
 *
 * @param {string} prompt
 * @param {string} [forcedTemplateId] Ignored unless it names a known template.
 */
function mapPromptToTemplate(prompt, forcedTemplateId) {
  const hit =
    (forcedTemplateId && TEMPLATE_CATALOG.find((t) => t.id === forcedTemplateId)) || PRIMARY;

  return {
    templateId: hit.id,
    name: hit.name,
    confidence: 1,
    services: hit.services,
    matchedKeywords: extractKeywords(prompt),
  };
}

function listTemplates() {
  return TEMPLATE_CATALOG.map(({ id, name, services }) => ({ id, name, services }));
}

module.exports = {
  TEMPLATE_CATALOG,
  mapPromptToTemplate,
  listTemplates,
  extractKeywords,
};
