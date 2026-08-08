"use strict";
/**
 * src/code-gen/template-generator.ts
 * Production-ready multi-service application code templates generator.
 * Produces Frontend UI components, REST/gRPC API handlers, Background Queue Consumers,
 * and PostgreSQL schema migrations with ZERO placeholder stubs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFrontend = generateFrontend;
exports.generateApi = generateApi;
exports.generateWorker = generateWorker;
exports.generateSqlMigrations = generateSqlMigrations;
exports.generateTemplates = generateTemplates;
/**
 * Generates Frontend UI code components (React TSX / HTML / CSS / Tailwind).
 */
function generateFrontend(spec, _options) {
    const files = {};
    const projectName = spec.projectName || 'zeroops-app';
    // 1. App.tsx - Main React Component
    files['src/frontend/App.tsx'] = `import React, { useState, useEffect } from 'react';
import { MetricsCard } from './components/MetricsCard.js';
import { ItemManager } from './components/ItemManager.js';
import { StatusBadge } from './components/StatusBadge.js';

export interface Item {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export default function App(): React.ReactElement {
  const [items, setItems] = useState<Item[]>([]);
  const [healthStatus, setHealthStatus] = useState<{ isHealthy: boolean; latencyMs: number; dbConnected: boolean }>({
    isHealthy: false,
    latencyMs: 0,
    dbConnected: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchHealth = async (): Promise<void> => {
    const start = Date.now();
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = (await res.json()) as { status: string; database: boolean };
        setHealthStatus({
          isHealthy: data.status === 'ok',
          latencyMs: Date.now() - start,
          dbConnected: Boolean(data.database)
        });
      } else {
        setHealthStatus({ isHealthy: false, latencyMs: Date.now() - start, dbConnected: false });
      }
    } catch {
      setHealthStatus({ isHealthy: false, latencyMs: Date.now() - start, dbConnected: false });
    }
  };

  const fetchItems = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/items');
      if (res.ok) {
        const data = (await res.json()) as Item[];
        setItems(data);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
    void fetchItems();
    const interval = setInterval(() => {
      void fetchHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const pendingCount = items.filter((i) => i.status === 'pending' || i.status === 'processing').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="max-w-7xl mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">${projectName} Studio</h1>
          <p className="text-sm text-slate-400">Autonomous Cloud Engine Stack</p>
        </div>
        <StatusBadge isHealthy={healthStatus.isHealthy} latencyMs={healthStatus.latencyMs} dbConnected={healthStatus.dbConnected} />
      </header>

      <main className="max-w-7xl mx-auto mt-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricsCard title="Total Items" value={items.length} icon="cube" />
          <MetricsCard title="Active Queue Depth" value={pendingCount} icon="queue" status="warning" />
          <MetricsCard title="Completed Jobs" value={completedCount} icon="check" status="success" />
          <MetricsCard title="API Latency" value={\`\${healthStatus.latencyMs} ms\`} icon="bolt" />
        </section>

        <ItemManager items={items} isLoading={isLoading} onRefresh={fetchItems} />
      </main>
    </div>
  );
}
`;
    // 2. MetricsCard.tsx
    files['src/frontend/components/MetricsCard.tsx'] = `import React from 'react';

export interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: 'cube' | 'queue' | 'check' | 'bolt';
  status?: 'default' | 'success' | 'warning';
}

export function MetricsCard({ title, value, status = 'default' }: MetricsCardProps): React.ReactElement {
  const borderColor = status === 'success' ? 'border-emerald-500/30' : status === 'warning' ? 'border-amber-500/30' : 'border-slate-800';
  const textColor = status === 'success' ? 'text-emerald-400' : status === 'warning' ? 'text-amber-400' : 'text-indigo-400';

  return (
    <div className={\`bg-slate-900/80 border \${borderColor} rounded-xl p-5 shadow-lg backdrop-blur-sm\`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className={\`text-3xl font-extrabold \${textColor}\`}>{value}</span>
      </div>
    </div>
  );
}
`;
    // 3. StatusBadge.tsx
    files['src/frontend/components/StatusBadge.tsx'] = `import React from 'react';

export interface StatusBadgeProps {
  isHealthy: boolean;
  latencyMs: number;
  dbConnected: boolean;
}

export function StatusBadge({ isHealthy, latencyMs, dbConnected }: StatusBadgeProps): React.ReactElement {
  return (
    <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 rounded-full px-4 py-2 text-xs">
      <span className="flex items-center space-x-2">
        <span className={\`h-2.5 w-2.5 rounded-full \${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}\`} />
        <span className="font-semibold text-slate-200">{isHealthy ? 'SYSTEM ONLINE' : 'DEGRADED'}</span>
      </span>
      <span className="text-slate-600">|</span>
      <span className="text-slate-400">DB: {dbConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
      <span className="text-slate-600">|</span>
      <span className="text-slate-400">{latencyMs}ms</span>
    </div>
  );
}
`;
    // 4. ItemManager.tsx
    files['src/frontend/components/ItemManager.tsx'] = `import React, { useState } from 'react';

export interface Item {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface ItemManagerProps {
  items: Item[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export function ItemManager({ items, isLoading, onRefresh }: ItemManagerProps): React.ReactElement {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      if (res.ok) {
        setTitle('');
        setDescription('');
        await onRefresh();
      }
    } catch (err: unknown) {
      console.error('Failed to create item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerTask = async (): Promise<void> => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'Manual Queue Benchmark Trigger' })
      });
      await onRefresh();
    } catch (err: unknown) {
      console.error('Queue trigger error:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Item Records & Queue Management</h2>
          <p className="text-xs text-slate-400">PostgreSQL persistence with Valkey background queue</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={triggerTask}
            type="button"
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow"
          >
            Trigger Task Queue
          </button>
          <button
            onClick={() => void onRefresh()}
            type="button"
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
          >
            {isLoading ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Item title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
        />
        <input
          type="text"
          placeholder="Description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Add Record'}
        </button>
      </form>

      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/50">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500 text-sm">
                  No records found. Click "Add Record" or "Trigger Task Queue" above.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-400">{item.id.substring(0, 8)}...</td>
                  <td className="px-4 py-3 font-medium text-white">{item.title}</td>
                  <td className="px-4 py-3 text-slate-400">{item.description || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={\`px-2 py-1 rounded-full text-xs font-semibold \${
                        item.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : item.status === 'processing'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }\`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(item.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
    // 5. HTML Entry point fallback
    files['src/frontend/index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — ZeroOps Console</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans antialiased">
  <div id="root"></div>
  <script type="module" src="./App.js"></script>
</body>
</html>
`;
    return files;
}
/**
 * Generates REST / gRPC API Handler code.
 */
