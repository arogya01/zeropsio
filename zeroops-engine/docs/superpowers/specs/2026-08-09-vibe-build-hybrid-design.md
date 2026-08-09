# Vibe Build Hybrid — Design Spec

**Date:** 2026-08-09  
**Status:** Approved for implementation  
**Repo:** `zeroops-engine` (zerops-hack)  
**Reference:** `/Users/arogyabichpuria/Documents/side-quests/dyad`

## Problem

Clicking **Build** does not create a Lovable/Dyad-style app. Today it:

1. Maps the prompt to a fixed Node+Postgres template  
2. Lets the LLM rewrite only `webapp/app.config.json` (title/tagline/seeds)  
3. Optionally deploys that template to Zerops  

Result: a generic CRUD shell with new labels — not a real generated UI.

## Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Flow | **Hybrid:** Build → local preview; **Ship** is a separate explicit action |
| Stack | **Dyad-style React + Vite SPA** (scaffold under the hood) |
| Iteration | **Single-shot regenerate** — a new Build replaces the workspace |
| Ship target | **Static SPA only** — Vite `dist` + tiny static Node host; no Postgres in v1 |
| LLM protocol | Dyad-compatible write tags (`<dyad-write>` / `<zeroops-write>`) |
| Reference code | Dyad `scaffold/`, system prompt write rules, response-style file apply |

## Success criteria

1. User enters a prompt and clicks **Build**.  
2. Within ~1–2 minutes (with OpenAI key), Studio shows:
   - Short plan prose  
   - Generated multi-file tree in the code panel  
   - **Live preview iframe** of the React app  
3. Clicking **Build** again with a new prompt **replaces** the previous app (no multi-turn chat).  
4. **Ship** (requires Zerops PAT when not in demo-operator mode) runs `vite build`, packages static host, deploys via existing zcli path, returns a real public URL.  
5. Without an API key, Build fails clearly with a recoverable error (no silent fake success).  
6. Existing deploy integrity rules remain: never invent live URLs.

## Non-goals (v1)

- Multi-turn iterative chat editing  
- Managed Postgres / API routes from the LLM  
- Full Dyad agent loop, Smart Context, or Electron IPC  
- Porting Dyad UI chrome wholesale  

## Architecture

```
┌─────────────┐   POST /api/vibe/build    ┌──────────────────────┐
│ Studio UI   │ ────────────────────────► │ vibe-build service   │
│ (Build btn) │                           │ 1. create workspace  │
│             │ ◄── job poll / SSE ────── │ 2. copy SPA scaffold │
│ Preview iframe                          │ 3. LLM multi-file    │
│ Code panel  │                           │ 4. npm install       │
│ Ship btn    │   POST /api/vibe/ship     │ 5. vite dev/preview  │
└─────────────┘ ────────────────────────► │ 6. proxy preview URL │
                                          └──────────┬───────────┘
                                                     │ Ship only
                                                     ▼
                                          ┌──────────────────────┐
                                          │ ship packager        │
                                          │ vite build → dist    │
                                          │ static server + yml  │
                                          │ deploy-pipeline push │
                                          └──────────────────────┘
```

### Components

#### 1. `src/vibe-scaffold/` (frozen starter)

- Adapted from Dyad `scaffold/` (React + Vite + Tailwind + shadcn-style UI kit).  
- **Slim for hackathon:** keep enough UI primitives for decent apps; drop unused weight if install time is painful.  
- Must boot with `npm install && npm run dev` with no manual config.  
- `vite.config` must allow preview under a path/proxy (strict port, host `127.0.0.1`, HMR settings compatible with reverse proxy).

#### 2. `src/server/llm/vibe-scaffold.js` (generator)

Replaces flavor-only generation for the vibe path:

1. Copy scaffold → per-session workspace under `os.tmpdir()/zeroops-vibe/<id>/`  
2. Call OpenAI with a **BUILD_SYSTEM** prompt adapted from Dyad `BUILD_SYSTEM_PREFIX` (write/rename/delete/deps tags; no shell commands).  
3. Parse with existing `write-protocol.js` (already accepts dyad + zeroops tags).  
4. Apply writes to disk (path-safe: no `..`, stay under workspace).  
5. Optional: run `npm install` for any `<zeroops-add-dependency>` packages.  
6. Return `{ workspaceId, plan, codeFiles, previewReady:false }` then start preview process.

**Regenerate:** delete old workspace for that session/job, create fresh.

**Fallback without LLM:** not required for success; return 503 with `error: 'OPENAI_API_KEY required'`. Do **not** ship fake apps as success.

