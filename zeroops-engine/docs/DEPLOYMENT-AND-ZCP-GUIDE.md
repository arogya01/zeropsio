# Deployment + What ZCP Actually Is

Study guide for ZeroOps Studio on Zerops. Written after the first successful live deploy of this project.

**Live Studio (as of 2026-08-09):** see [`.zerops-deploy-notes.md`](../.zerops-deploy-notes.md).

---

## 1. Your confusion is correct — three different “ZCP”s

People say “ZCP” for three related things. Keep them separate:

| # | Name | What it is | Do we use it for hosting Studio? |
|---|------|------------|----------------------------------|
| A | **Zerops (the platform)** | Cloud that runs containers, builds, networking | Yes — this is where the app lives |
| B | **`zcli`** | Official CLI that talks to Zerops APIs | Yes — this is how we deployed Studio |
| C | **Official Zerops ZCP product** | “Zerops Control Plane” — MCP/agent tooling so coding agents can manage a project (deploy, verify, etc.). Still ends up using Zerops/`zcli` under the hood | **No** — not required for this deploy |
| D | **This repo’s `ZCPClient`** | A Node class that **spawns `zcli`** and streams logs. Marketing name for “our Zerops integration” | Used by Studio **to deploy other stacks for users**, not to host Studio itself |

### Short answer to: “Is ZCP a layer on top of zcli?”

**Official ZCP product:** roughly yes — agent-facing control layer that *uses* Zerops/`zcli` capabilities.

**This codebase’s “ZCP”:** not a separate layer. It **is** a thin wrapper **around** `zcli`:

```text
Studio UI  →  ZCPClient.provisionProject()  →  child_process.spawn('zcli', ...)
                                                      ↓
                                                   Zerops API
```

There is no alternate ZCP protocol in `src/server/zcp-client.js`. The log prefixes `[ZCP-INIT]`, `[ZCP-OK]` are strings your code prints.

Think of it like this:

```text
  Official product world              This hackathon repo

  ┌─────────────┐                     ┌──────────────────┐
  │ Agent / IDE │                     │ Studio browser   │
  └──────┬──────┘                     └────────┬─────────┘
         │ MCP tools                           │ WebSocket
         ▼                                     ▼
  ┌─────────────┐                     ┌──────────────────┐
  │ ZCP product │                     │ ZCPClient (ours) │  ← just a name
  └──────┬──────┘                     └────────┬─────────┘
         │                                     │ spawn
         ▼                                     ▼
  ┌─────────────┐                     ┌──────────────────┐
  │   zcli /    │                     │      zcli        │
  │ Zerops API  │                     │   Zerops API     │
  └─────────────┘                     └──────────────────┘
```

**If you remember only one sentence:**  
*Hosting Studio = you run `zcli`. Studio “ZCP” = Studio runs `zcli` for the user.*

---

## 2. Two layers of deployment (most important diagram)

```text
LAYER A — Deploy Studio itself (host the product)
  You (laptop) ──zcli──► Zerops project "zeroops-studio"
  Result: https://studio-2cbd-3000.prg1.zerops.app
  Status: DONE (2026-08-09)

LAYER B — Studio deploys *customer* stacks (the product feature)
  Judge/user clicks Deploy in UI
       → Studio server
       → ZCPClient
       → zcli project project-import (with their PAT)
  Result: a *new* Zerops project (templates, multi-service apps)
  Status: code exists; integrity polish still parked (Tasks 5–7)
```

Judges open **Layer A**. The cool multi-service provisioning demo is **Layer B**.

---

## 3. Two YAML files (Zerops contract)

### A. `zerops-project-import.yml` — *what exists*

Creates the project and empty service slots.

```yaml
project:
  name: zeroops-studio
services:
  - hostname: studio          # private DNS name inside the project
    type: nodejs@22
    enableSubdomainAccess: true
```

After import, service is often `READY_TO_DEPLOY` (shell exists, no code yet).

### B. `zerops.yml` — *how one service builds and runs*

```yaml
zerops:
  - setup: studio             # MUST equal hostname above
    build:
      buildCommands:
        - npm ci --omit=dev
      deployFiles: [src, public, package.json, ...]
    run:
      ports:
        - port: 3000
          httpSupport: true   # NOT http: true
      start: node src/server/index.js
```

| Rule | Why |
|------|-----|
| `setup` name = `hostname` | Push binds recipe to service |
| `httpSupport: true` | Correct key for public HTTP |
| Managed DB/Valkey in **import** YAML only | No build step for managed services |
| Never invent `https://{project}.zerops.app` | Real URLs include generated host + port + region |

---

## 4. Full Layer A pipeline (what actually ran)

### Step 0 — Auth

`zcli` already logged in as your account. Credentials live under:

```text
~/Library/Application Support/zerops/
  cli.data     # token + region (api.app-prg1.zerops.io)
  .zcli.yml    # may be empty; zcli still reads cli.data
```

Check:

```bash
zcli project list
```

### Step 1 — Import (create empty project)