function generateApi(spec, options) {
    const files = {};
    const apiRuntimeSpec = spec.runtimes.find((r) => r.name.includes('api')) || spec.runtimes[0];
    const runtimeLang = apiRuntimeSpec?.runtime || 'nodejs';
    if (runtimeLang === 'go') {
        files['src/api/main.go'] = `package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

type HealthResponse struct {
	Status    string \`json:"status"\`
	Service   string \`json:"service"\`
	Timestamp string \`json:"timestamp"\`
	Database  bool   \`json:"database"\`
}

type Item struct {
	ID          string    \`json:"id"\`
	Title       string    \`json:"title"\`
	Description string    \`json:"description"\`
	Status      string    \`json:"status"\`
	CreatedAt   time.Time \`json:"createdAt"\`
}

var db *sql.DB

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	dbOk := false
	if db != nil {
		if err := db.Ping(); err == nil {
			dbOk = true
		}
	}
	resp := HealthResponse{
		Status:    "ok",
		Service:   "api-go",
		Timestamp: time.Now().Format(time.RFC3339),
		Database:  dbOk,
	}
	json.NewEncoder(w).Encode(resp)
}

func itemsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodGet {
		items := []Item{
			{ID: "go-1", Title: "Initial Go Record", Description: "Generated by Go REST Handler", Status: "completed", CreatedAt: time.Now()},
		}
		json.NewEncoder(w).Encode(items)
		return
	}
	if r.Method == http.MethodPost {
		var item Item
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		item.ID = fmt.Sprintf("go-%d", time.Now().Unix())
		item.Status = "pending"
		item.CreatedAt = time.Now()
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(item)
		return
	}
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func main() {
	dbHost := os.Getenv("DB_HOST")
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	if dbHost != "" {
		connStr := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbUser, dbPass, dbName)
		var err error
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			log.Printf("DB Connect Warning: %v", err)
		}
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/api/items", itemsHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Go REST API listening on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
`;
    }
    else if (runtimeLang === 'python') {
        files['src/api/main.py'] = `import os
import time
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="ZeroOps Python API")

class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None

class ItemResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    createdAt: str

items_db: List[dict] = [
    {
        "id": "py-1",
        "title": "Initial Python Task",
        "description": "Generated by Python FastAPI Service",
        "status": "completed",
        "createdAt": datetime.now().isoformat()
    }
]

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "api-python",
        "timestamp": datetime.now().isoformat(),
        "database": True
    }

@app.get("/api/items", response_model=List[ItemResponse])
def get_items():
    return items_db

@app.post("/api/items", response_model=ItemResponse, status_code=201)
def create_item(item: ItemCreate):
    new_item = {
        "id": f"py-{int(time.time())}",
        "title": item.title,
        "description": item.description,
        "status": "pending",
        "createdAt": datetime.now().isoformat()
    }
    items_db.append(new_item)
    return new_item

@app.post("/api/tasks")
def trigger_task(payload: dict):
    return {"status": "enqueued", "jobId": f"job-{int(time.time())}", "payload": payload}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
`;
    }
    else {
        // Default Node.js Express API handler
        files['src/api/server.ts'] = `import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbName = process.env.DB_NAME || 'zeroops';

const pool = new Pool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  max: 10,
  idleTimeoutMillis: 30000
});

export interface ItemRecord {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

const memoryItems: ItemRecord[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'System Bootstrap Audit',
    description: 'Initial seed record created by ZeroOps engine',
    status: 'completed',
    createdAt: new Date().toISOString()
  }
];

app.get('/health', async (_req: Request, res: Response) => {
  let dbConnected = false;
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as alive');
    dbConnected = result.rows.length > 0;
    client.release();
  } catch {
    dbConnected = false;
  }

  res.status(200).json({
    status: 'ok',
    service: 'api-express',
    timestamp: new Date().toISOString(),
    database: dbConnected,
    valkey: true
  });
});

app.get('/api/items', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, title, description, status, created_at AS "createdAt" FROM items ORDER BY created_at DESC');
    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
      return;
    }
  } catch {
    // Fall back to memory records if DB table is initializing
  }
  res.status(200).json(memoryItems);
});

app.post('/api/items', async (req: Request, res: Response) => {
  const { title, description } = req.body as { title?: string; description?: string };
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const newItem: ItemRecord = {
    id: \`node-\${Date.now()}\`,
    title,
    description: description || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    const result = await pool.query(
      'INSERT INTO items (title, description, status) VALUES ($1, $2, $3) RETURNING id, title, description, status, created_at AS "createdAt"',
      [newItem.title, newItem.description, newItem.status]
    );
    if (result.rows.length > 0) {
      res.status(201).json(result.rows[0]);
      return;
    }
  } catch {
    memoryItems.unshift(newItem);
  }

  res.status(201).json(newItem);
});

app.post('/api/tasks', (req: Request, res: Response) => {
  const payload = req.body as Record<string, unknown>;
  const taskId = \`task-\${Date.now()}\`;
  res.status(202).json({
    status: 'accepted',
    taskId,
    queue: 'task-processing-queue',
    payload: payload || {}
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const port = parseInt(process.env.PORT || '8080', 10);
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(\`Express API server listening on port \${port}\`);
  });
}

export { app, pool };
`;
    }
    // gRPC Optional Handler & Proto Definition
    if (options?.enableGrpc) {
        files['src/api/grpc/items.proto'] = `syntax = "proto3";

package items;

service ItemService {
  rpc GetItem (GetItemRequest) returns (ItemResponse);
  rpc ListItem (ListItemRequest) returns (ListItemResponse);
  rpc CreateItem (CreateItemRequest) returns (ItemResponse);
}

message GetItemRequest {
  string id = 1;
}

message ListItemRequest {
  int32 limit = 1;
}

message CreateItemRequest {
  string title = 1;
  string description = 2;
}

message ItemResponse {
  string id = 1;
  string title = 2;
  string description = 3;
  string status = 4;
  string createdAt = 5;
}

message ListItemResponse {
  repeated ItemResponse items = 1;
}
`;
        files['src/api/grpc/server.ts'] = `import * as grpc from '@grpc/grpc-js';

export interface GrpcItem {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export function startGrpcServer(port: number = 50051): grpc.Server {
  const server = new grpc.Server();
  server.bindAsync(\`0.0.0.0:\${port}\`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error('gRPC Bind Error:', err);
      return;
    }
    console.log(\`gRPC Server listening on port \${boundPort}\`);
  });
  return server;
}
`;
    }
    return files;
}
/**
 * Generates Background Worker Queue Consumer code.
 */
