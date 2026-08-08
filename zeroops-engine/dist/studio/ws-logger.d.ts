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
export declare class WsLogger {
    private wss;
    private clients;
    private logBuffer;
    private maxBufferLength;
    private serviceFilters;
    private listeners;
    constructor(optionsOrWs?: WsLoggerOptions | WebSocket);
    /**
     * Attach WebSocket server to an existing HTTP server instance on path /ws/logs
     */
    attach(server: HttpServer, path?: string): WebSocketServer;
    /**
     * Register client socket connection
     */
    addClient(ws: WebSocket): void;
    /**
     * Remove client socket connection
     */
    removeClient(ws: WebSocket): void;
    /**
     * Sanitizes non-printable control characters while preserving ANSI escape sequences.
     */
    sanitizeMessage(msg: string): string;
    /**
     * Formats a LogStreamMessage into an ANSI-colored string suitable for xterm.js.
     */
    formatAnsi(msg: LogStreamMessage): string;
    /**
     * Primary log emission helper
     */
    emit(service: string, stream: 'stdout' | 'stderr' | 'system', message: string): LogStreamMessage;
    /**
     * Alias log method matching interface
     */
    log(service: string, message: string, stream?: 'stdout' | 'stderr' | 'system'): LogStreamMessage;
    /**
     * Broadcast structured LogStreamMessage to connected clients and local subscribers
     */
    broadcastLog(msg: LogStreamMessage): void;
    /**
     * Send topology node status update event to connected WS clients
     */
    updateTopology(serviceId: string, status: string, privateIp?: string): void;
    /**
     * Send deployment complete event to connected WS clients
     */
    complete(liveUrl: string, projectName: string, services: any[], audit?: any): void;
    /**
     * Handle incoming WebSocket client frames
     */
    handleClientMessage(ws: WebSocket, rawData: string): void;
    /**
     * Execute real-time streaming simulation for stack deployment pipeline
     */
    runDeploymentPipeline(prompt: string, projectName?: string): Promise<void>;
    /**
     * Returns buffered logs optionally filtered by service
     */
    getLogs(service?: string): LogStreamMessage[];
    /**
     * Register local in-memory event listener callback
     */
    subscribe(callback: (msg: LogStreamMessage) => void): () => void;
    /**
     * Clear buffer and close connections
     */
    close(): void;
}
//# sourceMappingURL=ws-logger.d.ts.map