#### 3. `src/server/vibe/preview-manager.js`

- Spawns `npx vite --host 127.0.0.1 --port <allocated>` per workspace.  
- Tracks child process lifecycle; kill on regenerate/ship/session cleanup.  
- Port allocation: free port in a range (e.g. 5100–5199).  
- Express reverse-proxy: `GET /api/vibe/preview/:workspaceId/*` → local vite.  
- Studio iframe uses same-origin proxy URL to avoid cookie/CORS issues.

#### 4. `src/server/vibe/ship-packager.js`

On **Ship**:

1. `npm run build` in workspace.  
2. Materialize deploy tree:
   ```
   webapp/
     package.json      # "start": "node server.js"
     server.js         # express.static('dist') on PORT
     dist/             # vite output
     zerops.yml
   zerops-import.yml   # single nodejs@22 service, enableSubdomainAccess
   ```
3. Hand off to existing deploy pipeline materialize/push (adapt if current pipeline assumes old template layout).  
4. Stream logs; return real URL only from platform output.

#### 5. API surface

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/vibe/build` | Start generate+preview job; body `{ prompt }` |
| `GET`  | `/api/vibe/build/:jobId` | Poll status, plan, files, previewUrl, error |
| `POST` | `/api/vibe/ship` | Deploy current workspace; body `{ workspaceId }` or jobId |
| `GET`  | `/api/vibe/ship/:jobId` | Poll ship status + liveUrl |
| `GET`  | `/api/vibe/preview/:workspaceId/*` | Reverse proxy to vite |
| `GET`  | `/api/vibe/files/:workspaceId` | File tree map for code panel |

Wire demo path: **demo Build button** should call vibe build (not flavor-only deploy). Ship remains separate (demo operator PAT or user PAT).

Keep legacy `/api/demo/deploy` available but deprioritized in UI.

#### 6. Studio UI changes

**Build**

- Primary CTA: Build  
- On submit: open workbench, show stages: `generate → install → preview`  
- Stream/poll plan + files into code tab  
- When preview ready: show iframe (new **Preview** tab or right pane)  
- Status: ready when iframe loads  

**Ship**

- Secondary CTA enabled only when `previewReady && workspaceId`  
- Opens deploy log stream (existing terminal panel patterns)  
- On success: verified live URL banner  

**Regenerate**

- Build with new prompt disables Ship until new preview is ready; kills old preview process  

### Data flow (Build)

```
prompt
  → job created (queued)
  → scaffold copy
  → LLM response (write blocks)
  → disk apply
  → npm install
  → vite start
  → previewUrl = /api/vibe/preview/<id>/
  → client polls until status=ready
```

### Error handling

| Failure | User-facing |
|---------|-------------|
| No API key | “Add OpenAI API key (or set server OPENAI_API_KEY) to Build.” |
| LLM garbage / no writes | “Generation failed — try a clearer prompt.” Keep previous workspace if any. |
| npm install fail | Show log tail; status=failed |
| vite fail | status=failed; no Ship |
| Ship without workspace | 400 |
| zcli/PAT fail | Existing honest error path; no fake URL |

### Security

- Workspace IDs: unguessable (`crypto.randomBytes`)  
- Path sandbox on all writes  
- Preview proxy only maps known workspace IDs  
- Do not commit API keys or PATs  
- Temp dirs cleaned on process exit / regenerate (best-effort)

### Testing

1. Unit: write-protocol apply; path sandbox; ship tree layout  
2. Integration: build job with mocked LLM returns fixture files → files on disk  
3. Optional e2e: skip live OpenAI in CI; use fixture response  

### Migration / coexistence

- Old `scaffoldApp` flavor path remains for `/api/demo/simulate` if useful for offline canvas animation.  
- New default product path: vibe Build + Ship.  
- Topology canvas for 5-service stacks is **not** the primary vibe story; simplify UI status for SPA (single “app” chip) or hide multi-node canvas on vibe mode.

## Implementation order

1. Vendor slim SPA scaffold into `src/vibe-scaffold/`  
2. Vibe LLM scaffold + disk apply + job store  
3. Preview manager + proxy  
4. API routes  
5. Ship packager + deploy handoff  
6. Studio + demo UI (Build / Ship split, preview iframe)  
7. Tests  

## Open implementation notes

- Prefer OpenAI `gpt-4o-mini` or existing demo model env for cost; make model configurable via `OPENAI_MODEL`.  
- Cap generated file count (e.g. 40) and content size to avoid runaway responses.  
- Dyad scaffold is large; if `npm install` is too slow, strip radix packages not needed for first demo and reintroduce later.
