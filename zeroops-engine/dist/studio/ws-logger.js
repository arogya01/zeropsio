"use strict";
/**
 * src/studio/ws-logger.ts
 * Real-Time WebSocket Log Streamer & Ring Buffer with ANSI formatting and xterm.js compatibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsLogger = void 0;
const ws_1 = require("ws");
class WsLogger {
    wss = null;
    clients = new Set();
    logBuffer = [];
    maxBufferLength;
    serviceFilters = new Map();
    listeners = [];
    constructor(optionsOrWs) {
        if (optionsOrWs && typeof optionsOrWs.send === 'function') {
            this.maxBufferLength = 1000;
            this.addClient(optionsOrWs);
        }
        else {
            const opts = optionsOrWs || {};
            this.maxBufferLength = opts.maxBufferLength || 1000;
        }
    }
    /**
     * Attach WebSocket server to an existing HTTP server instance on path /ws/logs
     */
    attach(server, path = '/ws/logs') {
        this.wss = new ws_1.WebSocketServer({ server, path });
        this.wss.on('connection', (ws) => {
            this.addClient(ws);
            // Send initial history log replay
            ws.send(JSON.stringify({
                type: 'history',
                logs: this.logBuffer
            }));
            ws.on('message', (data) => {
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
    addClient(ws) {
        this.clients.add(ws);
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            const welcomeAnsi = this.formatAnsi({
                timestamp: new Date().toISOString(),
                service: 'system',
                stream: 'system',
                message: 'Connected to ZeroOps Studio log stream gateway'
            });
            ws.send(JSON.stringify({
                type: 'log',
                timestamp: new Date().toISOString(),
                service: 'system',
                stream: 'system',
                message: 'Connected to ZeroOps Studio log stream gateway',
                text: welcomeAnsi
            }));
        }
    }
    /**
     * Remove client socket connection
     */
    removeClient(ws) {
        this.clients.delete(ws);
        this.serviceFilters.delete(ws);
    }
    /**
     * Sanitizes non-printable control characters while preserving ANSI escape sequences.
     */
    sanitizeMessage(msg) {
        if (!msg)
            return '';
        // Strips ASCII 0-8, 11-12, 14-26, 28-31, 127-159 (retains ESC \x1b, LF \n, CR \r, TAB \t)
        return msg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F-\x9F]/g, '');
    }
    /**
     * Formats a LogStreamMessage into an ANSI-colored string suitable for xterm.js.
     */
    formatAnsi(msg) {
        const timestampStr = `\x1b[90m[${msg.timestamp || new Date().toISOString()}]\x1b[0m`;
        let serviceColor = '\x1b[36m'; // Cyan default / api
        const svc = (msg.service || 'system').toLowerCase();
        if (svc.includes('frontend') || svc.includes('web'))
            serviceColor = '\x1b[34m'; // Blue
        else if (svc.includes('worker') || svc.includes('ai'))
            serviceColor = '\x1b[35m'; // Magenta
        else if (svc.includes('postgres') || svc === 'db' || svc.includes('db-'))
            serviceColor = '\x1b[33m'; // Yellow
        else if (svc.includes('valkey') || svc === 'cache' || svc.includes('cache-'))
            serviceColor = '\x1b[31m'; // Red
        else if (svc.includes('system') || svc.includes('zcp') || svc.includes('verifier'))
            serviceColor = '\x1b[90m'; // Gray
        const serviceBadge = `${serviceColor}[${msg.service || 'system'}]\x1b[0m`;
        let streamBadge = '\x1b[32m[stdout]\x1b[0m';
        if (msg.stream === 'stderr')
            streamBadge = '\x1b[31m[stderr]\x1b[0m';
        else if (msg.stream === 'system')
            streamBadge = '\x1b[33m[system]\x1b[0m';
        return `${timestampStr} ${serviceBadge} ${streamBadge} ${this.sanitizeMessage(msg.message)}`;
    }
    /**
     * Primary log emission helper
     */
    emit(service, stream, message) {
        const logMsg = {
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
    log(service, message, stream = 'stdout') {
        return this.emit(service, stream, message);
    }
    /**
     * Broadcast structured LogStreamMessage to connected clients and local subscribers
     */
    broadcastLog(msg) {
        const sanitizedMsg = {
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
            }
            catch {
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
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                const filter = this.serviceFilters.get(ws);
                if (!filter || filter === sanitizedMsg.service) {
                    try {
                        ws.send(payload);
                    }
                    catch {
                        this.removeClient(ws);
                    }
                }
            }
            else {
                this.removeClient(ws);
            }
        }
    }
    /**
     * Send topology node status update event to connected WS clients
     */
    updateTopology(serviceId, status, privateIp) {
        const payload = JSON.stringify({
            type: 'topology-update',
            serviceId,
            status,
            privateIp
        });
        for (const ws of Array.from(this.clients)) {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    ws.send(payload);
                }
                catch {
                    this.removeClient(ws);
                }
            }
        }
    }
    /**
     * Send deployment complete event to connected WS clients
     */
    complete(liveUrl, projectName, services, audit) {
        const payload = JSON.stringify({
            type: 'complete',
            liveUrl,
            projectName,
            services,
            audit
        });
        for (const ws of Array.from(this.clients)) {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    ws.send(payload);
                }
                catch {
                    this.removeClient(ws);
                }
            }
        }
    }
    /**
     * Handle incoming WebSocket client frames
     */
    handleClientMessage(ws, rawData) {
        try {
            const data = JSON.parse(rawData);
            if (data.type === 'subscribe' || data.action === 'subscribe') {
                if (data.service) {
                    this.serviceFilters.set(ws, data.service);
                }
                else {
                    this.serviceFilters.delete(ws);
                }
            }
            else if (data.type === 'getHistory') {
                const service = data.service;
                const logs = this.getLogs(service);
                ws.send(JSON.stringify({ type: 'history', logs }));
            }
            else if (data.type === 'ping' || data.action === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
            else if (data.action === 'deploy') {
                this.runDeploymentPipeline(data.prompt || 'AI Cloud Stack', data.projectName);
            }
        }
        catch {
            // Malformed non-JSON frame (Tier 2 boundary F10-B4 requirement)
            const sanitized = this.sanitizeMessage(rawData);
            this.emit('system', 'stderr', `Received raw text message: ${sanitized}`);
        }
    }
    /**
     * Execute real-time streaming simulation for stack deployment pipeline
     */
    async runDeploymentPipeline(prompt, projectName) {
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
        const ips = {
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
    getLogs(service) {
        if (!service)
            return [...this.logBuffer];
        return this.logBuffer.filter((l) => l.service === service);
    }
    /**
     * Register local in-memory event listener callback
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
        };
    }
    /**
     * Clear buffer and close connections
     */
    close() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
        this.clients.clear();
        this.serviceFilters.clear();
        this.logBuffer = [];
    }
}
exports.WsLogger = WsLogger;
//# sourceMappingURL=ws-logger.js.map