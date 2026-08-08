/**
 * src/studio/server.ts
 * Express & WebSocket HTTP Server for ZeroOps Web Studio & Log Streamer.
 */
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
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
export declare function createStudioServer(options?: StudioServerOptions): StudioServerInstance;
//# sourceMappingURL=server.d.ts.map