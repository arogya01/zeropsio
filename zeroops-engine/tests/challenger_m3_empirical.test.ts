/**
 * tests/challenger_m3_empirical.test.ts
 * Empirical Challenge Harness for Milestone M3 — Pre-Built Full-Stack Template Library & Code Synthesizer
 * Built by Challenger 1 (empirically testing template hydration, 5-container stacks, zerops-import.yml,
 * zerops.yml per service, env injection, pgvector migrations, and Whisper worker queue structures).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import fs from 'fs';
import * as yamlModule from 'js-yaml';
const yaml: typeof import('js-yaml') = (yamlModule as any).default || yamlModule;
import { WebSocket } from 'ws';

// The server module builds a module-scope `healthChecker` singleton
// (`new HealthChecker()`, no options) the instant it is required below.
// LiveAuditor now defaults to REAL network probing, so without this the
// WebSocket-pipeline tests in this file would depend on genuine outbound
// connectivity to fabricated *.zerops.app hosts. Opt this file's server
// instance into mock mode explicitly, at the require call site, so the
// mocking is visible here rather than ambient — production `index.js`
// itself is untouched and still defaults to real probing. Uses vi.stubEnv
// (not a raw `process.env` assignment) so restoration is handled by
// Vitest's own env-stub bookkeeping rather than a hand-written cleanup
// line that could be skipped if something upstream throws.
vi.stubEnv('MOCK_MODE', 'true');
const { server } = require('../src/server/index');
const childProcess = require('child_process');
import { validateZeroStubs } from '../src/code-gen/stub-validator';
import { ZcpClient } from '../src/zcp/zcp-client';
import { fakeZcliProc } from './helpers/fake-zcli-proc';

describe('Milestone M3 Empirical Challenge Suite — Template Library & Hydration Engine', () => {
  let httpServer: Server;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer = server.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsUrl = `ws://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Undo the module-load-time MOCK_MODE override above first, so it is
    // restored even if closing the server below throws.
    vi.unstubAllEnvs();
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  const TEMPLATES = ['ai-video-clipper', 'ecommerce-platform', 'rag-search-engine'] as const;

  describe('1. Template Catalog API Endpoints & Contract Completeness', () => {
    it('GET /api/templates returns complete catalog for all 3 pre-built multi-container templates', async () => {
      const res = await fetch(`${baseUrl}/api/templates`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as { templates: any[] };
      expect(data).toHaveProperty('templates');
      expect(Array.isArray(data.templates)).toBe(true);
      expect(data.templates.length).toBeGreaterThanOrEqual(3);

      const foundIds = data.templates.map((t) => t.id);
      for (const tId of TEMPLATES) {
        expect(foundIds).toContain(tId);
      }

      for (const tmpl of data.templates) {
        expect(tmpl.id).toBeDefined();
        expect(tmpl.name).toBeDefined();
        expect(tmpl.description).toBeDefined();
        expect(tmpl.icon).toBeDefined();
        expect(Array.isArray(tmpl.services)).toBe(true);
        expect(tmpl.services.length).toBe(5); // 5-container stack definition
      }
    });

    it('GET /api/templates/:id fetches detail and importYaml for each template', async () => {
      for (const tId of TEMPLATES) {
        const res = await fetch(`${baseUrl}/api/templates/${tId}`);
        expect(res.status).toBe(200);

        const data = (await res.json()) as any;
        expect(data.id).toBe(tId);
        expect(data.name).toBeDefined();
        expect(typeof data.importYaml).toBe('string');
        expect(data.importYaml.length).toBeGreaterThan(100);
        expect(data.importYaml).toContain('project:');
        expect(data.importYaml).toContain('services:');
      }
    });

    it('GET /api/templates/unknown-template-id returns 404', async () => {
      const res = await fetch(`${baseUrl}/api/templates/unknown-template-id`);
      expect(res.status).toBe(404);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Template not found');
    });
  });

  describe('2. 5-Container Stack Definition & zerops-import.yml Structural Audit', () => {
    for (const tId of TEMPLATES) {
      it(`validates 5-container zerops-import.yml structure for template '${tId}'`, () => {
        const importPath = path.join(__dirname, `../src/templates/${tId}/zerops-import.yml`);
        expect(fs.existsSync(importPath)).toBe(true);

        const content = fs.readFileSync(importPath, 'utf-8');
        const parsed: any = yaml.load(content);

        expect(parsed).toBeDefined();
        expect(parsed.project).toBeDefined();
        expect(parsed.project.name).toBe(tId.replace(/-/g, ''));
        expect(Array.isArray(parsed.project.services)).toBe(true);
        expect(parsed.project.services.length).toBe(5);

        const serviceNames = parsed.project.services.map((s: any) => s.name);
        expect(serviceNames).toContain('webapp');
        expect(serviceNames).toContain('apigateway');
        expect(serviceNames).toContain('aiworker');
        expect(serviceNames).toContain('dbpostgres');
        expect(serviceNames).toContain('cachevalkey');

        const serviceTypes = parsed.project.services.map((s: any) => s.type);
        expect(serviceTypes).toContain('nodejs@22');
        expect(serviceTypes).toContain('go@1.22');
        expect(serviceTypes).toContain('python@3.12');
        expect(serviceTypes.some((t: string) => t.startsWith('postgresql'))).toBe(true);
        expect(serviceTypes.some((t: string) => t.startsWith('valkey'))).toBe(true);
      });
    }
  });

  describe('3. Per-Service zerops.yml & Inter-Service Environment Variable Injection Audit', () => {
    for (const tId of TEMPLATES) {
      describe(`Template: ${tId}`, () => {
        it('webapp service zerops.yml configures API_GATEWAY_URL and PORT', () => {
          const webappYamlPath = path.join(__dirname, `../src/templates/${tId}/webapp/zerops.yml`);
          expect(fs.existsSync(webappYamlPath)).toBe(true);

          const content = fs.readFileSync(webappYamlPath, 'utf-8');
          const parsed: any = yaml.load(content);

          const setup = parsed.zerops?.[0];
          expect(setup).toBeDefined();
          expect(setup.setup).toBe('webapp');
          expect(setup.run.envVariables.PORT).toBe('3000');
          expect(setup.run.envVariables.API_GATEWAY_URL).toBe('http://apigateway:8080');
        });

        it('apigateway service zerops.yml configures DB_HOST, VALKEY_HOST, and AI_WORKER_URL', () => {
          const apiYamlPath = path.join(__dirname, `../src/templates/${tId}/apigateway/zerops.yml`);
          expect(fs.existsSync(apiYamlPath)).toBe(true);

          const content = fs.readFileSync(apiYamlPath, 'utf-8');
          const parsed: any = yaml.load(content);

          const setup = parsed.zerops?.[0];
          expect(setup).toBeDefined();
          expect(setup.setup).toBe('apigateway');
          const envs = setup.run.envVariables;
          expect(envs.PORT).toBe('8080');
          expect(envs.DB_HOST).toBe('dbpostgres');
          expect(envs.DB_PORT).toBe('5432');
          expect(envs.VALKEY_HOST).toBe('cachevalkey');
          expect(envs.VALKEY_PORT).toBe('6379');
          expect(envs.AI_WORKER_URL).toBe('http://aiworker:8000');
        });

        it('aiworker service zerops.yml configures DB_HOST, VALKEY_HOST, and PORT', () => {
          const workerYamlPath = path.join(__dirname, `../src/templates/${tId}/aiworker/zerops.yml`);
          expect(fs.existsSync(workerYamlPath)).toBe(true);

          const content = fs.readFileSync(workerYamlPath, 'utf-8');
          const parsed: any = yaml.load(content);

          const setup = parsed.zerops?.[0];
          expect(setup).toBeDefined();
          expect(setup.setup).toBe('aiworker');
          const envs = setup.run.envVariables;
          expect(envs.PORT).toBe('8000');
          expect(envs.DB_HOST).toBe('dbpostgres');
          expect(envs.VALKEY_HOST).toBe('cachevalkey');
        });
      });
    }
  });

  describe('4. SQL DDL Migrations & pgvector / uuid-ossp Extension Audit', () => {
    it('rag-search-engine migration DDL contains pgvector (CREATE EXTENSION IF NOT EXISTS vector;) and uuid-ossp', () => {
      const ragSqlPath = path.join(__dirname, '../src/templates/rag-search-engine/migrations/001_init.sql');
      expect(fs.existsSync(ragSqlPath)).toBe(true);

      const sqlContent = fs.readFileSync(ragSqlPath, 'utf-8');
      expect(sqlContent).toContain('CREATE EXTENSION IF NOT EXISTS vector;');
      expect(sqlContent).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS documents');
      expect(sqlContent).toContain('embedding vector(1536)');
    });

    it('ai-video-clipper migration DDL contains video_clips schema with transcript metadata', () => {
      const clipperSqlPath = path.join(__dirname, '../src/templates/ai-video-clipper/migrations/001_init.sql');
      expect(fs.existsSync(clipperSqlPath)).toBe(true);

      const sqlContent = fs.readFileSync(clipperSqlPath, 'utf-8');
      expect(sqlContent).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS video_clips');
      expect(sqlContent).toContain('transcript TEXT');
    });

    it('ecommerce-platform migration DDL contains products catalog schema', () => {
      const ecomSqlPath = path.join(__dirname, '../src/templates/ecommerce-platform/migrations/001_init.sql');
      expect(fs.existsSync(ecomSqlPath)).toBe(true);

      const sqlContent = fs.readFileSync(ecomSqlPath, 'utf-8');
      expect(sqlContent).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS products');
      expect(sqlContent).toContain('price NUMERIC(10, 2)');
    });
  });

  describe('5. AI Worker Queue & Whisper / Embedder / Recommendation Inference Structure Audit', () => {
    it('ai-video-clipper aiworker uses openai/whisper-large-v3 model and /transcribe handler', () => {
      const pyPath = path.join(__dirname, '../src/templates/ai-video-clipper/aiworker/main.py');
      expect(fs.existsSync(pyPath)).toBe(true);

      const pyContent = fs.readFileSync(pyPath, 'utf-8');
      expect(pyContent).toContain('openai/whisper-large-v3');
      expect(pyContent).toContain('def do_POST(self):');
      expect(pyContent).toContain('/transcribe');
      expect(pyContent).toContain('DB_HOST');
      expect(pyContent).toContain('VALKEY_HOST');
    });

    it('rag-search-engine aiworker uses text-embedding-3-small model and /embed handler', () => {
      const pyPath = path.join(__dirname, '../src/templates/rag-search-engine/aiworker/main.py');
      expect(fs.existsSync(pyPath)).toBe(true);

      const pyContent = fs.readFileSync(pyPath, 'utf-8');
      expect(pyContent).toContain('text-embedding-3-small');
      expect(pyContent).toContain('def do_POST(self):');
      expect(pyContent).toContain('/embed');
      expect(pyContent).toContain('DB_HOST');
      expect(pyContent).toContain('VALKEY_HOST');
    });

    it('ecommerce-platform aiworker uses collaborative-filtering-v2 engine and /recommend handler', () => {
      const pyPath = path.join(__dirname, '../src/templates/ecommerce-platform/aiworker/main.py');
      expect(fs.existsSync(pyPath)).toBe(true);

      const pyContent = fs.readFileSync(pyPath, 'utf-8');
      expect(pyContent).toContain('collaborative-filtering-v2');
      expect(pyContent).toContain('/recommend');
      expect(pyContent).toContain('DB_HOST');
      expect(pyContent).toContain('VALKEY_HOST');
    });
  });

  describe('6. Zero-Stub AST Code Quality Verification Across All Template Files', () => {
    it('runs AST validator across all template code files and verifies clean zero-stub result', () => {
      const templatesDir = path.join(__dirname, '../src/templates');
      const filesToValidate: Record<string, string> = {};

      for (const tId of TEMPLATES) {
        const dirPath = path.join(templatesDir, tId);
        const relativePaths = [
          'webapp/server.js',
          'apigateway/main.go',
          'aiworker/main.py',
          'migrations/001_init.sql'
        ];

        for (const rel of relativePaths) {
          const fullPath = path.join(dirPath, rel);
          if (fs.existsSync(fullPath)) {
            filesToValidate[`${tId}/${rel}`] = fs.readFileSync(fullPath, 'utf-8');
          }
        }
      }

      expect(Object.keys(filesToValidate).length).toBe(12);

      const validation = validateZeroStubs(filesToValidate);
      expect(validation.isClean).toBe(true);
      expect(validation.astValid).toBe(true);
      expect(validation.stubsFound).toHaveLength(0);
      expect(validation.violations).toHaveLength(0);
    });
  });

  describe('7. 1-Click Template Hydration WebSocket Pipeline Execution', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    for (const tId of TEMPLATES) {
      it(`hydrates '${tId}' via WebSocket deploy trigger and streams 5-container topology state transitions`, async () => {
        // Mock the provisioning boundary so this test's outcome is a
        // controlled invariant, not ambient state. Without this, the test
        // invokes the REAL `zcli` binary — on a machine with a real
        // authenticated zcli session, that call's success/failure is
        // uncontrolled and unrelated to what this test is verifying (the
        // WebSocket log/topology/complete-message pipeline).
        const mockUrl = `https://${tId.replace(/-/g, '')}-a1b2.zerops.app`;
        vi.spyOn(childProcess, 'spawn').mockImplementation(() =>
          fakeZcliProc(0, `[zcli] project imported, live at ${mockUrl}\n`)
        );

        const ws = new WebSocket(wsUrl);
        await new Promise((r) => ws.on('open', r));

        const receivedMessages: any[] = [];
        const logs: string[] = [];
        const topologyUpdates: Record<string, string> = {};

        try {
          const completionPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Deployment timed out for template ${tId}`));
            }, 15000);

            ws.on('message', (data: any) => {
              try {
                const parsed = JSON.parse(data.toString());
                receivedMessages.push(parsed);
                if (parsed.type === 'log') {
                  logs.push(parsed.text);
                }
                if (parsed.type === 'topology-update') {
                  topologyUpdates[parsed.serviceId] = parsed.status;
                }
                if (parsed.type === 'complete') {
                  clearTimeout(timeout);
                  resolve();
                }
              } catch {
                // Ignore non-json
              }
            });
          });

          // Trigger 1-click template deploy
          ws.send(JSON.stringify({
            action: 'deploy',
            templateId: tId,
            zeropsToken: 'demo-token-123'
          }));

          await completionPromise;

          // Assertions
          expect(logs.some((l) => l.includes('Beginning ZeroOps Full-Stack Cloud Factory Pipeline'))).toBe(true);
          expect(logs.some((l) => l.includes(tId))).toBe(true);

          const expectedServices = ['web-frontend', 'api-gateway', 'ai-worker', 'db-postgres', 'cache-valkey'];
          for (const sId of expectedServices) {
            expect(topologyUpdates[sId]).toBe('healthy');
          }

          const completeMsg = receivedMessages.find((m) => m.type === 'complete');
          expect(completeMsg).toBeDefined();
          // Controlled SUCCESS case: zcli exited 0 and printed a real-shaped
          // URL, so the deploy is genuinely live and the health audit
          // (running in mock mode) can honestly report success.
          expect(completeMsg.liveUrl).toBe(mockUrl);
          expect(completeMsg.audit.success).toBe(true);
        } finally {
          ws.close();
        }
      }, 15000);
    }

    it('reports honest failure (null liveUrl, failed audit) when zcli exits non-zero', async () => {
      // Controlled FAILURE case: mirrors the success test above but with a
      // non-zero exit code and no URL in stdout — restores coverage for the
      // failure direction without depending on ambient zcli behavior.
      vi.spyOn(childProcess, 'spawn').mockImplementation(() => fakeZcliProc(1));

      const tId = TEMPLATES[0];
      const ws = new WebSocket(wsUrl);
      await new Promise((r) => ws.on('open', r));

      const receivedMessages: any[] = [];

      try {
        const completionPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Deployment timed out for template ${tId}`));
          }, 15000);

          ws.on('message', (data: any) => {
            try {
              const parsed = JSON.parse(data.toString());
              receivedMessages.push(parsed);
              if (parsed.type === 'complete') {
                clearTimeout(timeout);
                resolve();
              }
            } catch {
              // Ignore non-json
            }
          });
        });

        ws.send(JSON.stringify({
          action: 'deploy',
          templateId: tId,
          zeropsToken: 'demo-token-123'
        }));

        await completionPromise;

        const completeMsg = receivedMessages.find((m) => m.type === 'complete');
        expect(completeMsg).toBeDefined();
        expect(completeMsg.liveUrl).toBeNull();
        expect(completeMsg.audit.success).toBe(false);
      } finally {
        ws.close();
      }
    }, 15000);
  });

  describe('8. ZcpClient Template Import Integration Test', () => {
    for (const tId of TEMPLATES) {
      it(`imports '${tId}' zerops-import.yml into ZcpClient and provisions mock 5-container project topology`, async () => {
        const importPath = path.join(__dirname, `../src/templates/${tId}/zerops-import.yml`);
        const yamlContent = fs.readFileSync(importPath, 'utf-8');

        const zcp = new ZcpClient({ mode: 'mock' });
        const project = await zcp.importProject(yamlContent);

        expect(project.name).toBe(tId.replace(/-/g, ''));
        expect(project.services.length).toBe(5);

        const topology = await zcp.getPrivateTopology(project.id);
        expect(topology).toBeDefined();
        expect(Object.keys(topology).length).toBe(5);
      });
    }
  });
});
