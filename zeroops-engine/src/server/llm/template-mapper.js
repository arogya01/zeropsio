/**
 * Template intent mapper — adapted from open-lovable's edit-intent-analyzer
 * (pattern-based classification) for ZeroOps multi-service templates.
 *
 * Demo path: free-text → one of N templates (never invents topology).
 */

const TEMPLATE_CATALOG = [
  {
    id: 'ai-video-clipper',
    name: 'AI Video Clipper',
    keywords: [
      'video', 'clip', 'whisper', 'transcri', 'audio', 'media', 'ffmpeg',
      'subtitle', 'podcast', 'youtube', 'recording',
    ],
    services: ['webapp', 'apigateway', 'aiworker', 'dbpostgres', 'cachevalkey'],
  },
  {
    id: 'ecommerce-platform',
    name: 'E-Commerce Platform',
    keywords: [
      'ecom', 'shop', 'store', 'cart', 'checkout', 'product', 'order',
      'payment', 'inventory', 'retail', 'marketplace', 'buy',
    ],
    services: ['webapp', 'apigateway', 'aiworker', 'dbpostgres', 'cachevalkey'],
  },
  {
    id: 'rag-search-engine',
    name: 'RAG Search Engine',
    keywords: [
      'rag', 'search', 'embed', 'vector', 'knowledge', 'document', 'pdf',
      'retrieval', 'semantic', 'chatbot', 'qa', 'llm search', 'pgvector',
    ],
    services: ['webapp', 'apigateway', 'aiworker', 'dbpostgres', 'cachevalkey'],
  },
];

/**
 * Map a user prompt to a catalog template (deterministic, open-lovable style patterns).
 * @param {string} prompt
 * @param {string} [forcedTemplateId]
 * @returns {{ templateId: string, name: string, confidence: number, services: string[], matchedKeywords: string[] }}
 */
function mapPromptToTemplate(prompt, forcedTemplateId) {
  if (forcedTemplateId) {
    const hit = TEMPLATE_CATALOG.find((t) => t.id === forcedTemplateId);
    if (hit) {
      return {
        templateId: hit.id,
        name: hit.name,
        confidence: 1,
        services: hit.services,
        matchedKeywords: ['template-id'],
      };
    }
  }

  const lower = (prompt || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  let bestMatches = [];

  for (const t of TEMPLATE_CATALOG) {
    const matches = t.keywords.filter((k) => lower.includes(k));
    const score = matches.length;
    if (score > bestScore) {
      bestScore = score;
      best = t;
      bestMatches = matches;
    }
  }

  // Default: AI Video Clipper (flagship demo) when no signal — same idea as
  // open-lovable defaulting to UPDATE_COMPONENT with low confidence.
  if (!best || bestScore === 0) {
    const fallback = TEMPLATE_CATALOG[0];
    return {
      templateId: fallback.id,
      name: fallback.name,
      confidence: 0.3,
      services: fallback.services,
      matchedKeywords: [],
    };
  }

  return {
    templateId: best.id,
    name: best.name,
    confidence: Math.min(0.95, 0.4 + bestScore * 0.15),
    services: best.services,
    matchedKeywords: bestMatches,
  };
}

function listTemplates() {
  return TEMPLATE_CATALOG.map(({ id, name, services }) => ({ id, name, services }));
}

module.exports = {
  TEMPLATE_CATALOG,
  mapPromptToTemplate,
  listTemplates,
};
