# Zerops Challenge — Deep Research Brief

**Event:** [The Zerops Challenge](https://www.wemakedevs.org/hackathons/zerops) (WeMakeDevs × Zerops)  
**When:** August 8–9, 2026 (solo, online, ~48h)  
**Prizes:** MacBook Neo (best project) · Logitech MX Master 3 (best social post) · $5,000 Zerops credits pool  
**Researched:** 2026-08-06  
**Sources reviewed:** ~245 across 4 research streams (platform, win patterns, product ideas, ZCP/agent angle)

---

## 1. Constraints that shape every idea

| Constraint | Implication for idea choice |
|------------|-----------------------------|
| **Solo only** | One golden path; no multi-role SaaS |
| **Live URL through judging** | Prefer managed DB + seed data; deploy early |
| **Zerops meaningfully used** | Multi-service private network, not “Next on free tier” |
| **≥3 services ideal** | Frontend + backend + database minimum ([rules](https://www.wemakedevs.org/hackathons/zerops/rules)) |
| **Theme open** | Judged on idea + execution + **how Zerops is used** |
| **AI OK if disclosed** | Use ZCP/Grok Build aggressively; you must explain architecture |
| **Social post required** | Name, what it does, video, live URL, how Zerops used, `@WeMakeDevs` `@zeropsio` |
| **Head start allowed** | Plan/architecture/setup OK; finished pre-built projects not OK |

---

## 2. What Zerops wants you to show

Zerops is not “another place to host a Next app.” First-party positioning emphasizes:

- **Project → service → container** with a **dedicated private VXLAN** (`db:5432`, `cache:6379`, hostname discovery)
- **Deep managed catalog** on one network: Postgres, MariaDB, ClickHouse, Valkey/KeyDB, NATS/Kafka, Meilisearch/Elasticsearch/Typesense, **Qdrant**, S3 object storage, shared disk
- **Full Linux system containers** (Incus): root, apt, SSH, cron — not serverless sandboxes
- **`zerops.yaml`** + import YAML as the lifecycle contract
- **ZCP** (Zerops Control Plane): coding agent *inside* the project (or VPN + MCP) that deploys, reads logs, and ends with **behavior proof or named blocker**

**Official showcase shape** (from [zerops.io](https://zerops.io/)): Bun/React FE + WebSockets + Python worker + NATS + Postgres + Valkey + S3 image pipeline — with live architecture visualization.

**Hackathon takeaway:** Demo multi-service private topology + managed data plane (+ optional ZCP loop). Do not demo single-service hosting.

### High-signal Zerops usage (aim for 2–3)

1. Multi-service private network (FE + API + worker + managed DB/cache/queue/storage)
2. ZCP in the ship story (prompt → deploy → verify → live URL)
3. Living `zerops.yaml` / import YAML
4. Managed services as load-bearing (not in-memory fakes)
5. Visible async (job states, queues, object keys in storage)
6. Health/verify that hits real deps
7. Architecture page listing hostnames and edges

### Low-signal (avoid as sole claim)

- Static site “deployed on Zerops”
- Single container CRUD with no managed DB story

---

## 3. What wins ship-focused PaaS hackathons

Ranked criteria (Railway/Render/Cloudflare winners + judge notes + this event’s rules):

1. **Live demo works end-to-end**
2. **One-sentence identity** (“tool that does X for Y”)
3. **Scope that matches 48h** (complete > ambitious)
4. **Deep platform use** (multi-service, primitives, not hosting-only)
5. **Specific user / real annoyance**
6. **Polish on the golden path** (seed data, persistence, two-session survival)
7. **Story + video + social**
8. **Honest limits + AI disclosure**

### 48h solo playbook

| Window | Focus |
|--------|--------|
| Hour 0–1 | Lock idea; never pivot after ~hour 6 |
| Hour 0–2 | Recipe + AI Agent env + agent authorized |
| Halfway | Full click-through works or cut features |
| Last 25% | Feature freeze; demo, video, README, social |
| Always | ~20%+ time for packaging the story |

### Anti-patterns

Hello World · overscoped “platform for X” · no live URL · in-memory DB · slide deck instead of product · AI black box · first deploy in last hour · platform as afterthought

---

## 4. Recommended ideas (ranked)

Scoring: **demo wow × Zerops fit × 48h feasibility**. Prefer ideas judges remember as “this *is* Zerops.”

### Tier A — best fit for this event

#### A1. Architecture Studio / Import YAML Generator
**One-liner:** Describe a stack (or paste Compose) → live Mermaid topology + downloadable Zerops **import YAML** + per-service `zerops.yaml` snippets.

| | |
|--|--|
| **Services** | FE · API · Postgres · Redis · optional worker (LLM codegen) · object storage (exports) |
| **Why it wins** | Explicit sponsor category; platform *is* the product; reusable artifact judges can imagine importing |
| **MVP** | 5–8 presets (web+api+worker+db+cache+s3); NL or form → YAML + diagram; save history in Postgres |
| **Cut** | Multi-cloud Terraform, full K8s |

#### A2. Compose → Zerops Migration Assistant
**One-liner:** Upload `docker-compose.yml` → service mapping, `localhost`→hostname rewrite, import YAML, “what won’t migrate” checklist.

| | |
|--|--|
| **Services** | FE · API · Postgres · worker · object storage |
| **Why it wins** | Migration assistant is named on the challenge page; teaches Zerops networking |
| **MVP** | Compose v3 + common images (Postgres, Redis, MinIO, Node, Python) |
| **Cut** | Every Compose edge case |

#### A3. DocPipe — async document RAG
**One-liner:** Upload PDF/TXT → worker chunks/embeds → chat with grounded answers; live job progress over SSE/WebSocket.

| | |
|--|--|
| **Services** | FE · API · worker · Postgres (+vectors) · Redis · object storage |
| **Why it wins** | Maximum multi-service drama; AI products category; hard to fake on pure frontend hosts |
| **MVP** | One file type, one embedder, tenant filter, stream answers, seeded demo docs |
| **Cut** | OCR, multi-provider failover, hierarchical retrieval |

#### A4. Agent Job Control Plane
**One-liner:** Submit a task → isolated worker run with step timeline, cost/token cap, retry, artifact download.

| | |
|--|--|
| **Services** | FE · API · worker · Postgres · queue/Redis · object storage |
| **Why it wins** | Aligns with ZCP “agent + proof” narrative; processing + AI category |
| **MVP** | One worker image, single LLM tool loop, hard budget, DLQ table |
| **Cut** | Real container-per-job sandboxes |

#### A5. Live Incident Board
**One-liner:** Create incident → multiplayer timeline, assignments, status machine; webhook on escalate.

| | |
|--|--|
| **Services** | FE · API (+WS) · Postgres · Redis pub/sub |
| **Why it wins** | Real-time category; fast demo; ops story pairs with Zerops |
| **MVP** | One incident type, 3 statuses, live feed, one outbound webhook |
| **Cut** | Full PagerDuty/ITIL |

### Tier B — strong if you stay ruthless

| # | Idea | Services | Note |
|---|------|----------|------|
| B1 | **LLM Trace & Cost Radar** (OpenAI-compatible proxy + dashboard) | FE · ingest API · worker · Postgres · Redis | High 2026 demand; don’t rebuild LangSmith |
| B2 | **Pipeline Theater** (fixed 3–4 stage DAG, live hop UI) | FE · API · worker · Postgres · queue · S3 | Architecture *is* the demo |
| B3 | **Deploy Diff Analyzer** (two `zerops.yaml`/import YAML → blast radius) | FE · API · Postgres | Pure platform storytelling |
| B4 | **zerops.yaml Copilot** (repo heuristics + LLM fill) | FE · API · worker · Postgres · storage | Zerops tools category |
| B5 | **Semantic Save Vault** (URL/snippet → embed → search) | FE · API · worker · Postgres · Redis · S3 | Classic indie multi-service SaaS |
| B6 | **Schema Map** (connect Postgres → live ER + cron refresh) | FE · API · worker · Postgres · Redis | Fast but lower “wow” |

### Tier C — only if expert day-1

| Idea | Risk |
|------|------|
| CRDT collab whiteboard | Offline/sync bugs eat the weekend |
| Full RAG eval suite runner | Scope explosion |
| PR → ephemeral Zerops preview orchestrator | Needs solid Zerops API + cleanup reliability |

---

## 5. ZCP as a *feature* (not only a build tool)

Judges hear “I used Claude to code” constantly. Differentiate with:

| Product framing | What you demo |
|-----------------|---------------|
| **Ship-as-a-service** | User prompt → your orchestration on Zerops → durable multi-service URL + architecture map |
| **Incident copilot on your stack** | Agent reads project logs/events via ZCP-style surface (or documented MCP loop); proposes redeploy |
| **Proof-or-blocker board** | Each agent task ends with live URL + proof artifact or named blocker |
| **Recipe lab** | Start from Nest/Laravel/Zerops showcase AI Agent recipe; document agent-added services mid-build |

**Recipe-first bootstrap (recommended):**

1. [Recipes catalog](https://app.zerops.io/recipes) → pick **AI Agent** env matching idea  
   - Async pipeline: [Zerops showcase](https://app.zerops.io/recipes/zerops-showcase) / Nest showcase  
   - App + jobs + search + S3: [Laravel showcase](https://app.zerops.io/recipes/laravel-showcase) ([ZCP quickstart](https://docs.zerops.io/zcp/quickstart))  
2. Authorize agent (Claude Code / Codex / Grok Build / Cursor CLI)  
3. First prompt: *Read current service map. Don’t change anything.*  
4. Product prompts only after map is understood  
5. One mid-build “wow”: agent adds Meilisearch/NATS worker/object storage and rewires  

---

## 6. Decision matrix (pick in 10 minutes)

| If you want… | Build |
|--------------|--------|
| Maximum “this *is* Zerops” | **A1 Architecture Studio** or **A2 Migration Assistant** |
| Maximum product demo drama | **A3 DocPipe** or **B2 Pipeline Theater** |
| AI + workers without drowning | **A4 Agent Job Control Plane** or **B1 Trace Radar** |
| Fastest multiplayer demo | **A5 Incident Board** |
| You’re already strong at infra APIs | PR Preview Orchestrator (Tier C) |

### Suggested default for this weekend

**Primary recommendation: A1 Architecture Studio**

Reasons:
1. Directly matches event’s “Zerops tools” examples  
2. Multi-service backend is natural (save projects, async codegen, export artifacts)  
3. Demo is unmistakable in 90s: form → diagram → download YAML → “import into Zerops”  
4. Social post writes itself (before/after topology, multi-service list)  
5. Survivable solo with AI agents if presets are hard-coded  

**Runner-up if you prefer a “product people use” feel:** A3 DocPipe with a seeded PDF and visible worker queue.

---

## 7. Architecture template (any Tier A idea)

```
Public
  └── frontend (static/SSR)  ──http──►  api (runtime)

Private network
  ├── api  →  db:5432 (Postgres)
  ├── api  →  cache:6379 (Valkey)
  ├── api  →  broker:4222 (NATS)     [optional]
  ├── worker ← broker / queue
  ├── worker → db, cache, storage
  └── storage (S3-compatible object store)

Deploy contract: zerops.yaml (multi-setup monorepo or multi-service)
Optional: zcp service for agent workspace (dev/stage only)
```

Ship a `/architecture` page that lists real hostnames and edges. That single page often does more for “platform use” scoring than another feature.

---

## 8. Submission & social checklist

### Product

- [ ] Live URL works for a cold judge  
- [ ] Golden path < 90s  
- [ ] Seeded data / demo fixtures  
- [ ] Persistence survives refresh and second browser  
- [ ] Public repo (or judge access)  
- [ ] README: what, why, service map, how Zerops is used, AI tools disclosed  
- [ ] Architecture diagram image  

### Social (required shape)

- [ ] Project name  
- [ ] Short explanation  
- [ ] Short video of working product  
- [ ] Live deployment link  
- [ ] How Zerops is used (services + private network + yaml/ZCP)  
- [ ] Tags: `@WeMakeDevs` `@zeropsio`  

### Video

- [ ] Elevator pitch in first 5s  
- [ ] Click-through of one flow  
- [ ] 60–120s for social; ≤3 min for judges  
- [ ] Upload early  

---

## 9. Key links

| Resource | URL |
|----------|-----|
| Challenge | https://www.wemakedevs.org/hackathons/zerops |
| Rules | https://www.wemakedevs.org/hackathons/zerops/rules |
| Zerops docs | https://docs.zerops.io/ |
| ZCP quickstart | https://docs.zerops.io/zcp/quickstart |
| Coding agents feature | https://docs.zerops.io/features/coding-agents |
| Recipes | https://app.zerops.io/recipes |
| zerops.yaml | https://docs.zerops.io/zerops-yaml/specification |
| Kickoff stream | https://www.youtube.com/live/1bpt0iuXuNM |
| 7-service ZCP demo | https://www.youtube.com/watch?v=IZvO5hhJJJo |
| Image pipeline demo | https://www.youtube.com/watch?v=CNNgAcJMwWU |

---

## 10. Process notes

- **High signal:** official Zerops docs/marketing, challenge rules, multi-service Railway winners (e.g. worker+Redis+Postgres patterns), ZCP “proof or blocker” framing  
- **Filtered out:** generic “best AI startup ideas” lists, pure frontend toys, full enterprise platforms  
- **Non-obvious pattern:** The event’s social track + “how Zerops is used” means a **platform-native tool** can beat a prettier generic SaaS that only happens to be hosted on Zerops  
- **Second non-obvious pattern:** Starting from an **AI Agent recipe** and documenting one mid-build managed service addition is often a stronger “Zerops use” story than greenfield infra from scratch  

---

*Generated for local planning in `zerops-hack`. Update this doc after idea lock with a one-page architecture + hour-by-hour cut list.*