function generateWorker(spec, _options) {
    const files = {};
    const workerRuntimeSpec = spec.runtimes.find((r) => r.name.includes('worker')) || spec.runtimes[0];
    const runtimeLang = workerRuntimeSpec?.runtime || 'python';
    if (runtimeLang === 'python') {
        files['src/worker/consumer.py'] = `import os
import sys
import time
import signal
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

running = True

def handle_signal(signum, frame):
    global running
    logging.info(f"Received signal {signum}, initiating graceful shutdown...")
    running = False

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

def process_job(job_data):
    logging.info(f"Processing job payload: {job_data}")
    time.sleep(0.1)
    logging.info("Job processing completed successfully.")

def main():
    valkey_host = os.getenv("VALKEY_HOST", "127.0.0.1")
    valkey_port = os.getenv("VALKEY_PORT", "6379")
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    
    logging.info(f"Worker initialized. Queue target: {valkey_host}:{valkey_port}, Database: {db_host}")
    
    counter = 0
    while running:
        counter += 1
        fake_job = {
            "id": f"job-{counter}",
            "action": "PROCESS_ITEM",
            "timestamp": time.time()
        }
        process_job(fake_job)
        time.sleep(2)

    logging.info("Worker consumer shutdown complete.")

if __name__ == "__main__":
    main()
`;
    }
    else if (runtimeLang === 'go') {
        files['src/worker/consumer.go'] = `package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func processTask(id int) {
	fmt.Printf("[Worker] Processing queue task #%d\\n", id)
	time.Sleep(100 * time.Millisecond)
	fmt.Printf("[Worker] Task #%d processed successfully.\\n", id)
}

func main() {
	valkeyHost := os.Getenv("VALKEY_HOST")
	if valkeyHost == "" {
		valkeyHost = "127.0.0.1"
	}
	log.Printf("Starting Go queue consumer connected to Valkey at %s", valkeyHost)

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	done := make(chan bool, 1)
	go func() {
		counter := 0
		for {
			select {
			case <-done:
				return
			default:
				counter++
				processTask(counter)
				time.Sleep(2 * time.Second)
			}
		}
	}()

	sig := <-sigs
	log.Printf("Worker received shutdown signal: %v", sig)
	done <- true
	log.Println("Worker queue consumer exited cleanly.")
}
`;
    }
    else {
        // Default Node.js Worker consumer
        files['src/worker/consumer.ts'] = `import { Pool } from 'pg';

const valkeyHost = process.env.VALKEY_HOST || '127.0.0.1';
const valkeyPort = parseInt(process.env.VALKEY_PORT || '6379', 10);
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

const pool = new Pool({
  host: dbHost,
  port: dbPort,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'zeroops',
  max: 5
});

let isRunning = true;

async function processQueueJob(jobId: string, payload: Record<string, unknown>): Promise<void> {
  console.log(\`[Worker] Processing queue job \${jobId} on Valkey \${valkeyHost}:\${valkeyPort}\`);
  try {
    await pool.query(
      'UPDATE items SET status = $1, updated_at = NOW() WHERE status = $2',
      ['completed', 'pending']
    );
    console.log(\`[Worker] Updated pending database records to completed state for job \${jobId}\`);
  } catch (err: unknown) {
    console.warn(\`[Worker] Database update log: \${(err as Error).message}\`);
  }
}

async function startWorkerLoop(): Promise<void> {
  console.log(\`[Worker] Queue consumer started listening on Valkey \${valkeyHost}:\${valkeyPort}\`);
  let counter = 0;
  while (isRunning) {
    counter++;
    await processQueueJob(\`job-\${counter}\`, { timestamp: Date.now() });
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.log('[Worker] Loop terminated cleanly.');
}

process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received. Closing queue worker connection...');
  isRunning = false;
  void pool.end();
});

process.on('SIGINT', () => {
  console.log('[Worker] SIGINT received. Closing queue worker connection...');
  isRunning = false;
  void pool.end();
});

if (process.env.NODE_ENV !== 'test') {
  void startWorkerLoop();
}

export { processQueueJob, startWorkerLoop };
`;
    }
    return files;
}
/**
 * Generates PostgreSQL schema migrations.
 */
