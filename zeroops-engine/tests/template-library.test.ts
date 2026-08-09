import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import fs from 'fs';
import * as yamlModule from 'js-yaml';
const yaml: typeof import('js-yaml') = (yamlModule as any).default || yamlModule;

const { server } = require('../src/server/index');
import { validateZeroStubs } from '../src/code-gen/stub-validator';

describe('Template Library & AST Validation Suite', () => {
  let httpServer: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer = server.listen(0, () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  describe('Template Catalog Endpoints (/api/templates & /api/templates/:id)', () => {
    it('GET /api/templates returns catalog listing all 3 pre-built stacks', async () => {
      const res = await fetch(`${baseUrl}/api/templates`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('templates');
      expect(Array.isArray(data.templates)).toBe(true);
      expect(data.templates.length).toBeGreaterThanOrEqual(3);

      const templateIds = data.templates.map((t: any) => t.id);
      expect(templateIds).toContain('ai-video-clipper');
      expect(templateIds).toContain('ecommerce-platform');
      expect(templateIds).toContain('rag-search-engine');

      for (const t of data.templates) {
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('description');
        expect(t).toHaveProperty('icon');
        expect(t).toHaveProperty('services');
        expect(Array.isArray(t.services)).toBe(true);
      }
    });

    it('GET /api/templates/:id returns full metadata and importYaml for valid template', async () => {
      const validIds = ['ai-video-clipper', 'ecommerce-platform', 'rag-search-engine'];

      for (const id of validIds) {
        const res = await fetch(`${baseUrl}/api/templates/${id}`);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.id).toBe(id);
        expect(data.name).toBeDefined();
        expect(typeof data.importYaml).toBe('string');
        expect(data.importYaml.length).toBeGreaterThan(50);
        expect(data.importYaml).toContain('project:');
      }
    });

    it('GET /api/templates/:id returns 404 for unknown template ID', async () => {
      const res = await fetch(`${baseUrl}/api/templates/non-existent-template-id`);
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Template not found');
    });
  });

  describe('zerops-import.yml Synthesis Verification for Pre-Built Stacks', () => {
    it('synthesizes and validates zerops-import.yml for AI Video Clipper', () => {
      const filePath = path.join(__dirname, '../src/templates/ai-video-clipper/zerops-import.yml');
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed: any = yaml.load(content);

      expect(parsed.project.name).toBe('aivideoclipper');
      expect(Array.isArray(parsed.project.services)).toBe(true);
      expect(parsed.project.services.length).toBe(5);

      const serviceNames = parsed.project.services.map((s: any) => s.name);
      expect(serviceNames).toContain('webapp');
      expect(serviceNames).toContain('apigateway');
      expect(serviceNames).toContain('aiworker');
      expect(serviceNames).toContain('dbpostgres');
      expect(serviceNames).toContain('cachevalkey');
    });

    it('synthesizes and validates zerops-import.yml for Multi-Service E-Commerce', () => {
      const filePath = path.join(__dirname, '../src/templates/ecommerce-platform/zerops-import.yml');
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed: any = yaml.load(content);

      expect(parsed.project.name).toBe('ecommerceplatform');
      expect(Array.isArray(parsed.project.services)).toBe(true);
      expect(parsed.project.services.length).toBe(5);

      const serviceTypes = parsed.project.services.map((s: any) => s.type);
      expect(serviceTypes).toContain('nodejs@22');
      expect(serviceTypes).toContain('go@1.22');
      expect(serviceTypes).toContain('python@3.12');
      expect(serviceTypes.some((t: string) => t.startsWith('postgresql'))).toBe(true);
      expect(serviceTypes.some((t: string) => t.startsWith('valkey'))).toBe(true);
    });

    it('synthesizes and validates zerops-import.yml for RAG Search Engine with pgvector/Whisper', () => {
      const filePath = path.join(__dirname, '../src/templates/rag-search-engine/zerops-import.yml');
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed: any = yaml.load(content);

      expect(parsed.project.name).toBe('ragsearchengine');
      expect(Array.isArray(parsed.project.services)).toBe(true);
      expect(parsed.project.services.length).toBe(5);

      // Verify dbpostgres service configuration
      const dbService = parsed.project.services.find((s: any) => s.name === 'dbpostgres');
      expect(dbService).toBeDefined();
      expect(dbService.type).toContain('postgresql');
    });
  });

  describe('AST Zero-Stub Validator on Template Source Code', () => {
    it('validates that template source files across all 3 stacks contain zero stubs/placeholders', () => {
      const templatesDir = path.join(__dirname, '../src/templates');
      const templateDirs = ['ai-video-clipper', 'ecommerce-platform', 'rag-search-engine'];

      const codeFiles: Record<string, string> = {};

      for (const dir of templateDirs) {
        const fullDir = path.join(templatesDir, dir);
        const subFiles = [
          'webapp/server.js',
          'apigateway/main.go',
          'aiworker/main.py',
        ];

        for (const sf of subFiles) {
          const fp = path.join(fullDir, sf);
          if (fs.existsSync(fp)) {
            const fileKey = `${dir}/${sf}`;
            codeFiles[fileKey] = fs.readFileSync(fp, 'utf-8');
          }
        }
      }

      // Ensure we found code files across all templates
      expect(Object.keys(codeFiles).length).toBeGreaterThanOrEqual(9);

      const result = validateZeroStubs(codeFiles);
      expect(result.isClean).toBe(true);
      expect(result.astValid).toBe(true);
      expect(result.stubsFound).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
    });

    it('verifies SQL DDL migrations with pgvector extension and Whisper worker structures', () => {
      const ragSqlPath = path.join(__dirname, '../src/templates/rag-search-engine/migrations/001_init.sql');
      expect(fs.existsSync(ragSqlPath)).toBe(true);
      const ragSql = fs.readFileSync(ragSqlPath, 'utf-8');
      expect(ragSql).toContain('CREATE EXTENSION IF NOT EXISTS vector;');
      expect(ragSql).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

      const clipperWorkerPath = path.join(__dirname, '../src/templates/ai-video-clipper/aiworker/main.py');
      expect(fs.existsSync(clipperWorkerPath)).toBe(true);
      const clipperWorker = fs.readFileSync(clipperWorkerPath, 'utf-8');
      expect(clipperWorker).toContain('openai/whisper-large-v3');

      const validation = validateZeroStubs({
        'rag-search-engine/migrations/001_init.sql': ragSql,
        'ai-video-clipper/aiworker/main.py': clipperWorker
      });
      expect(validation.isClean).toBe(true);
      expect(validation.astValid).toBe(true);
    });
  });
});
