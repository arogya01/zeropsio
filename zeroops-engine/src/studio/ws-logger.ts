/**
 * src/studio/ws-logger.ts
 * Real-Time WebSocket Log Streamer & Ring Buffer with ANSI formatting and xterm.js compatibility.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';

export interface LogStreamMessage {
  timestamp: string;
  service: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface TopologyNodeState {
  id: string;
  name: string;
  type: 'runtime' | 'database' | 'cache';
  status: 'HEALTHY' | 'BUILDING' | 'FAILED' | 'READY' | 'idle' | 'healthy' | 'building' | 'failed';
  privateIp?: string;
}

export interface WsLoggerOptions {
  maxBufferLength?: number;
  ansiFormatting?: boolean;
}

export class WsLogger {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private logBuffer: LogStreamMessage[] = [];
  private maxBufferLength: number;
  private serviceFilters: Map<WebSocket, string> = new Map();
  private listeners: Array<(msg: LogStreamMessage) => void> = [];

  constructor(optionsOrWs?: WsLoggerOptions | WebSocket) {
    if (optionsOrWs && typeof (optionsOrWs as any).send === 'function') {
      this.maxBufferLength = 1000;
      this.addClient(optionsOrWs as WebSocket);
    } else {
      const opts = (optionsOrWs as WsLoggerOptions) || {};
      this.maxBufferLength = opts.maxBufferLength || 1000;
    }
  }

  /**
   * Attach WebSocket server to an existing HTTP server instance on path /ws/logs
   */
  public attach(server: HttpServer, path: string = '/ws/logs'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket) => {
      this.addClient(ws);

      // Send initial history log replay
      ws.send(
        JSON.stringify({
          type: 'history',
          logs: this.logBuffer
        })
      );

      ws.on('message', (data: Buffer | string) => {
        this.handleClientMessage(ws, data.toString());
      });

      ws.on('close', () => {
        this.removeClient(ws);
      });

      ws.on('error', () => {
        this.removeClient(ws);
      });
    });

    return this.wss;
  }

  /**
   * Register client socket connection
   */
  public addClient(ws: WebSocket): void {
    this.clients.add(ws);
    if (ws.readyState === WebSocket.OPEN) {
      const welcomeAnsi = this.formatAnsi({
        timestamp: new Date().toISOString(),
        service: 'system',
        stream: 'system',
        message: 'Connected to ZeroOps Studio log stream gateway'
      });
      ws.send(
        JSON.stringify({
          type: 'log',
          timestamp: new Date().toISOString(),
          service: 'system',
          stream: 'system',
          message: 'Connected to ZeroOps Studio log stream gateway',
          text: welcomeAnsi
        })
      );
    }
  }

  /**
   * Remove client socket connection
   */
  public removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
    this.serviceFilters.delete(ws);
  }

  /**
   * Sanitizes non-printable control characters while preserving ANSI escape sequences.
   */
  public sanitizeMessage(msg: string): string {
    if (!msg) return '';
    // Strips ASCII 0-8, 11-12, 14-26, 28-31, 127-159 (retains ESC \x1b, LF \n, CR \r, TAB \t)
    return msg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F-\x9F]/g, '');
  }

  /**
   * Formats a LogStreamMessage into an ANSI-colored string suitable for xterm.js.
   */
  public formatAnsi(msg: LogStreamMessage): string {
    const timestampStr = `\x1b[90m[${msg.timestamp || new Date().toISOString()}]\x1b[0m`;

    let serviceColor = '\x1b[36m'; // Cyan default / api
    const svc = (msg.service || 'system').toLowerCase();
    if (svc.includes('frontend') || svc.includes('web')) serviceColor = '\x1b[34m'; // Blue
    else if (svc.includes('worker') || svc.includes('ai')) serviceColor = '\x1b[35m'; // Magenta
    else if (svc.includes('postgres') || svc === 'db' || svc.includes('db-')) serviceColor = '\x1b[33m'; // Yellow
    else if (svc.includes('valkey') || svc === 'cache' || svc.includes('cache-')) serviceColor = '\x1b[31m'; // Red
    else if (svc.includes('system') || svc.includes('zcp') || svc.includes('verifier')) serviceColor = '\x1b[90m'; // Gray

    const serviceBadge = `${serviceColor}[${msg.service || 'system'}]\x1b[0m`;

    let streamBadge = '\x1b[32m[stdout]\x1b[0m';
    if (msg.stream === 'stderr') streamBadge = '\x1b[31m[stderr]\x1b[0m';
    else if (msg.stream === 'system') streamBadge = '\x1b[33m[system]\x1b[0m';

    return `${timestampStr} ${serviceBadge} ${streamBadge} ${this.sanitizeMessage(msg.message)}`;
  }

  /**
   * Primary log emission helper
   */
  public emit(service: string, stream: 'stdout' | 'stderr' | 'system', message: string): LogStreamMessage {
    const logMsg: LogStreamMessage = {
      timestamp: new Date().toISOString(),
      service,
      stream,
      message: this.sanitizeMessage(message)
    };
    this.broadcastLog(logMsg);
    return logMsg;
  }

  /**
   * Alias log method matching interface
   */
  public log(service: string, message: string, stream: 'stdout' | 'stderr' | 'system' = 'stdout'): LogStreamMessage {
    return this.emit(service, stream, message);
  }

  /**
   * Broadcast structured LogStreamMessage to connected clients and local subscribers
   */
  public broadcastLog(msg: LogStreamMessage): void {
    const sanitizedMsg: LogStreamMessage = {
      ...msg,
      timestamp: msg.timestamp || new Date().toISOString(),
      message: this.sanitizeMessage(msg.message)
    };

    // Maintain Ring Buffer (up to maxBufferLength)
    this.logBuffer.push(sanitizedMsg);
    if (this.logBuffer.length > this.maxBufferLength) {
      this.logBuffer.shift();
    }

    // In-memory subscribers
    for (const listener of this.listeners) {
      try {
        listener(sanitizedMsg);
      } catch {
        // Suppress listener errors
      }
    }

    // Broadcast over WebSockets
    const ansiText = this.formatAnsi(sanitizedMsg);
    const payload = JSON.stringify({
      type: 'log',
      timestamp: sanitizedMsg.timestamp,
      service: sanitizedMsg.service,
      stream: sanitizedMsg.stream,
      message: sanitizedMsg.message,
      text: ansiText
    });

    for (const ws of Array.from(this.clients)) {
      if (ws.readyState === WebSocket.OPEN) {
        const filter = this.serviceFilters.get(ws);
        if (!filter || filter === sanitizedMsg.service) {
          try {
            ws.send(payload);
          } catch {
            this.removeClient(ws);
          }
        }
      } else {
        this.removeClient(ws);
      }
    }
  }

  /**
   * Send topology node status update event to connected WS clients
   */
  public updateTopology(serviceId: string, status: string, privateIp?: string): void {
    const payload = JSON.stringify({
      type: 'topology-update',
      serviceId,
      status,
      privateIp
    });

    for (const ws of Array.from(this.clients)) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch {
          this.removeClient(ws);
        }
      }
    }
  }

  /**
   * Send deployment complete event to connected WS clients
   */
  public complete(liveUrl: string, projectName: string, services: any[], audit?: any): void {
    const payload = JSON.stringify({
      type: 'complete',
      liveUrl,
      projectName,
      services,
      audit
    });

    for (const ws of Array.from(this.clients)) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch {
          this.removeClient(ws);
        }
      }
    }
  }

  /**
   * Handle incoming WebSocket client frames
   */
  public handleClientMessage(ws: WebSocket, rawData: string): void {
    try {
      const data = JSON.parse(rawData);
      if (data.type === 'subscribe' || data.action === 'subscribe') {
        if (data.service) {
          this.serviceFilters.set(ws, data.service);
        } else {
          this.serviceFilters.delete(ws);
        }
      } else if (data.type === 'getHistory') {
        const service = data.service;
        const logs = this.getLogs(service);
        ws.send(JSON.stringify({ type: 'history', logs }));
      } else if (data.type === 'ping' || data.action === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      } else if (data.action === 'deploy') {
        this.runDeploymentPipeline(data.prompt || 'AI Cloud Stack', data.projectName);
      }
    } catch {
      // Malformed non-JSON frame (Tier 2 boundary F10-B4 requirement)
      const sanitized = this.sanitizeMessage(rawData);
      this.emit('system', 'stderr', `Received raw text message: ${sanitized}`);
    }
  }

  /**
   * Execute real-time streaming simulation for stack deployment pipeline
   */
  public async runDeploymentPipeline(prompt: string, projectName?: string): Promise<void> {
    const targetProject = projectName || 'zeroops-cloud-stack';
    this.emit('system', 'system', `🚀 Starting deployment pipeline for "${prompt}"...`);
    this.emit('system', 'system', `[PROMPT-SYNTHESIS]: Building topology spec for ${targetProject}...`);

    const services = ['web-frontend', 'api-gateway', 'ai-worker', 'db-postgres', 'cache-valkey'];

    // Transition nodes to BUILDING
    for (const s of services) {
      this.updateTopology(s, 'BUILDING');
      this.emit('zcp', 'system', `[ZCP]: Allocating container slot for ${s}...`);
      await new Promise((r) => setTimeout(r, 60));
    }

    this.emit('web-frontend', 'stdout', `[BUILD]: Compiling Bun@1 web-frontend components...`);
    this.emit('api-gateway', 'stdout', `[BUILD]: Compiling Go@1.22 api-gateway binaries...`);
    this.emit('ai-worker', 'stdout', `[BUILD]: Installing Python@3.12 dependencies for background queue worker...`);
    this.emit('zcp', 'stdout', `[NETWORK]: Injected private IP env vars DB_HOST=10.160.0.21, VALKEY_HOST=10.160.0.25`);

    // Transition nodes to HEALTHY
    const ips: Record<string, string> = {
      'web-frontend': '10.160.0.12:3000',
      'api-gateway': '10.160.0.15:8080',
      'ai-worker': '10.160.0.18:5000',
      'db-postgres': '10.160.0.21:5432',
      'cache-valkey': '10.160.0.25:6379'
    };

    for (const s of services) {
      this.updateTopology(s, 'HEALTHY', ips[s]);
      this.emit(s, 'stdout', `✔ Container ${s} status changed to RUNNING (Health check PASSED)`);
      await new Promise((r) => setTimeout(r, 60));
    }

    const liveUrl = `https://${targetProject}.zerops.app`;
    this.emit('system', 'system', `✔ Deployment SUCCESSFUL. Live URL: ${liveUrl}`);

    this.complete(liveUrl, targetProject, services, {
      passed: true,
      httpStatus: 200,
      privateDbConnected: true,
      privateCacheConnected: true,
      queueE2EPassed: true
    });
  }

  /**
   * Returns buffered logs optionally filtered by service
   */
  public getLogs(service?: string): LogStreamMessage[] {
    if (!service) return [...this.logBuffer];
    return this.logBuffer.filter((l) => l.service === service);
  }

  /**
   * Register local in-memory event listener callback
   */
  public subscribe(callback: (msg: LogStreamMessage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Clear buffer and close connections
   */
  public close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    this.serviceFilters.clear();
    this.logBuffer = [];
  }
}
