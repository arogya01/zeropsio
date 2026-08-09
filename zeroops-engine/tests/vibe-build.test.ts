/**
 * Unit tests for vibe Build hybrid path:
 * - write-protocol parse + multi-file apply
 * - path sandbox (no .. / absolute escapes)
 * - job-store create/get
 * - ship-packager static SPA layout (no network; fake dist)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { parseWriteBlocks, applyWritesToMap } = require('../src/server/llm/write-protocol');
const {
  sanitizeRelPath,
  resolveUnderWorkspace,
  applyWritesToDisk,
} = require('../src/server/llm/vibe-scaffold');
const jobStore = require('../src/server/vibe/job-store');
const {
  makeImportYaml,
  makeZeropsYml,
  treeToCodeFiles,
  cleanupDeployRoot,
  EXPRESS_PACKAGE_JSON,
  STATIC_SERVER_JS,
} = require('../src/server/vibe/ship-packager');

describe('write-protocol parseWriteBlocks + multi-file apply', () => {
  it('parses multiple zeroops-write and dyad-write blocks plus dependencies', () => {
    const raw = [
      'A todo app with a list and add form.',
      '',
      '<zeroops-write path="src/pages/Index.tsx" description="Main page">',
      'export default function Index() { return <div>Todo</div>; }',
      '</zeroops-write>',
      '',
      '<dyad-write path="src/App.tsx" description="Routes">',
      'export default function App() { return null; }',
      '</dyad-write>',
      '',
      '<zeroops-add-dependency packages="date-fns zod"></zeroops-add-dependency>',
      '',
      'Ready to preview.',
    ].join('\n');

    const parsed = parseWriteBlocks(raw);
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].path).toBe('src/pages/Index.tsx');
    expect(parsed.files[0].content).toContain('Todo');
    expect(parsed.files[1].path).toBe('src/App.tsx');
    expect(parsed.dependencies).toEqual(['date-fns', 'zod']);
    expect(parsed.prose).toMatch(/todo app/i);
    expect(parsed.prose).not.toMatch(/zeroops-write/);
  });

  it('applyWritesToMap stages multi-file content without touching disk', () => {
    const files = [
      { path: 'src/a.ts', content: 'a' },
      { path: '/src/b.ts', content: 'b' },
      { path: 'src/nested/c.ts', content: 'c' },
    ];
    const map = applyWritesToMap(files, { 'src/keep.ts': 'keep' });
    expect(map['src/keep.ts']).toBe('keep');
    expect(map['src/a.ts']).toBe('a');
    expect(map['src/b.ts']).toBe('b');
    expect(map['src/nested/c.ts']).toBe('c');
  });

  it('applyWritesToMap strips .. segments rather than escaping', () => {
    // Map helper is defensive (strips ..) — disk path uses stricter reject.
    const map = applyWritesToMap([
      { path: '../etc/passwd', content: 'nope' },
      { path: 'src/ok.ts', content: 'ok' },
    ]);
    expect(map['src/ok.ts']).toBe('ok');
    // After stripping .. the path collapses; must not keep traversal form.
    expect(Object.keys(map).some((k) => k.includes('..'))).toBe(false);
  });
});

describe('write path sandbox rejects ..', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'zeroops-vibe-sandbox-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(workspace, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('sanitizeRelPath returns null for parent traversal and empty/node_modules', () => {
    expect(sanitizeRelPath('../secret')).toBeNull();
    expect(sanitizeRelPath('src/../../etc/passwd')).toBeNull();
    expect(sanitizeRelPath('foo/../../../bar')).toBeNull();
    expect(sanitizeRelPath('')).toBeNull();
    expect(sanitizeRelPath(null)).toBeNull();
    expect(sanitizeRelPath('node_modules/evil')).toBeNull();
  });

  it('sanitizeRelPath accepts normal relative project paths', () => {
    expect(sanitizeRelPath('src/pages/Index.tsx')).toBe('src/pages/Index.tsx');
    expect(sanitizeRelPath('/src/App.tsx')).toBe('src/App.tsx');
    expect(sanitizeRelPath('src/./lib/utils.ts')).toBe('src/lib/utils.ts');
  });

  it('resolveUnderWorkspace throws when resolved path would escape root', () => {
    expect(() => resolveUnderWorkspace(workspace, path.join('..', 'outside.txt'))).toThrow(
      /escapes workspace/i,
    );
  });

  it('applyWritesToDisk skips traversal paths and only writes safe files', () => {
    const applied = applyWritesToDisk(workspace, [
      { path: '../../../tmp/evil.js', content: 'evil' },
      { path: 'src/../../escape.ts', content: 'nope' },
      { path: 'src/pages/Index.tsx', content: 'export default function Index() {}' },
      { path: 'src/App.tsx', content: 'export default function App() {}' },
    ]);

    expect(applied.map((f: { path: string }) => f.path).sort()).toEqual([
      'src/App.tsx',
      'src/pages/Index.tsx',
    ]);
    expect(fs.existsSync(path.join(workspace, 'src/pages/Index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(workspace, 'src/App.tsx'))).toBe(true);

    // Nothing written outside workspace via relative escape.
    const outside = path.resolve(workspace, '..', 'evil.js');
    if (fs.existsSync(outside)) {
      const body = fs.readFileSync(outside, 'utf8');
      expect(body).not.toBe('evil');
    }
  });
});

describe('vibe job-store create/get', () => {
  beforeEach(() => jobStore.reset());

  it('create returns an id and get returns the job', () => {
    const id = jobStore.create({ prompt: 'build a notes app' });
    expect(id).toMatch(/^vibe-/);

    const job = jobStore.get(id);
    expect(job).not.toBeNull();
    expect(job.id).toBe(id);
    expect(job.status).toBe('queued');
    expect(job.prompt).toBe('build a notes app');
    expect(job.done).toBe(false);
    expect(job.previewUrl).toBeNull();
    expect(job.workspaceId).toBeNull();
    expect(job.events).toEqual([]);
  });

  it('get returns null for unknown ids', () => {
    expect(jobStore.get('vibe-nope')).toBeNull();
  });

  it('update patches allowed fields and read exposes them for polling', () => {
    const id = jobStore.create({ prompt: 'x' });
    jobStore.update(id, {
      status: 'preview',
      workspaceId: 'abc123',
      previewUrl: '/api/vibe/preview/abc123/',
      plan: 'A notes SPA',
      codeFiles: { 'src/App.tsx': 'export {}' },
    });
    jobStore.append(id, { type: 'stage', stage: 'preview', message: 'up' });

    const snap = jobStore.read(id, 0);
    expect(snap.status).toBe('preview');
    expect(snap.workspaceId).toBe('abc123');
    expect(snap.previewUrl).toBe('/api/vibe/preview/abc123/');
    expect(snap.plan).toBe('A notes SPA');
    expect(snap.codeFiles['src/App.tsx']).toBe('export {}');
    expect(snap.events).toHaveLength(1);
    expect(snap.next).toBe(1);
  });

  it('finish marks done and ignores later appends', () => {
    const id = jobStore.create();
    jobStore.finish(
      id,
      { type: 'done' },
      { status: 'ready', previewUrl: '/api/vibe/preview/w1/' },
    );
    jobStore.append(id, { type: 'log', text: 'too late' });

    const job = jobStore.get(id);
    expect(job.done).toBe(true);
    expect(job.status).toBe('ready');
    expect(job.previewUrl).toBe('/api/vibe/preview/w1/');
    expect(job.events.map((e: { type: string }) => e.type)).toEqual(['done']);
  });
});

describe('ship-packager layout (fake dist, no network)', () => {
  let deployRoot = '';

  afterEach(() => {
    if (deployRoot) cleanupDeployRoot(deployRoot);
    deployRoot = '';
  });

  it('makeImportYaml is single-service SPA with no Postgres', () => {
    const yml = makeImportYaml('My Cool App!!');
    expect(yml).toMatch(/hostname:\s*webapp/);
    expect(yml).toMatch(/type:\s*nodejs@22/);
    expect(yml).toMatch(/enableSubdomainAccess:\s*true/);
    expect(yml).toMatch(/name:\s*my-cool-app/);
    expect(yml).not.toMatch(/postgres/i);
    expect(yml).not.toMatch(/postgresql/i);
  });

  it('makeZeropsYml uses nodejs@22, npm ci, and httpSupport 3000', () => {
    const yml = makeZeropsYml();
    expect(yml).toMatch(/base:\s*nodejs@22/);
    expect(yml).toMatch(/npm ci --omit=dev/);
    expect(yml).toMatch(/httpSupport:\s*true/);
    expect(yml).toMatch(/port:\s*3000/);
    expect(yml).toMatch(/start:\s*npm start/);
    expect(yml).toMatch(/dist/);
  });

  it('materializes webapp/dist + static server layout from fake vite dist', () => {
    // Mirror packageForZerops materialize steps without running npm/vite.
    deployRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zeroops-ship-test-'));
    const webappDir = path.join(deployRoot, 'webapp');
    const distDir = path.join(webappDir, 'dist');
    const assetsDir = path.join(distDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    fs.writeFileSync(path.join(webappDir, 'package.json'), EXPRESS_PACKAGE_JSON, 'utf8');
    fs.writeFileSync(path.join(webappDir, 'server.js'), STATIC_SERVER_JS, 'utf8');
    fs.writeFileSync(path.join(webappDir, 'zerops.yml'), makeZeropsYml(), 'utf8');
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><body><div id="root"></div></body></html>',
      'utf8',
    );
    fs.writeFileSync(path.join(assetsDir, 'index.js'), 'console.log(1)', 'utf8');

    const importYaml = makeImportYaml('vibe-spa-test');
    fs.writeFileSync(path.join(deployRoot, 'zerops-import.yml'), importYaml, 'utf8');

    const codeFiles = {
      ...treeToCodeFiles(webappDir, 'webapp'),
      'zerops-import.yml': importYaml,
    };

    expect(codeFiles['webapp/package.json']).toContain('express');
    expect(codeFiles['webapp/package.json']).toMatch(/"start":\s*"node server\.js"/);
    expect(codeFiles['webapp/server.js']).toMatch(/express\.static/);
    expect(codeFiles['webapp/server.js']).toMatch(/dist/);
    expect(codeFiles['webapp/zerops.yml']).toMatch(/nodejs@22/);
    expect(codeFiles['webapp/dist/index.html']).toMatch(/id="root"/);
    expect(codeFiles['webapp/dist/assets/index.js']).toBe('console.log(1)');
    expect(codeFiles['zerops-import.yml']).toMatch(/hostname:\s*webapp/);
    expect(Object.keys(codeFiles).some((k) => /postgres/i.test(k))).toBe(false);

    // cleanupDeployRoot removes the tree
    cleanupDeployRoot(deployRoot);
    expect(fs.existsSync(deployRoot)).toBe(false);
    deployRoot = '';
  });
});
