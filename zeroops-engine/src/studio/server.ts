/**
 * src/studio/server.ts
 * Express & WebSocket HTTP Server for ZeroOps Web Studio & Log Streamer.
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';

import { synthesizeStack } from '../synthesizer/stack-synthesizer.js';
import { injectPrivateNetEnv } from '../synthesizer/private-net.js';
import { generateZeropsConfigs } from '../synthesizer/yaml-generator.js';
import { synthesizeCode } from '../code-gen/code-synthesizer.js';
import { ZcpClient } from '../zcp/zcp-client.js';
import { WsLogger } from './ws-logger.js';

export interface StudioServerOptions {
  port?: number;
  host?: string;
  mock?: boolean;
}

export interface StudioServerInstance {
  app: express.Express;
  server: http.Server;
  wss: WebSocketServer;
  logger: WsLogger;
  listen: (port?: number, host?: string) => Promise<number>;
  close: () => Promise<void>;
}

export function createStudioServer(options: StudioServerOptions = {}): StudioServerInstance {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const server = http.createServer(app);
  const logger = new WsLogger();
  const wss = logger.attach(server, '/ws/logs');

  const zcpClient = new ZcpClient({ mode: options.mock !== false ? 'mock' : 'real' });

  // Locate static public directory dynamically
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const candidateDirs = [
    path.resolve(currentDir, 'public'),
    path.resolve(process.cwd(), 'src/studio/public'),
    path.resolve(process.cwd(), 'zeroops-engine/src/studio/public'),
    path.resolve(currentDir, '../../src/studio/public')
  ];

  const staticDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
  app.use(express.static(staticDir));

  // --- REST API Endpoints ---

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // System status & topology
  app.get('/api/status', async (_req: Request, res: Response) => {
    try {
      const topology = await zcpClient.getPrivateTopology('default-proj');
      res.json({
        status: 'RUNNING',
        timestamp: new Date().toISOString(),
        topology
      });
    } catch {
      res.json({
        status: 'RUNNING',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET Topology Map
  app.get('/api/topology', async (req: Request, res: Response) => {
    const projectId = (req.query.projectId as string) || 'default-proj';
    const topology = await zcpClient.getPrivateTopology(projectId);
    res.json(topology);
  });

  // POST /api/synthesize - Synthesize stack topology, YAML configs, and full application code
  app.post('/api/synthesize', (req: Request, res: Response) => {
    const { prompt, projectName } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required and must be a non-empty string' });
    }

    try {
      const rawTopology = synthesizeStack(prompt, { projectName });
      const enrichedTopology = injectPrivateNetEnv(rawTopology);
      const configs = generateZeropsConfigs(enrichedTopology);
      const codeArtifacts = synthesizeCode(enrichedTopology);

      return res.json({
        success: true,
        projectName: enrichedTopology.projectName,
        topology: enrichedTopology,
        zeropsProjectImportYaml: configs.zeropsProjectImportYaml,
        zeropsYaml: configs.zeropsYaml,
        codeFiles: codeArtifacts.files,
        codeArtifacts
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Synthesis failed' });
    }
  });

  // POST /api/deploy - Trigger autonomous build & deployment pipeline
  app.post('/api/deploy', async (req: Request, res: Response) => {
    const { prompt, projectName } = req.body || {};
    const name = projectName || 'zeroops-cloud-stack';
    const promptText = prompt || 'Default ZeroOps Full-Stack Cloud Factory';

    try {
      const rawTopology = synthesizeStack(promptText, { projectName: name });
      const enrichedTopology = injectPrivateNetEnv(rawTopology);
      const configs = generateZeropsConfigs(enrichedTopology);

      await zcpClient.importProject(configs.zeropsProjectImportYaml);
      const deployResult = await zcpClient.deployProject(name, configs.zeropsYaml);
      const liveUrl = deployResult.publicUrl || `https://${name}.zerops.app`;

      // Broadcast logs to WS streamer
      logger.runDeploymentPipeline(promptText, name).catch(() => {});

      return res.json({
        success: true,
        projectName: name,
        deploymentId: deployResult.deploymentId,
        liveUrl,
        publicUrl: liveUrl,
        status: 'DEPLOYED',
        topology: enrichedTopology
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Deployment failed' });
    }
  });

  // Fallback route serving SPA index.html for non-API requests
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
      return next();
    }
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Web Studio index.html not found');
    }
  });

  const listen = (overridePort?: number, overrideHost?: string): Promise<number> => {
    const p = overridePort !== undefined ? overridePort : options.port !== undefined ? options.port : 3000;
    const h = overrideHost || options.host || '0.0.0.0';

    return new Promise((resolve, reject) => {
      server.listen(p, h, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        } else {
          resolve(p);
        }
      });
      server.on('error', reject);
    });
  };

  const close = (): Promise<void> => {
    return new Promise((resolve) => {
      logger.close();
      server.close(() => resolve());
    });
  };

  return {
    app,
    server,
    wss,
    logger,
    listen,
    close
  };
}
