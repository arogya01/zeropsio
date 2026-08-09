import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateZeroStubs } from '../src/code-gen/stub-validator';
import { synthesizeStack } from '../src/synthesizer/stack-synthesizer';
import { injectPrivateNetEnv } from '../src/synthesizer/private-net';
import { generateZeropsConfigs } from '../src/synthesizer/yaml-generator';
import { synthesizeCode } from '../src/code-gen/code-synthesizer';
import { createStudioServer, StudioServerInstance } from '../src/studio/server';
import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';
import * as yamlModule from 'js-yaml';

const yaml: typeof import('js-yaml') = (yamlModule as any).default || yamlModule;
const engineServer = require('../src/server/index');

describe('Challenger 2 Empirical Verification & Stress Test Suite', () => {
  let enginePort: number;
  let engineHttpServer: any;
  let engineBaseUrl: string;

  let studio: StudioServerInstance;
  let studioPort: number;
  let studioBaseUrl: string;
  let studioWsUrl: string;

  beforeAll(async () => {
    // Start Engine Server on ephemeral port
    await new Promise<void>((resolve) => {
      engineHttpServer = engineServer.server.listen(0, () => {
        enginePort = engineHttpServer.address().port;
        engineBaseUrl = `http://127.0.0.1:${enginePort}`;
        resolve();
      });
    });

    // Start Studio Server on ephemeral port
    studio = createStudioServer({ mock: true });
    studioPort = await studio.listen(0);
    studioBaseUrl = `http://127.0.0.1:${studioPort}`;
    studioWsUrl = `ws://127.0.0.1:${studioPort}/ws/logs`;
  });

  afterAll(async () => {
    if (engineHttpServer) {
      await new Promise<void>((resolve) => engineHttpServer.close(() => resolve()));
    }
    if (studio) {
      await studio.close();
    }
  });

  describe('Task 1: Template Library Endpoints & zerops-import.yml Synthesis', () => {
    it('GET /api/templates returns catalog listing all 3 pre-built stacks', async () => {
      const res = await fetch(`${engineBaseUrl}/api/templates`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('templates');
      const templateIds = data.templates.map((t: any) => t.id);
      expect(templateIds).toContain('ai-video-clipper');
      expect(templateIds).toContain('ecommerce-platform');
      expect(templateIds).toContain('rag-search-engine');
    });

    it('zerops-import.yml synthesizes and parses cleanly for all 3 pre-built stacks', async () => {
      const validIds = ['ai-video-clipper', 'ecommerce-platform', 'rag-search-engine'];
      for (const id of validIds) {
        const res = await fetch(`${engineBaseUrl}/api/templates/${id}`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.importYaml).toBeDefined();
        const parsed: any = yaml.load(data.importYaml);
        expect(parsed.project).toBeDefined();
        expect(parsed.project.name).toBeDefined();
        expect(Array.isArray(parsed.project.services)).toBe(true);
        expect(parsed.project.services.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('GET /api/templates/:id returns 404 for non-existent template', async () => {
      const res = await fetch(`${engineBaseUrl}/api/templates/invalid-id-9999`);
      expect(res.status).toBe(404);
    });

    it('validateZeroStubs passes on template source code files', () => {
      const templatesDir = path.join(__dirname, '../src/templates');
      const templateDirs = ['ai-video-clipper', 'ecommerce-platform', 'rag-search-engine'];
      const templateCodeFiles: Record<string, string> = {};

      for (const dir of templateDirs) {
        const fullDir = path.join(templatesDir, dir);
        const subFiles = ['webapp/server.js', 'apigateway/main.go', 'aiworker/main.py'];
        for (const sf of subFiles) {
          const fp = path.join(fullDir, sf);
          if (fs.existsSync(fp)) {
            templateCodeFiles[`${dir}/${sf}`] = fs.readFileSync(fp, 'utf-8');
          }
        }
      }

      expect(Object.keys(templateCodeFiles).length).toBeGreaterThanOrEqual(9);
      const res = validateZeroStubs(templateCodeFiles);
      expect(res.isClean).toBe(true);
      expect(res.astValid).toBe(true);
      expect(res.violations).toHaveLength(0);
    });
  });

  describe('Task 2: Stress Testing validateZeroStubs (False Positives & False Negatives)', () => {
    it('detects TS comment TODO / FIXME stubs', () => {
      const res = validateZeroStubs({
        'test1.ts': '// TODO: handle auth token refresh\nconst x = 1;',
        'test2.ts': '/* FIXME: memory leak in loop */\nfunction calc() { return 42; }',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'COMMENT_STUB')).toBe(true);
    });

    it('detects empty function bodies in TS', () => {
      const res = validateZeroStubs({
        'test.ts': 'function doNothing() {}\nconst arrowNoop = () => {};',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'EMPTY_FUNCTION_BODY')).toBe(true);
    });

    it('detects throw not implemented errors in TS', () => {
      const res = validateZeroStubs({
        'test.ts': 'function throwErr() { throw new Error("not implemented"); }',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'THROW_NOT_IMPLEMENTED')).toBe(true);
    });

    it('detects explicit any type keyword in TS', () => {
      const res = validateZeroStubs({
        'test.ts': 'function processData(input: any): any { return input; }',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'EXPLICIT_ANY_TYPE')).toBe(true);
    });

    it('detects mock return strings in TS', () => {
      const res = validateZeroStubs({
        'test.ts': 'function getVal() { return "dummy_value"; }',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'MOCK_RETURN_VALUE')).toBe(true);
    });

    it('detects Python pass stubs and raise NotImplementedError', () => {
      const res = validateZeroStubs({
        'w1.py': 'def process_item():\n    pass\n',
        'w2.py': 'def handle_req():\n    raise NotImplementedError("Not implemented")\n',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'PYTHON_PASS_STUB')).toBe(true);
      expect(res.violations.some((v) => v.rule === 'PYTHON_RAISE_NOT_IMPLEMENTED')).toBe(true);
    });

    it('detects Go panic stubs, empty functions, and unclosed string literals', () => {
      const res = validateZeroStubs({
        'g1.go': 'package main\nfunc foo() {\n    panic("not implemented")\n}\n',
        'g2.go': 'package main\nfunc empty() {}\n',
        'g3.go': 'package main\nvar str = "unterminated\nstring"\n',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'GO_PANIC_STUB')).toBe(true);
      expect(res.violations.some((v) => v.rule === 'GO_EMPTY_FUNCTION')).toBe(true);
      expect(res.violations.some((v) => v.rule === 'GO_UNTERMINATED_STRING_LITERAL')).toBe(true);
    });

    it('detects HTML UI placeholder text and empty SQL migrations', () => {
      const res = validateZeroStubs({
        'ui.tsx': 'export function View() { return <div>Lorem ipsum</div>; }',
        'ui2.tsx': 'export function View2() { return <div>TODO: Add user table</div>; }',
        'init.sql': '-- empty sql migration without DDL\n',
      });
      expect(res.isClean).toBe(false);
      expect(res.violations.some((v) => v.rule === 'UI_PLACEHOLDER_TEXT')).toBe(true);
      expect(res.violations.some((v) => v.rule === 'POLYGLOT_STUB_TEXT')).toBe(true);
      expect(res.violations.some((v) => v.rule === 'EMPTY_SQL_MIGRATION')).toBe(true);
    });

    it('accepts clean TSX with placeholder attribute, Go raw strings, Python try/except pass, and SQL DDL', () => {
      const cleanFiles = {
        'UI.tsx': `import React from 'react';
export function InputForm() {
  return <input type="text" placeholder="Enter name" className="input" />;
}`,
        'main.go': `package main
import "fmt"
const sqlQuery = \`SELECT id, name
FROM users;\`
func main() { fmt.Println(sqlQuery) }`,
        'worker.py': `def remove_file(p):
    try:
        import os
        os.remove(p)
    except OSError:
        pass`,
        'schema.sql': `CREATE TABLE items (id SERIAL PRIMARY KEY, title TEXT NOT NULL);`,
      };

      const res = validateZeroStubs(cleanFiles);
      expect(res.astValid).toBe(true);
      expect(res.isClean).toBe(true);
      expect(res.violations).toHaveLength(0);
    });

    it('accepts all dynamically synthesized application code files', () => {
      const topology = injectPrivateNetEnv(synthesizeStack('E-Commerce Platform with Next.js, Go API, Python Worker, PostgreSQL, Valkey'));
      const codeArtifacts = synthesizeCode(topology);
      const res = validateZeroStubs(codeArtifacts.files);
      expect(res.astValid).toBe(true);
      expect(res.isClean).toBe(true);
      expect(res.violations).toHaveLength(0);
    });
  });

  describe('Task 3: Studio Endpoints (/api/synthesize, /api/deploy) & Topology Update Handling', () => {
    it('POST /api/synthesize returns 400 on empty prompt', async () => {
      const res = await fetch(`${studioBaseUrl}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '   ' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Prompt is required and must be a non-empty string');
    });

    it('POST /api/synthesize returns synthesized YAML configs and non-empty code files', async () => {
      const res = await fetch(`${studioBaseUrl}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'RAG Search Engine with React, Python FastAPI, PostgreSQL pgvector, and Valkey',
          projectName: 'ragsearchengine-test',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.projectName).toBe('ragsearchengine-test');
      expect(data.zeropsProjectImportYaml).toContain('project:');
      expect(data.zeropsYaml).toContain('zerops:');
      expect(Object.keys(data.codeFiles).length).toBeGreaterThan(0);
    });

    it('POST /api/deploy triggers deployment pipeline and returns liveUrl', async () => {
      const res = await fetch(`${studioBaseUrl}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'AI Video Clipper Stack',
          projectName: 'aividclipper-deploy',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.projectName).toBe('aividclipper-deploy');
      expect(data.deploymentId).toBeDefined();
      expect(data.liveUrl).toMatch(/https:\/\/.*zerops\.app/);
      expect(data.status).toBe('DEPLOYED');
    });

    it('WebSocket streamer handles and broadcasts topology state updates and completion frame', async () => {
      const wsUpdates: any[] = [];
      const client = new WebSocket(studioWsUrl);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          studio.logger.updateTopology('api-gateway', 'BUILDING', '10.160.0.22:8080');
          studio.logger.updateTopology('api-gateway', 'READY', '10.160.0.22:8080');
          studio.logger.complete('https://aividclipper-deploy.zerops.app', 'aividclipper-deploy', ['webapp', 'apigateway'], { passed: true });
        });

        client.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'topology-update' || msg.type === 'complete') {
            wsUpdates.push(msg);
          }
          if (wsUpdates.length >= 3) {
            client.close();
            resolve();
          }
        });

        client.on('error', reject);
      });

      const building = wsUpdates.find((u) => u.type === 'topology-update' && u.status === 'BUILDING');
      const ready = wsUpdates.find((u) => u.type === 'topology-update' && u.status === 'READY');
      const complete = wsUpdates.find((u) => u.type === 'complete');

      expect(building).toBeDefined();
      expect(building.serviceId).toBe('api-gateway');
      expect(building.privateIp).toBe('10.160.0.22:8080');

      expect(ready).toBeDefined();
      expect(ready.status).toBe('READY');

      expect(complete).toBeDefined();
      expect(complete.liveUrl).toBe('https://aividclipper-deploy.zerops.app');
    });
  });
});