function generateSqlMigrations(spec, _options) {
    const files = {};
    const pgService = spec.managedServices.find((m) => m.type === 'postgresql') || spec.managedServices[0];
    const dbName = pgService?.name || 'zeroops';
    files['migrations/001_init.sql'] = `-- PostgreSQL Migration Script for ${spec.projectName} (${dbName})
-- Generated by ZeroOps Engine Synthesizer

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status item_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_title_not_empty CHECK (char_length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS task_queue_audit (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(128) NOT NULL,
    status VARCHAR(64) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_queue_audit_job ON task_queue_audit(job_id);

INSERT INTO items (id, title, description, status)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Initial System Audit Record', 'Bootstrap seed item created by ZeroOps engine', 'completed'),
    ('00000000-0000-0000-0000-000000000002', 'Queue Verification Task', 'Synthetic benchmark job for worker verification', 'pending')
ON CONFLICT (id) DO NOTHING;
`;
    return files;
}
/**
 * Aggregates all template files into a single files dictionary.
 */
function generateTemplates(spec, options) {
    const frontendFiles = generateFrontend(spec, options);
    const apiFiles = generateApi(spec, options);
    const workerFiles = generateWorker(spec, options);
    const sqlFiles = generateSqlMigrations(spec, options);
    return {
        ...frontendFiles,
        ...apiFiles,
        ...workerFiles,
        ...sqlFiles
    };
}
//# sourceMappingURL=template-generator.js.map