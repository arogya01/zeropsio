# Zeroperable

**Prompt → multi-service stack on Zerops.**

Zeroperable is a hackathon project for the [Zerops Challenge](https://www.wemakedevs.org/hackathons/zerops). The idea is simple: most AI “app builders” stop at a single React page. Real products need more than that — services, databases, private networking, builds, health checks, and a public URL. Zerops already knows how to run that kind of stack. Zeroperable is the layer that turns a prompt (or a template) into a real deploy on **your** Zerops account.

This README describes **project intent** as framed by the **current homepage** (`/`). It is not a full product or API reference.

---

## Intent

Zeroperable exists to close the gap between *generated code* and *running infrastructure*.

| Without Zeroperable | With Zeroperable |
|-----------------|--------------|
| AI writes a frontend (or stubs) | AI (or a template) produces a multi-service layout |
| You hand-write Docker / YAML / env wiring | Zeroperable emits `zerops.yml` + project import shape |
| You click around a cloud console | `zcli` runs against **your** Zerops Personal Access Token |
| “It works on my machine” | Live build logs, health audit, real `*.zerops.app` URL |

The homepage sells that loop in one line:

> Zeroperable synthesizes polyglot services and `zerops.yml`, then provisions with `zcli` using **your** Zerops PAT. Build logs stream live. Health is audited. You get a real URL.

---

## The homepage (what it is saying)

The current landing page is marketing + contract, not the workbench. It answers three questions:

1. **What do I get?** A multi-service stack on Zerops, not a zip of sample code.
2. **Who owns the cloud?** You do — bring your own Zerops PAT; Zeroperable does not pretend to be the host.
3. **How do I trust it?** Provisioning uses real `zcli` operations; the page surfaces live project metadata and a public URL when the platform has one.

### Hero

- **Headline:** Prompt → multi-service stack on Zerops  
- **Actions:** try the demo, enter Studio, or open the live host  

### “This deployment”

The page documents the **Studio itself** as a living Zerops service (dogfooding):

| Fact | Meaning |
|------|---------|
| project | Zerops project that hosts Studio |
| service | `nodejs@22` service (e.g. port 3000) |
| public url | Real `*.zerops.app` hostname |
| mechanism | `zcli project project-import` · `zcli push` |
| ui | React + Vite + Tailwind · Express API |

### Template topology

What a full stack looks like when Zeroperable provisions customer apps:

```text
webapp        nodejs
apigateway    go
aiworker      python
dbpostgres    postgresql@16
cachevalkey   valkey@7.2

addressed by hostname on the private network
```

Services talk over Zerops’ private network by hostname — no public DB exposure required for inter-service traffic.

### Import shape

The homepage shows the **Zerops project-import** contract: a generated project name plus service slots (`type` + `hostname`). That is the platform’s “create empty topology” step before build/push.

### Four-step product loop

| Step | Name | What happens |
|------|------|----------------|
| 01 | **Synthesize** | Template or prompt → multi-service code + import YAML |
| 02 | **Provision** | `zcli project project-import` with the session PAT |
| 03 | **Audit** | HTTP probe + reachable service checks |
| 04 | **Open** | Live `*.zerops.app` URL when Zerops returns one |

---

## How we use Zerops

Zerops is not a bolt-on demo host. It is the **runtime and control plane** for both hosting Zeroperable and deploying what users build.

### Two layers

```text
LAYER A — Host Zeroperable itself
  Developer ──zcli──► Zerops project (e.g. zeroperable-studio)
  Result: public Studio URL on *.zerops.app

LAYER B — Zeroperable deploys *user* stacks (the product)
  User/judge in the UI
       → Studio server
       → zcli (user’s PAT)
       → new Zerops project + services
  Result: their multi-service app on Zerops
```

Judges land on **Layer A** (the homepage and Studio). The homepage’s topology and import panels describe **Layer B** — what the product does with Zerops on behalf of the user.

### Zerops primitives we lean on

| Primitive | Role in Zeroperable |
|-----------|-----------------|
| **Project + services** | Isolated multi-container apps (web, API, worker, managed Postgres, Valkey) |
| **`zerops-project-import.yml`** | Declares project name and service slots |
| **`zerops.yml`** | Per-service build/run/deploy pipeline |
| **`zcli`** | Official CLI: import projects, push builds, stream logs |
| **Personal Access Token** | User-owned credentials; session-scoped in Studio (“BYO cloud”) |
| **Private networking** | Services resolve each other by hostname inside the project |
| **Subdomain / public URL** | Platform-issued `*.zerops.app` when `enableSubdomainAccess` (or equivalent) is set |
| **Managed databases** | PostgreSQL and Valkey as first-class service types, not DIY containers |

### What we deliberately do *not* claim on the homepage

- Inventing live URLs before Zerops returns one  
- Auto-shipping without an explicit user action where the product requires “Ship” / deploy  
- Replacing Zerops’ control plane with a fake simulator for the happy path  

Infrastructure truth comes from Zerops + `zcli`. Zeroperable is the synthesizer and UX around that truth.

---

## Mental model

```text
  Prompt or template
         │
         ▼
  ┌──────────────────┐
  │  Zeroperable Studio  │  synthesize code + Zerops YAML
  └────────┬─────────┘
           │  zcli + user PAT
           ▼
  ┌──────────────────┐
  │     Zerops       │  projects · builds · private net · public URL
  └────────┬─────────┘
           │
           ▼
     Live app URL
```

---

## Links

| | |
|--|--|
| **Live** | https://studio-2cbd-3000.prg1.zerops.app |
| **Demo** | https://studio-2cbd-3000.prg1.zerops.app/demo |
| **Repo** | https://github.com/arogya01/zeropsio |
| **Challenge** | [Zerops Challenge (WeMakeDevs)](https://www.wemakedevs.org/hackathons/zerops) |

---

## AI usage (disclosure)

Two different places AI shows up — keep them separate:

### 1. Inside the product

- **What:** Optional LLM calls (OpenAI Chat Completions; model configurable via env, e.g. `OPENAI_MODEL`) to turn a natural-language prompt into app code / config (templates still work without a model).
- **What is not AI:** Project import, build, deploy, log streaming, and health checks. Those go through **`zcli` → Zerops**. Live URLs come from the platform, not the model.
- **Keys:** Demo/operator mode can use a server-side key; Studio can also use user-supplied credentials depending on path. Without a key, synthesis fails clearly or falls back to template/deterministic paths where implemented — it does not invent a public URL.

### 2. Building this repo

- Large parts of **Zeroperable itself** (UI, server glue, deploy pipeline, docs) were written or iterated with **AI coding assistants** (agentic tools in the IDE/CLI). Humans directed architecture, reviewed diffs, ran deploys, and fixed real Zerops/`zcli` failures.
- This is a hackathon build: expect sharp edges. Prefer the live host + logs over marketing claims.

We disclose this so judges and readers can tell **product AI** (prompt → code) from **infra truth** (Zerops) and from **how the codebase was authored**.

---

## In one sentence

**Zeroperable turns a prompt or template into a multi-service layout, provisions it on Zerops with your token via `zcli`, audits health, and returns the live URL when the platform has one.**
