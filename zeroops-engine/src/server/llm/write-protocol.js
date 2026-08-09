/**
 * ZeroOps write-protocol — simplified from Dyad's streamingMessageParser
 * (https://github.com/dyad-sh/dyad) structured file ops.
 *
 * Recognises:
 *   <zeroops-write path="webapp/server.js" description="...">...</zeroops-write>
 *   <dyad-write path="..." description="...">...</dyad-write>  (compat)
 *   <zeroops-add-dependency packages="foo bar"></zeroops-add-dependency>
 *
 * Non-streaming parse is enough for hackathon scaffold responses.
 */

const WRITE_RE =
  /<(zeroops-write|dyad-write)\s+([^>]*)>([\s\S]*?)<\/\1>/gi;
const ATTR_RE = /(\w+)="([^"]*)"/g;
const DEP_RE =
  /<(zeroops-add-dependency|dyad-add-dependency)\s+([^>]*)\s*\/?>/gi;

function parseAttrs(raw) {
  const attrs = {};
  let m;
  const re = new RegExp(ATTR_RE.source, 'g');
  while ((m = re.exec(raw)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/**
 * @param {string} text LLM output
 * @returns {{ files: Array<{path:string, description:string, content:string}>, dependencies: string[], prose: string }}
 */
function parseWriteBlocks(text) {
  const files = [];
  const dependencies = [];
  let prose = text || '';

  if (!text) {
    return { files, dependencies, prose: '' };
  }

  let m;
  const writeRe = new RegExp(WRITE_RE.source, 'gi');
  while ((m = writeRe.exec(text)) !== null) {
    const attrs = parseAttrs(m[2] || '');
    const path = attrs.path || attrs.file || '';
    if (!path) continue;
    files.push({
      path,
      description: attrs.description || '',
      content: (m[3] || '').replace(/^\n/, '').replace(/\n$/, ''),
    });
  }

  const depRe = new RegExp(DEP_RE.source, 'gi');
  while ((m = depRe.exec(text)) !== null) {
    const attrs = parseAttrs(m[2] || '');
    const packages = (attrs.packages || attrs.package || '')
      .split(/\s+/)
      .filter(Boolean);
    for (const p of packages) dependencies.push(p);
  }

  prose = text
    .replace(writeRe, '')
    .replace(depRe, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { files, dependencies, prose };
}

/**
 * Apply write blocks into a plain object tree (path → content).
 * Does not touch disk — caller decides where to stage.
 */
function applyWritesToMap(files, base = {}) {
  const out = { ...base };
  for (const f of files) {
    if (!f.path) continue;
    // Normalise: no leading slash, no ..
    const safe = f.path.replace(/^\/+/, '').replace(/\.\./g, '');
    if (!safe) continue;
    out[safe] = f.content;
  }
  return out;
}

module.exports = {
  parseWriteBlocks,
  applyWritesToMap,
};
