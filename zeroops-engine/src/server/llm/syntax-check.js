/**
 * Parse-check generated source before it reaches Vite.
 *
 * Asking the model for a whole app rather than one page makes it compress its
 * output — long single-line JSX, dropped closing braces — and a single syntax
 * error means the preview iframe shows an error overlay instead of the app.
 * esbuild (already a Vite dependency) parses each file in microseconds, which
 * is enough to catch that class of failure while we can still ask for a fix.
 *
 * Deliberately syntax-only: no type checking, no import resolution. Those
 * produce false positives on perfectly runnable code and Vite reports them
 * itself.
 */

const fs = require('fs');
const path = require('path');

let esbuild = null;
try {
  // Present via Vite/tsup. If it ever isn't, checking degrades to a no-op
  // rather than failing a build that would have worked.
  esbuild = require('esbuild');
} catch {
  esbuild = null;
}

const LOADERS = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'jsx',
  '.jsx': 'jsx',
  '.mts': 'ts',
  '.cts': 'ts',
  '.css': 'css',
};

/** @param {string} rel */
function loaderFor(rel) {
  return LOADERS[path.extname(rel).toLowerCase()] || null;
}

/**
 * @typedef {{ path: string, message: string, line: number, snippet: string }} SyntaxProblem
 */

/**
 * Parse-check a single source string.
 * @param {string} rel  Relative path (chooses the loader)
 * @param {string} source
 * @returns {SyntaxProblem|null}
 */
function checkSource(rel, source) {
  const loader = loaderFor(rel);
  if (!esbuild || !loader) return null;

  try {
    const result = esbuild.transformSync(source, { loader, jsx: 'automatic' });

    // esbuild's CSS parser recovers where PostCSS — which is what actually
    // builds the app — gives up, so its structural complaints arrive as
    // warnings. "Expected X" / "Unexpected X" is that class, and covers the
    // junk models append to CSS files (a stray `EOF` line, a closing
    // `</style>` tag). Everything else esbuild warns about (vendor prefixes,
    // unknown at-rules, Tailwind directives) is noise PostCSS accepts, and
    // must not cost a repair call.
    if (loader === 'css') {
      const structural = (result.warnings || []).find((w) =>
        /^(Expected|Unexpected)\b/.test(w.text || ''),
      );
      if (structural) {
        return {
          path: rel,
          message: structural.text,
          line: structural.location ? structural.location.line : 0,
          snippet: structural.location ? String(structural.location.lineText || '').slice(0, 400) : '',
        };
      }
    }
    return null;
  } catch (err) {
    const first = (err && err.errors && err.errors[0]) || null;
    return {
      path: rel,
      message: first ? first.text : err.message || String(err),
      line: first && first.location ? first.location.line : 0,
      snippet: first && first.location ? String(first.location.lineText || '').slice(0, 400) : '',
    };
  }
}

/**
 * Parse-check every checkable file in a set of writes.
 *
 * @param {string} workspacePath
 * @param {Array<{path: string, content?: string}>} files
 * @returns {SyntaxProblem[]}
 */
function checkFiles(workspacePath, files) {
  const problems = [];
  for (const f of files || []) {
    if (!f || !f.path || !loaderFor(f.path)) continue;

    let source = f.content;
    if (typeof source !== 'string') {
      const abs = path.join(workspacePath, f.path);
      if (!fs.existsSync(abs)) continue;
      try {
        source = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
    }

    const problem = checkSource(f.path, source);
    if (problem) problems.push(problem);
  }
  return problems;
}

/**
 * Link-check the whole app: resolve every local import from the entry point and
 * confirm each imported binding actually exists.
 *
 * Parsing files one at a time cannot see across them, and the most common
 * multi-file generation failure is exactly a cross-file mismatch — App.tsx
 * default-imports a component whose file only has a named export, or imports a
 * page that was never written. Vite reports that at runtime, as a blank iframe.
 *
 * Bare specifiers (react, lucide-react) and stylesheets are marked external, so
 * this runs before `npm install` and never fails on a package we simply have
 * not fetched yet.
 *
 * @param {string} workspacePath
 * @returns {Promise<SyntaxProblem[]>}
 */
async function checkBundle(workspacePath) {
  if (!esbuild) return [];

  const entry = ['src/main.tsx', 'src/main.jsx', 'src/main.ts']
    .map((rel) => path.join(workspacePath, rel))
    .find((abs) => fs.existsSync(abs));
  if (!entry) return [];

  const srcDir = path.join(workspacePath, 'src');

  const externalizeInstalled = {
    name: 'externalize-installed',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point') return null;
        // Local source is what we are checking; everything else is someone
        // else's problem (npm install handles it, Vite handles CSS).
        const isLocal = args.path.startsWith('.') || args.path.startsWith('@/');
        if (!isLocal || /\.css$/.test(args.path)) {
          return { path: args.path, external: true };
        }
        return null;
      });
    },
  };

  try {
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      logLevel: 'silent',
      format: 'esm',
      platform: 'browser',
      jsx: 'automatic',
      absWorkingDir: workspacePath,
      alias: { '@': srcDir },
      plugins: [externalizeInstalled],
    });
    return [];
  } catch (err) {
    const seen = new Set();
    const problems = [];
    for (const e of (err && err.errors) || []) {
      // Anchor the fix on the file holding the bad import.
      const rel = e.location && e.location.file ? e.location.file.replace(/\\/g, '/') : '';
      if (!rel || seen.has(rel)) continue;
      seen.add(rel);

      const notes = (e.notes || []).map((n) => n.text).filter(Boolean);
      problems.push({
        path: rel,
        message: [e.text, ...notes].join(' — '),
        line: e.location ? e.location.line : 0,
        snippet: e.location ? String(e.location.lineText || '').slice(0, 400) : '',
      });
    }
    return problems;
  }
}

module.exports = {
  checkFiles,
  checkSource,
  checkBundle,
  loaderFor,
  available: () => Boolean(esbuild),
};