```bash
cd zeroops-engine
zcli project project-import zerops-project-import.yml --org-id cydeTCagQTayIC5j5CzRKA
```

What happened:

1. YAML validated  
2. Project `zeroops-studio` created  
3. Service `studio` created (`stack.create`)  
4. Status became `READY_TO_DEPLOY`  

IDs captured in `.zerops-deploy-notes.md`.

### Step 2 — First push (failed) — teachable error

```bash
zcli push studio --project-id Rqpl1t8sSfWadFknP4nOig
```

Pipeline stages Zerops ran:

```text
1. Select project/service     ✅
2. Read zerops.yml            ✅
3. Package + upload source    ✅
4. Start build container      ✅
5. npm ci --omit=dev          ❌ lockfile out of sync
6. run.start                  never reached
```

Error class: **build failure**, not auth, not YAML mismatch.

```text
npm ci can only install when package.json and package-lock.json are in sync
Missing: tsx@... from lock file
```

`npm ci` is strict. Local `node_modules` can work while remote `ci` fails.

### Step 3 — Fix lockfile

```bash
npm install                 # regenerate package-lock.json
npm ci --omit=dev           # must succeed locally first
```

Then push again — **same project**, no re-import.

### Step 4 — Second push (success)

```bash
zcli push studio --project-id Rqpl1t8sSfWadFknP4nOig
```

```text
npm ci --omit=dev           ✅
build artefacts (~4.8 MiB)  ✅
deploy to runtime           ✅
service status ACTIVE       ✅
run: node src/server/index.js
logs: "ZeroOps Engine Studio running on http://localhost:3000"
```

`localhost:3000` in logs is **inside the container**. Outside world hits the public subdomain.

### Step 5 — Public URL

Import already had `enableSubdomainAccess: true`. We also ran:

```bash
zcli service enable-subdomain studio --project-id Rqpl1t8sSfWadFknP4nOig
```

`zcli service list` does **not** print the URL. Source of truth from Zerops API:

```text
https://studio-2cbd-3000.prg1.zerops.app
```

Verified:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -L https://studio-2cbd-3000.prg1.zerops.app
# 200
```

### Step 6 — Day-2 operations

```bash
# Redeploy after code change
zcli push studio --project-id Rqpl1t8sSfWadFknP4nOig

# Runtime logs
zcli service log --project-id Rqpl1t8sSfWadFknP4nOig \
  --service-id CisTbT0KSWGBVxL6qRGa2Q --format SHORT --limit 100

# Build logs instead of runtime
zcli service log --project-id Rqpl1t8sSfWadFknP4nOig \
  --service-id CisTbT0KSWGBVxL6qRGa2Q --show-build-logs --format SHORT
```

---

## 5. Layer B — how Studio’s “ZCP” uses the same machinery

When a user deploys from the UI:

1. Browser sends deploy intent over WebSocket  
2. Server loads `ZCPClient` with the **user’s** PAT (session), not necessarily yours  
3. `provisionProject` spawns:

   ```text
   zcli project project-import -
   ```

   YAML on stdin (project + services for the *template*, not Studio itself)  
4. Stdout/stderr streamed to the UI as `[zcli stdout]` / `[ZCP-…]` lines  
5. Live URL is **parsed** from zcli output when present — never invented from the project name  

Same Zerops concepts:

- import YAML → empty services  
- later: push / build for each app service  
- private hostnames (`dbpostgres`, `webapp`) on the project network  

---

## 6. FAQ

**Q: Can I deploy Studio “using ZCP” instead of zcli?**  
A: For hosting Studio, use `zcli` (or the Zerops GUI). Our `ZCPClient` is for in-app deploys. Official ZCP product is optional agent tooling.

**Q: Is ZCP required for the hackathon demo?**  
A: A **live URL** is required. Official ZCP product is not. Naming your integration “ZCP” is storytelling; the workhorse is `zcli`.

**Q: Why not `https://zeroops-studio.zerops.app`?**  
A: Zerops assigns `hostname-subdomainHost-port.region.zerops.app`. Always parse or copy from the platform.

**Q: Do I re-import after every code change?**  
A: No. Import once. Then only `zcli push`.

**Q: Why `npm ci` on Zerops instead of `npm install`?**  
A: Reproducible installs. Requires a lockfile that matches `package.json`.

---

## 7. Cheat sheet

```bash
# List
zcli project list
zcli service list --project-id <PROJECT_ID>

# Create project once
zcli project project-import zerops-project-import.yml --org-id <ORG_ID>

# Ship code (repeatable)
zcli push studio --project-id <PROJECT_ID>

# Subdomain
zcli service enable-subdomain studio --project-id <PROJECT_ID>

# Logs
zcli service log --project-id <PROJECT_ID> --service-id <SERVICE_ID> --format SHORT

# Local preflight before push
npm ci --omit=dev
```

---

## 8. Mental model in one line

```text
Zerops = cloud
zcli   = remote control
ZCP (product) = agent remote control (optional)
ZCPClient (ours) = Node wrapper that presses the same remote (zcli)
```
