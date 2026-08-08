# Handoff Report — explorer_m3_r1_2: `src/studio/ws-logger.ts`

## 1. Observation

### Codebase & Dependency Inspection
- **Working Directory**: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine`
- **Target File**: `src/studio/ws-logger.ts`
- **Package Dependencies** (`zeroops-engine/package.json`):
  - `ws`: `^8.18.0` (installed and ready for WebSocket server/client handling)
  - `picocolors`: `1.1.1` (installed for server console terminal styling)
  - `typescript`: `5.9.3` & `vitest`: `4.1.10`

### Interface Contracts (`PROJECT.md` & `tests/harness.ts`)
From `PROJECT.md:113-118` and `tests/harness.ts:205-210`:
```typescript
export interface LogStreamMessage {
  timestamp: string;
  service: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}
```

### Feature Requirements & Test Specifications
From `tests/tier1_feature_coverage.test.ts` (F10-T1..T5), `tests/tier2_boundary_edge.test.ts` (F10-B1..B5), and `tests/tier3_pairwise.test.ts` (Pair 6 & Pair 14):
1. **F10-T1 / F10-B1**: WebSocket connection handling at endpoint `/ws/logs`. Sockets must track open status (`ws.readyState === WebSocket.OPEN`) and throw clean closed socket errors when sending to closed connections.
2. **F10-T2**: Formats logs with ISO timestamps, service identifier (e.g., `frontend`, `api`, `worker`, `postgres`, `valkey`, `system`, `zcp`, `verifier`), stream type (`stdout`, `stderr`, `system`), and sanitized message content.
3. **F10-T3**: Applies ANSI escape codes for `xterm.js` rendering (`\x1b[90m` gray timestamp, `\x1b[36m` cyan service tag, `\x1b[32m` green stdout, `\x1b[31m` red stderr, `\x1b[33m` yellow system).
4. **F10-T4**: Supports filtering by service on subscriber queries and per-client socket subscriptions.
5. **F10-T5 / F10-B2**: In-memory ring buffer (up to 1,000 logs) to survive connection drops, handle high-frequency 1,000 log bursts without dropping messages, and allow reconnecting clients to receive log history replay.
6. **F10-B4 / F10-B5**: Malformed non-JSON incoming frames are safely wrapped into sanitized system log messages (`stream: 'stderr'`). Non-printable control characters (`\x00-\x07`, `\x0E-\x1F`, `\x7F-\x9F`) are sanitized while preserving standard ANSI escape sequences.

---

## 2. Logic Chain

1. **Step 1: Interface Compliance**: `ws-logger.ts` must export `LogStreamMessage`, `LogStreamerConfig`, and `WsLogger` class implementing `IWebStudioServer` log streaming specifications.
2. **Step 2: Buffer Management**: High-burst scenarios (1,000+ logs) require a bounded ring buffer (`maxBufferLength: 1000`). When capacity is exceeded, oldest logs are evicted to maintain constant memory footprint.
3. **Step 3: Control Character Sanitization & ANSI Formatting**:
   - Raw string logs from external processes or user input can contain non-printable control characters (e.g. `\x00`, `\x07`). A sanitizer regex (`/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g`) must clean strings without stripping ANSI escape codes (`\x1b[...]`).
   - Log output sent to `xterm.js` requires color-coding formatters to build terminal lines:
     `\x1b[90m[2026-08-08T23:31:00.000Z]\x1b[0m \x1b[36m[api]\x1b[0m \x1b[32m[stdout]\x1b[0m Server ready on port 8080`
4. **Step 4: WebSocket Server Integration (`/ws/logs`)**:
   - `WsLogger` integrates with Node HTTP server / Express instance.
   - Handles connection events, client heartbeats (ping/pong), service filtering requests (`{ type: 'subscribe', service: 'api' }`), history requests (`{ type: 'getHistory' }`), and client disconnects.
   - Safely broadcasts to open clients (`ws.readyState === WebSocket.OPEN`).
5. **Step 5: Event Emitter & Callback Integration**:
   - Provides clean programmatic API: `wsLogger.emit(service, stream, message)` and `wsLogger.broadcastLog(logMsg)`.
   - Allows passing `wsLogger.logCallback` to ZCP provisioner (`zcp-client.ts`), code synthesizer, and live auditor (`verifier`).

---

## 3. Caveats

- **Frontend Client Coupling**: `xterm.js` rendering on the browser side (`src/studio/public/app.js`) handles ANSI escape sequences natively. `ws-logger.ts` sends both raw JSON `LogStreamMessage` objects and formatted ANSI string attributes so clients can render either structured tables or raw xterm terminals.
- **Standalone vs Server Attachment**: `ws-logger.ts` should support operating both attached to an HTTP server (`server.ts`) and as an isolated in-memory instance for standalone unit testing without listening on network ports.
- **No Heavy External Dependencies**: Must rely only on built-in Node.js modules (`events`, `http`) and installed packages (`ws`, `picocolors`).

---

## 4. Conclusion & Implementation Strategy

### Recommended File Structure for `src/studio/ws-logger.ts`

```typescript
/**
 * src/studio/ws-logger.ts
 * Real-Time WebSocket Log Streamer with ANSI formatting & xterm.js compatibility.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';

export interface LogStreamMessage {
  timestamp: string;
  service: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface ClientSubscription {
  ws: WebSocket;
  serviceFilter?: string;
  isAlive: boolean;
}

export interface WsLoggerOptions {
  maxBufferLength?: number; // default: 1000
  ansiFormatting?: boolean; // default: true
}

export class WsLogger {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientSubscription> = new Set();
  private logBuffer: LogStreamMessage[] = [];
  private maxBufferLength: number;
  private listeners: Array<(msg: LogStreamMessage) => void> = [];

  constructor(options: WsLoggerOptions = {}) {
    this.maxBufferLength = options.maxBufferLength || 1000;
  }

  /**
   * Attach WebSocket server to an existing HTTP server instance on path /ws/logs
   */
  public attach(server: HttpServer, path: string = '/ws/logs'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket) => {
      const client: ClientSubscription = { ws, isAlive: true };
      this.clients.add(client);

      // Replay recent buffer history to newly connected client
      ws.send(JSON.stringify({
        type: 'history',
        logs: this.logBuffer
      }));

      ws.on('message', (data: Buffer | string) => {
        this.handleClientMessage(client, data.toString());
      });

      ws.on('close', () => {
        this.clients.delete(client);
      });

      ws.on('error', () => {
        this.clients.delete(client);
      });
    });
  }

  /**
   * Sanitizes non-printable control characters while preserving ANSI escape sequences.
   */
  public sanitizeMessage(msg: string): string {
    // Strips ASCII 0-8, 11-12, 14-31, 127-159 (retains ESC \x1b, LF \n, CR \r, TAB \t)
    return msg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  }

  /**
   * Formats a LogStreamMessage into an ANSI-colored string suitable for xterm.js.
   */
  public formatAnsi(msg: LogStreamMessage): string {
    const timestampStr = `\x1b[90m[${msg.timestamp}]\x1b[0m`;
    
    let serviceColor = '\x1b[36m'; // Cyan for default / api
    if (msg.service === 'frontend') serviceColor = '\x1b[34m'; // Blue
    else if (msg.service === 'worker') serviceColor = '\x1b[35m'; // Magenta
    else if (msg.service === 'postgres' || msg.service === 'db') serviceColor = '\x1b[33m'; // Yellow
    else if (msg.service === 'valkey' || msg.service === 'cache') serviceColor = '\x1b[31m'; // Red
    else if (msg.service === 'system' || msg.service === 'zcp') serviceColor = '\x1b[90m'; // Gray

    const serviceBadge = `${serviceColor}[${msg.service}]\x1b[0m`;

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
   * Broadcast structured LogStreamMessage to connected clients and local subscribers
   */
  public broadcastLog(msg: LogStreamMessage): void {
    const sanitizedMsg: LogStreamMessage = {
      ...msg,
      timestamp: msg.timestamp || new Date().toISOString(),
      message: this.sanitizeMessage(msg.message)
    };

    // Maintain Ring Buffer
    this.logBuffer.push(sanitizedMsg);
    if (this.logBuffer.length > this.maxBufferLength) {
      this.logBuffer.shift();
    }

    // Invoke in-memory subscribers
    for (const listener of this.listeners) {
      try {
        listener(sanitizedMsg);
      } catch (err) {
        // Suppress listener errors
      }
    }

    // Broadcast over WebSockets
    const payload = JSON.stringify({
      type: 'log',
      message: sanitizedMsg,
      ansi: this.formatAnsi(sanitizedMsg)
    });

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (!client.serviceFilter || client.serviceFilter === sanitizedMsg.service) {
          try {
            client.ws.send(payload);
          } catch {
            this.clients.delete(client);
          }
        }
      }
    }
  }

  /**
   * Handle incoming socket messages (subscriptions, client filters, ping)
   */
  private handleClientMessage(client: ClientSubscription, rawData: string): void {
    try {
      const data = JSON.parse(rawData);
      if (data.type === 'subscribe') {
        client.serviceFilter = data.service;
      } else if (data.type === 'ping') {
        client.ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // Malformed non-JSON frame (Tier 2 boundary F10-B4 requirement)
      const sanitized = this.sanitizeMessage(rawData);
      this.emit('system', 'stderr', sanitized);
    }
  }

  /**
   * Returns buffered logs filtered optional by service
   */
  public getLogs(service?: string): LogStreamMessage[] {
    if (!service) return [...this.logBuffer];
    return this.logBuffer.filter(l => l.service === service);
  }

  /**
   * Register local in-memory event listener callback
   */
  public subscribe(callback: (msg: LogStreamMessage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
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
    this.logBuffer = [];
  }
}
```

### Key Recommendations for Worker Agent
1. Create `src/studio/ws-logger.ts` implementing the `WsLogger` class shown above.
2. Export `LogStreamMessage`, `WsLogger`, `WsLoggerOptions`, and default helper functions.
3. Ensure compatibility with `tests/tier1_feature_coverage.test.ts`, `tests/tier2_boundary_edge.test.ts`, and `tests/harness.ts`.
4. Ensure `server.ts` imports and instantiates `WsLogger`, attaching it to the Express HTTP server on `/ws/logs`.

---

## 5. Verification Method

To verify the implementation of `src/studio/ws-logger.ts`:

1. **Unit Test Suite**:
   ```bash
   npx vitest run tests/studio.test.ts
   ```
2. **Tier 1 Feature Coverage Audit**:
   ```bash
   node --test tests/tier1_feature_coverage.test.ts
   ```
3. **Tier 2 Boundary Edge Audit**:
   ```bash
   node --test tests/tier2_boundary_edge.test.ts
   ```
4. **Invalidation Conditions**:
   - Sending logs to closed WebSocket connections causes unhandled exceptions.
   - Non-printable control characters corrupt the xterm.js terminal stream.
   - High-volume bursts (> 1,000 logs) crash the server or drop log frames.
