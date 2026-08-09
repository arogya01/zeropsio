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

const OPEN_RE = /<(zeroops-write|dyad-write)\s+([^>]*?)\/?>/gi;
const CLOSE_RE = /<\/(zeroops-write|dyad-write)\s*>/i;
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
 * Parse a response into file writes, dependencies, and the surrounding prose.
 *
 * Blocks are delimited by their open tags rather than by matched pairs: models
 * writing a dozen files routinely emit the closing tag for only the last one,
 * and a strict pairing regex then swallows every file into the first one. A
 * block therefore ends at the first of its close tag, the next open tag, or a
 * dependency tag.
 *
 * The one case that is dropped rather than recovered is a block still open at
 * end of input — that means the response was cut off mid-file, and half a
 * source file is worse than none.
 *
 * @param {string} text LLM output
 * @returns {{ files: Array<{path:string, description:string, content:string}>, dependencies: string[], prose: string }}
 */
function parseWriteBlocks(text) {
  const files = [];
  const dependencies = [];

  if (!text) {
    return { files, dependencies, prose: '' };
  }

  /** Regions of `text` consumed by write blocks — everything else is prose. */
  const consumed = [];

  const opens = [];
  let m;
  const openRe = new RegExp(OPEN_RE.source, 'gi');
  while ((m = openRe.exec(text)) !== null) {
    opens.push({ start: m.index, bodyAt: m.index + m[0].length, attrsRaw: m[2] || '' });
  }

  for (let i = 0; i < opens.length; i++) {
    const open = opens[i];
    const next = opens[i + 1];
    const limit = next ? next.start : text.length;
    const region = text.slice(open.bodyAt, limit);

    const close = region.match(new RegExp(CLOSE_RE.source, 'i'));
    const dep = region.match(new RegExp(DEP_RE.source, 'i'));

    let content;
    let end;
    if (close) {
      content = region.slice(0, close.index);
      end = open.bodyAt + close.index + close[0].length;
    } else if (dep) {
      // Unclosed, but a dependency tag follows — the file ended there.
      content = region.slice(0, dep.index);
      end = open.bodyAt + dep.index;
    } else if (next) {
      // Unclosed; the next file's open tag ends this one.
      content = region;
      end = next.start;
    } else {
      // Unclosed at end of input: truncated mid-file. Drop it, and keep its
      // raw source out of the plan the user reads.
      consumed.push([open.start, text.length]);
      continue;
    }

    consumed.push([open.start, end]);

    const attrs = parseAttrs(open.attrsRaw);
    const filePath = attrs.path || attrs.file || '';
    if (!filePath) continue;

    files.push({
      path: filePath,
      description: attrs.description || '',
      content: content.replace(/^\n/, '').replace(/\n$/, ''),
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

  let prose = '';
  let cursor = 0;
  for (const [start, end] of consumed) {
    if (start > cursor) prose += text.slice(cursor, start);
    cursor = Math.max(cursor, end);
  }
  prose += text.slice(cursor);

  prose = prose
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
