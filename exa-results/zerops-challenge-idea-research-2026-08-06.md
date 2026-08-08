# The Zerops Challenge — Deep Research & Idea Report

**Compiled:** 2026-08-06 · **Event:** Aug 8–9, 2026 (starts in ~2 days) · **Method:** 726 sources across 6 parallel Exa research agents + direct verification against `docs.zerops.io`, `zerops.io/pricing`, and the GitHub API (`zeropsio` org)

---

## 0. TL;DR — the recommendation

Build **ephemeral full-stack preview environments for AI-generated pull requests**: a bot that, for every PR, calls the Zerops REST API to provision a *complete isolated project* (app + Postgres + Valkey, seeded), comments the live URL back on the PR, and destroys it on merge.

Three reasons this wins on the stated rubric ("the idea, the execution, and how Zerops is used"):

1. **Zerops is load-bearing, not decorative.** The product literally cannot exist without API-driven provisioning of isolated, stateful, networked projects. Vercel/Netlify previews give you a frontend against a shared database; this gives a real isolated stack with its own Postgres.
2. **The problem is 2026-shaped and real.** Coding agents now open PRs faster than humans can review them, and you cannot review what you cannot run.
3. **The demo arc is a single unbroken 60 seconds:** agent opens PR → bot comments "environment ready" → click → working app with seeded data → merge → environment gone.

Runner-up if you want maximum demo spectacle: **§5.2 Resilience Drill** (kill the Postgres primary live, app stays up). Wildcard if you want maximum memorability: **§5.4 UDP match server**.

---

## 1. The brief, verified

| Item | Detail |
|---|---|
| Name | The Zerops Challenge, on [wemakedevs.org/hackathons/zerops](https://www.wemakedevs.org/hackathons/zerops) |
| Format | Online, **solo only**, one project per participant, 48 hours |
| Dates | Kickoff livestream Aug 8 → submissions close Aug 9; registration closes Aug 8 |
| Main prize | MacBook Neo — judged on "**the idea, the execution, and how Zerops is used**" |
| Social prize | Logitech MX Master 3 — judged on "**the clarity of the story, the demo, and its reach**" |
| Credits pool | $5,000 in Zerops credits spread across standout projects |
| Hard requirements | Deployed on Zerops · Zerops "meaningfully involved in how it is built, deployed, or operated" · reachable live URL · public source · deployment stays live through judging |
| Submission | Repo + live URL + demo video + public build post (name, explanation, working-product video, live link, Zerops-usage explanation, tags `@WeMakeDevs` `@zeropsio`) |
| AI policy | "AI can help you build it. It can't build it for you." Disclose all tools. Fully AI-generated projects with no meaningful original contribution are **rejected**. |
| Stack | Any language / framework / open-source tech |

**Two prizes, two different games.** The credits pool being spread "across standout projects" means the expected value of entering at all is high — you don't need to win the MacBook to get something. And the Social Track is a *separate*, much cheaper win: it rewards storytelling and reach, not code. Budget explicit hours for it (§6).

⚠ **Discrepancy to be aware of:** the hackathon page advertises "$15 free credits for new accounts," while [zerops.io/pricing](https://zerops.io/pricing) currently states **$65 trial credit, no card required**. Sign up early and check your actual balance before you architect anything expensive.

---

## 2. What actually wins — the judging model

This is the highest-signal section. It comes from WeMakeDevs' own published rubrics, named prior winners, and one unusually good first-hand judging account.

### 2.1 WeMakeDevs' published criteria (from their prior hackathons — FutureStack GenAI 2025, AI Agents Assemble)

Six dimensions, consistently reused: **Potential Impact · Creativity & Originality · Technical Implementation · Learning & Growth · Aesthetics & UX · Presentation & Communication.**

Note that "Learning & Growth" and "Presentation" are a third of the rubric. That is unusually generous to a well-told story, and it means the demo video and README are *scored artifacts*, not packaging.

### 2.2 What moves scores in practice

The strongest single source is [*What Judges Actually Score: Notes From a Year of Hackathon Judging*](https://dev.to) (DEV, 2026-07-27) — a judge reporting from three July 2026 events. Their finding: everyone lands mid-range on the published rubric, and **the spread that produces a winner comes from two or three things the rubric does not name.**

| Rank | Differentiator | Direct quote / finding |
|---|---|---|
| 1 | **Whether the demo ran** | "the single largest score differentiator I saw. A working demo, live, beats a more ambitious project shown as slides almost every time… because a live demo removes doubt, and doubt is what a judge is actually managing under time pressure." |
| 2 | **Whether you said what it is in the first sentence** | Teams opening with context/market size lost a third of the slot before the judge knew what they were looking at. Give the anchor first. |
| 3 | **Whether scope matched the time** | "A team that built one narrow thing well reads as a team that made decisions. A team that built a platform in 36 hours reads as a team that did not." |
| 4 | **Admitting a limitation** *(counterintuitive)* | "Teams that say nothing breaks lose credibility instantly, and teams that name the weakness gain more than they lose." |
| 5 | **A one-line identity** | "Judges score partly on whether they can imagine explaining your project to someone else." Three features with no center do not survive discussion. |

**What explicitly does *not* move scores:** framework choice, team credentials, slide decks, and polish beyond legibility — "elaborate UI does not add on top of legible UI, and past a point it makes me wonder where the backend time went."

### 2.3 Sponsor-tech depth is the multiplier

An analysis of [8,200 ETHGlobal projects across 38 events](https://medium.com) (Simon Brown, June 2026) found:

- "A hungry specialist sponsor meets a genuinely novel category → projects win at **3.30× expected rate** inside the event."
- But: "**Alpha is a window, not a level. It closes on saturation every single time.**" One themed event drew 217 near-identical clones fighting over ~36 prizes, and those projects won at *well under half* expected rate.

Translation for you: Zerops is exactly the "hungry specialist sponsor." The 3.3× is available — but only if your project is not the thing 40 other people also built. Which is what §4 is for.

### 2.4 Named prior winners and why (pattern extraction)

| Project | Event / sponsor | Why it won |
|---|---|---|
| **RivalMap** | AWS Autonomous Agents, Feb 2026 — **1st overall** | 14-step pipeline, zero human-in-loop after URL submit, integrated 9 of 11 sponsor stacks (vs. 3 minimum). Live demo run on `linear.app` then `figma.com` with the knowledge graph lighting up as the agent learned. |
| **Sentrix** | UCL AI Build Festival 2026 (24h) | "Agentic police for AI swarms." Sharp threat story with concrete failure modes, a live arc (anomaly → chase → quarantine), everything clonable on GitHub. Story beat feature list. |
| **DCRCA Agent** | AgentHack 2025 — **WeMakeDevs + Portia AI** | Disaster-response coordination agent with human approval gates. Wired the sponsor framework deeply, real-world stakes. |
| **Lethe** | The Hangover Hackathon, Jul 2026 — Cognee track | Self-hosted incident-triage assistant that *forgets stale infra knowledge*. Sponsor tech (memory graph) at the core, not the surface. |
| **MCP-in-Browser** | E2B Hackathon, Prague — **1st** | Removed a real friction ("use MCP without local setup") by orchestrating sponsor sandboxes. Shipped as an npm package. |
| **Voxy** | SF Voice Agent Hackathon (1 day) — **grand prize** | "The platform just works." Sponsor tech seamless and invisible to the user. |

**The pattern, distilled:** one-sentence identity + sponsor tech at the core + a live arc the judge can watch + narrow scope done completely + honesty about limits.

### 2.5 The AI-disclosure play

Every 2026 rulebook surveyed (USAII, XTF, unitaryHACK, MLH) converges on the same line: **disclosure is free, non-comprehension is fatal.** USAII states outright that "using AI tools with proper disclosure does not disadvantage your submission." unitaryHACK's disqualifiers are specifically: undisclosed use, hallucinated logic, mass spray-and-pray submissions, and *submitting output you never ran or understood*. XTF: "if a judge asks 'explain this code,' you must be able to."

**Actionable:** put an `AI-USAGE.md` in the repo listing exactly which tools did what ("Claude Code for the Zerops API client and the teardown reconciler; hand-written: the provisioning state machine and the GitHub webhook verification"). Then make sure you can explain the state machine cold. This converts a compliance requirement into a credibility signal — and given §2.2 rank 4, volunteering your own limits *raises* your score.

---

## 3. Zerops capability map — where the unfair advantages actually are

All verified against `docs.zerops.io` and the pricing page on 2026-08-06.

### 3.1 Managed services (12) — all on a private network, addressable by hostname

`PostgreSQL` · `MariaDB/MySQL` · `Valkey` · `KeyDB` · `Elasticsearch` · `Typesense` · `Meilisearch` · **`Qdrant`** (vector) · **`NATS`** · **`Kafka`** · **`ClickHouse`** · `Object Storage (S3-compatible)` · `Shared Storage`

You reach these as `db:5432`, `valkey:6379` etc. — no connection-string plumbing, no external add-on accounts.

### 3.2 Runtimes (13) + real Linux

`Node.js` · `PHP` · `Python` · `Go` · `.NET` · `Rust` · `Java` · `Deno` · `Bun` · `Elixir` · `Gleam` · `Ruby` · `Nginx/Static` — **plus `Ubuntu`, `Alpine`, and `Docker` service types** with root access, system packages, and SSH. These are full Linux containers, not restricted app slots.

### 3.3 The seven capabilities that are genuinely hard to get elsewhere

Ranked by how much leverage they give a hackathon project:

| # | Capability | Why it's an unlock |
|---|---|---|
| 1 | **Public REST API** (`api.app-prg1.zerops.io/api/rest/public`, Bearer PAT, [openapi spec published](https://github.com/zeropsio/openapi)) + [Go SDK](https://github.com/zeropsio/zerops-go) | You can **create and destroy entire projects and services programmatically**. This is the foundation for anything ephemeral: preview envs, sandboxes, per-tenant stacks, match servers. Very few PaaS expose this. |
| 2 | **Raw TCP *and UDP* ports** (`run.ports[].protocol: TCP\|UDP`, `httpSupport: false`) | Inbound SMTP, MQTT, DNS, QUIC, game protocols, WireGuard. **Structurally impossible on Vercel/Netlify/Workers.** Almost nobody builds here. |
| 3 | **One-click HA** — 3-container clusters for Postgres/Valkey/etc. as a *toggle*, not a pricing tier | Real failover you can demonstrate. Competitors gate this behind enterprise plans. |
| 4 | **Full Linux + Docker service type, root access** | Run arbitrary/untrusted workloads, custom daemons, anything that needs `apt install`. |
| 5 | **WireGuard VPN into the private project network** (`zcli vpn up`) | Your laptop joins the project network; local code talks to `db:5432` directly. Genuinely great demo material. |
| 6 | **`crontab` + `startCommands` inside `zerops.yml`** | Scheduled jobs and multi-process containers with no external scheduler. |
| 7 | **Autoscaling**: vertical re-evaluated ~every 10s in 0.125 GB steps; horizontal 1–10 containers. **No scale-to-zero.** | The absence of scale-to-zero is a *feature* here: long-running processes, websockets, and stateful daemons just work, no cold starts. |

### 3.4 `zerops.yml` shape (exact keys, for planning)

```
zerops:
  - setup: <hostname>            # required
    extends: <other-service>
    build:   { base, os, prepareCommands, buildCommands, deployFiles, cache, addToRunPrepare, envVariables }
    deploy:  { temporaryShutdown, readinessCheck }
    run:     { base, os, ports[{port, protocol, httpSupport}], prepareCommands, initCommands,
               start, startCommands, documentRoot, siteConfigPath, envVariables, envReplace,
               routing, healthCheck, crontab }     # run is required
```
Autoscaling and HA are **not** `zerops.yml` keys — they live in the project-import YAML / GUI.

### 3.5 ZCP — Zerops' own MCP server for coding agents

**Confirmed real and active:** [`github.com/zeropsio/zcp`](https://github.com/zeropsio/zcp) (pushed 2026-08-05), docs at [`docs.zerops.io/zcp`](https://docs.zerops.io/zcp), announced as public preview May 2026. Runs either remotely as a `zcp@1` service inside your project or locally over `zcli vpn up`. Supports Claude Code, Codex, Antigravity, Grok Build. Exposes deploy/logs/events/env/scale/verify operations.

**This cuts both ways and you must plan around it:**
- ❌ *Don't* build "an MCP server so agents can deploy to Zerops." The sponsor shipped it three months ago. You'd be showing them their own product.
- ✅ *Do* use it as an accelerator, disclosed in `AI-USAGE.md`, and *do* build agent-facing infrastructure **on** Zerops.

### 3.6 Pricing reality for a 48-hour build

Lightweight project core is **free**; Serious is $10/mo. Resources: shared CPU **$0.60**/core/mo, dedicated **$6.00**, RAM **$3.00**/GB/mo, disk **$0.10**/GB/mo — billed **per minute**. With a $65 trial credit, a weekend of spinning projects up and down costs cents. Provisioning-heavy ideas are financially safe.

### 3.7 Known rough edges — plan around these, and name them in your demo

| Issue | Impact | Mitigation |
|---|---|---|
| **GitLab integration**: tokens expire ~2h, auto-deploy fails | High if you use GitLab | **Use GitHub**, or push via `zcli` |
| **Build/run env vars are not shared by default** | Bites nearly every first-timer | Explicitly declare in `build.envVariables` |
| **VPN fails on Linux** without `systemd-resolved` | Blocks local dev flow | `sudo systemctl enable --now systemd-resolved` |
| **1-hour hard build timeout** | Heavy builds die | Use `build.cache`, split steps |
| `zerops.yml` is not zero-config | ~1h learning curve | Fork a recipe (§4.2) instead of writing from scratch |
| Shared storage: 60 GB cap, locks per-container only | Don't put a DB on it | Use object storage |
| Regions: EU-first, US-East added Mar 2026 | Latency for Asia | Note it honestly; irrelevant for judging |

**Budget one hour, on Aug 8, for the env-var and VPN gotchas specifically.** They are the two most-reported first-deploy failures.

---

## 4. Prior art — what NOT to build, and what to steal

### 4.1 Saturated by the sponsor itself

Pulled live from the `zeropsio` GitHub org (100+ repos). If your idea is in this list, it is *already a Zerops recipe* and will read as derivative:

- **Framework deploys**: Next.js, Nuxt, Astro, SvelteKit, Angular, Qwik, Analog, Solid, Ember, Sails, Turborepo, Laravel (×4: minimal, jetstream, filament, twill), Django, Flask, Phoenix, Rails, NestJS, Adonis, Symfony, Nette, Medusa (×3), RedwoodJS, Payload, Ghost, WordPress, Odoo, Scala/Play, Gleam, Deno/Hono
- **Self-hosted app catalog**: `recipe-n8n`, `recipe-nextcloud`, `recipe-keycloak`, `recipe-supertokens`, `recipe-metabase`, `recipe-mattermost`, `recipe-airflow`, `recipe-jenkins`, `recipe-adminer`, `recipe-medama`, `recipe-imgproxy`, `recipe-mailpit`
- **Observability**: `recipe-elk`, `recipe-prometheus-grafana`, `recipe-prometheus`
- **CI runners**: `recipe-github-runner`, `recipe-zcli-gitlab-runner`
- **Game servers**: `recipe-minecraft-server`, `recipe-quake3-server`
- ⚠ **RAG**: [`recipe-rag-starter`](https://github.com/zeropsio/recipe-rag-starter) is an official **8-service** showcase — Qdrant + Postgres + Valkey + NATS + S3 + FastAPI + worker + dashboard. **A "RAG app on Zerops" is fully commoditized. Do not build it.**
- **Multi-env GitOps**: [`zerops-showcase-deploy`](https://github.com/zeropsio/zerops-showcase-deploy) already creates isolated projects per branch/PR via the API. *(Read this carefully — it's simultaneously the biggest overlap risk with idea 5.1 and its single best accelerator. Your differentiation is the product layer: agent-PR framing, GitHub App UX, seeded data, TTL reconciliation, cost display.)*
- **Agent tooling**: `zcp` (§3.5), `zagent-knowledge`

### 4.2 Accelerators — use these

| Asset | Use |
|---|---|
[`zeropsio/recipes`](https://github.com/zeropsio/recipes) + [app.zerops.io/recipes](https://app.zerops.io/recipes) | Fork the closest stack; each ships a `zerops-project-import.yml` |
| [`zcli`](https://github.com/zeropsio/zcli) | `zcli login <token>` · `zcli push` · `zcli service deploy` · `zcli vpn up` |
| [`zeropsio/actions`](https://github.com/zeropsio/actions) | Official GitHub Action for deploys |
| [`zeropsio/openapi`](https://github.com/zeropsio/openapi) + [API reference](https://docs.zerops.io/references/api) | Generate a typed client in minutes — **the key unlock for §5.1** |
| [`zeropsio/zerops-go`](https://github.com/zeropsio/zerops-go) | Official Go client |
| [`zerops-showcase-deploy`](https://github.com/zeropsio/zerops-showcase-deploy) | `zerops/scripts/zerops-api.sh` — working `curl + jq` API calls |
| [`zvsc`](https://github.com/zeropsio/zvsc) · [`zerops-autoscaler`](https://github.com/zeropsio/zerops-autoscaler) · [`libsql`](https://github.com/zeropsio/libsql) | Lesser-known org repos worth a skim |

### 4.3 Territory crowdedness (2026 landscape)

| Territory | Crowded? | Verdict |
|---|---|---|
| Hosted MCP servers | 🔴 **Saturated** — Glama, MCPLambda, Conduit, MCPBay, MCP Nest all launched '25–'26 | Avoid |
| LLM observability | 🔴 **Consolidated** — Langfuse, LangSmith, Spanlens hold the space | Avoid |
| RAG starters | 🔴 Sponsor already ships one | Avoid |
| Agent sandboxes / code execution | 🟠 High — E2B, Daytona, Modal | Only with a self-hosted/sovereignty angle |
| Local-first sync | 🟠 High — Electric, Zero, PowerSync | Would read derivative |
| Durable workflows for indie devs | 🟡 Medium — Temporal costly to self-host, DBOS lacks ops | Real gap, but hard to demo |
| **Ephemeral stateful environments** | 🟢 **Low** — everyone does frontend previews; nobody does isolated full stacks with real DBs | **Best opening** |
| **Non-HTTP protocol services** | 🟢 **Very low** — most PaaS structurally can't | **Best differentiation story** |
| Agent memory / mergeable state | 🟢 Low-medium — no standard yet | Interesting, abstract to demo |

---

## 5. The ideas

Each is scored on the criteria that actually matter. **"Zerops load-bearing"** = would this project be impossible or badly degraded on Vercel/Render/Railway? That question *is* the "how Zerops is used" score.

---

### 5.1 ⭐ RECOMMENDED — Ephemeral full-stack environments for AI-generated PRs

> **One-liner:** "Every AI-written pull request gets a real, running, throwaway production stack — because you can't review what you can't run."

**What it does.** A GitHub App. On PR open, it calls the Zerops API to create a *new isolated project* — app service + Postgres + Valkey — runs migrations, seeds representative data, and comments the live URL on the PR with a resource/cost readout. On merge or close (or TTL expiry), it destroys the project. A reconciler sweeps orphans so nothing leaks.

**Why Zerops is load-bearing (the whole pitch).** Vercel previews give you a frontend against one shared database, so two PRs touching the schema collide. This gives each PR its own network, its own Postgres, its own state — because Zerops exposes project creation over an API, bills per minute, and puts every project on its own private network. Say that sentence in the demo.

| | |
|---|---|
| Judging fit | **Idea** ✅ timely, real pain · **Execution** ✅ demoable end-to-end · **Zerops usage** ✅✅ maximal |
| 48h feasibility | **High** — `zerops-showcase-deploy` proves the API path; generate the client from `openapi` |
| Novelty | Good. Preview envs exist; *isolated stateful* previews framed around agent PRs are open ground |
| Biggest risk | **Teardown reliability.** Leaked projects = burned credits. Build the reconciler *first*, not last |
| Honest limitation to volunteer | "Provisioning takes ~60–90s, so it's async — the bot edits its comment when ready. And I cap concurrent envs at N; there's no queue yet." |

**48-hour scope cut.** Ship: webhook → provision → seed → comment → destroy, for **one** hardcoded stack. Do *not* build: multi-stack detection, a web dashboard, auth/orgs, or cost analytics beyond a printed number.

**Demo arc (60s).** Agent opens PR → bot comments "⏳ provisioning" → cut to comment updating with URL → click, app is live with seeded data → show a *second* PR running simultaneously with a conflicting schema change, both green → merge → environment destroyed, Zerops dashboard empties.

That second-PR beat is the whole argument in five seconds. Do not skip it.

---

### 5.2 Runner-up (best spectacle) — Resilience Drill: chaos testing that proves your HA

> **One-liner:** "Push a button, kill your database primary, and get a report proving your app survived."

**What it does.** Point it at a Zerops project. It runs a scripted drill via the API — kill the Postgres primary, kill an app container, saturate a service — while continuously probing your endpoint. Output: a timeline of failover duration, dropped requests, and recovery, as a shareable resilience report you can run in CI.

**Why Zerops is load-bearing.** Real 3-node HA clusters are a *toggle* on Zerops and an enterprise tier everywhere else. You cannot demonstrate genuine Postgres failover on Render's hobby tier at all. This project's entire value derives from the sponsor's most differentiated feature — which is the single most direct possible answer to "how is Zerops used."

| | |
|---|---|
| Judging fit | **Idea** 🟡 more tool than product · **Execution** ✅ · **Zerops usage** ✅✅ showcases the crown jewel |
| 48h feasibility | **High** — small surface: API calls + a probe loop + a report renderer |
| Novelty | Chaos engineering isn't new; *chaos-as-a-one-click-report for a specific PaaS* is fresh |
| Biggest risk | Reads as demo-ware unless you frame it as **resilience CI**. Also: verify you can actually kill a specific HA container via the API **on day 1** — if not, the idea collapses |
| Honest limitation | "I only implement three fault types, and I measure from outside the cluster, so my failover numbers are upper bounds." |

**Why it's the runner-up, not the pick:** killing a live database on camera and having the app stay up is the most memorable 10 seconds any judge will see this weekend. But the *product* story is thinner than 5.1, and §2.2 says judges reward a project they can explain to someone else as a thing people would use.

---

### 5.3 Sharpest differentiation — Email-as-an-API (inbound SMTP)

> **One-liner:** "Give any app a real email address that turns inbound mail into structured webhooks — self-hosted, on your own infra."

**What it does.** A real SMTP server on raw TCP, parsing inbound mail into structured JSON (sender, subject, body, attachments → object storage), stored in Postgres, delivered as signed webhooks, with a live inbox UI. Think self-hostable Postmark-inbound / Mailgun-routes.

**Why Zerops is load-bearing.** This is the strongest "impossible elsewhere" story in the report: **you cannot bind an inbound SMTP port on Vercel, Netlify, or Cloudflare Workers.** It needs a raw TCP listener, a long-running process, persistent storage, and no scale-to-zero — which is precisely the shape Zerops has and serverless platforms don't.

| | |
|---|---|
| Judging fit | **Idea** ✅ real, durable utility · **Execution** 🟡 protocol work is fiddly · **Zerops usage** ✅✅ uniquely enabled |
| 48h feasibility | **Medium** — use a library (Go `emersion/go-smtp`, Python `aiosmtpd`); don't write a parser |
| Novelty | High for a hackathon. Nearly nobody attempts inbound mail |
| ⚠ Biggest risk | **Verify on Aug 8 morning that Zerops will route external traffic to your chosen inbound port and that port 25 isn't blocked.** If 25 is blocked, fall back to 2525 + a documented relay, or pivot to MQTT ingest → ClickHouse (same architectural story, no port politics) |
| Honest limitation | "No SPF/DKIM/DMARC verification yet, and I'm on a non-standard port — so this is a receiver, not a deliverability story." |

---

### 5.4 Wildcard (most memorable) — Dedicated UDP match servers, provisioned per game

> **One-liner:** "Every match gets its own authoritative game server, spun up on demand and destroyed when the match ends."

**What it does.** A browser game with a matchmaking service that, on match start, provisions a real dedicated authoritative server on a **raw UDP port** via the Zerops API, hands both clients the endpoint, and destroys it when the match ends.

**Why Zerops is load-bearing.** UDP + API-driven provisioning + no cold starts. This combination is unavailable on essentially every mainstream PaaS. `recipe-minecraft-server` and `recipe-quake3-server` prove UDP game workloads run — but those are *"run a server"* recipes, not *"provision a server per match"* products, so you're not duplicating them.

| | |
|---|---|
| Judging fit | **Idea** 🟡 fun over useful · **Execution** ⚠ game + netcode + infra in 48h solo · **Zerops usage** ✅✅ |
| 48h feasibility | **Low-medium.** Only if you already have game/netcode reflexes |
| Novelty | Very high. Judges will remember it |
| Biggest risk | Scope. Two of {game, netcode, provisioning} will eat your weekend |
| Mitigation | Make the game *trivially* simple — two dots and a ball. The product is the provisioning, not the gameplay |

---

### 5.5 Considered and rejected

| Idea | Why not |
|---|---|
| Hosted MCP server platform | Saturated market (§4.3) **and** the sponsor ships `zcp` (§3.5) |
| RAG / chat-with-docs | `recipe-rag-starter` is an official 8-service showcase. Instantly derivative |
| LLM cost/observability dashboard | Consolidated market; also a dashboard, which demos poorly |
| "Deploy X to Zerops in one click" | The recipes catalog *is* this |
| Self-hosted SaaS alternative (Notion/Airtable clone) | Zerops is incidental — it'd run anywhere. Fails the load-bearing test |
| Agent sandbox / E2B clone | Crowded, and the honest answer to "how do you isolate untrusted code?" is weak at 48h. Judges ask that question |

---

## 6. Social Track playbook

A separate prize, judged on "clarity of the story, the demo, and its reach." Cheap to win relative to the MacBook. Research-backed specifics:

### Post anatomy (X)
1. **Line 1–2 is everything.** A specific claim or number + a surprise. Never "excited to announce."
2. **Native video in the first post.** External links are deprioritized ~40–60%; native video outperforms link posts 3–5×. Put the live URL in a *reply*, and say "link in replies."
3. **Tag `@zeropsio` first**, `@WeMakeDevs` second — first tag reliably triggers the notification that gets you reposted.
4. **One specific Zerops sentence, not gratitude.** "Each PR gets its own Postgres because Zerops lets me create whole projects over an API" gets quoted. "Thanks @zeropsio for the platform" does not.
5. **Then a short thread (5–8)** on the build: the thing that broke, the fix, the number. Single post or thread — no middle length.
6. **Answer every reply for the first 30 minutes.** Replies weigh more than likes; ~20 replies in 30 min is the "For You" trigger.

### Demo video spec
- **30–60 seconds.** Completion rate 56–68% in that band; 90–120s is the dead zone.
- **Hook in 3 seconds** — visual pattern-interrupt or on-screen text promise. 40–50% of viewers decide by second 3.
- **9:16 vertical**, burned-in captions (≈80% watch muted).
- **Silent screen recording with captions beats a talking head** ~2× on conversion — buyers want the actual UI.
- Zoom in. Terminal text unreadable on a phone is the #1 dev-demo failure.
- Show the *arc*, not the features. For 5.1: two conflicting PRs, both green.

### Anti-patterns
"Excited to announce" · architecture diagram as the opener · 3-minute walkthrough · uncaptioned voiceover · live link in the first post · posting once and going to sleep · thanking the sponsor generically.

---

## 7. Execution plan

**Before kickoff (today → Aug 7, ~2h).** Create the Zerops account **now** and confirm your real credit balance. Fork the closest recipe and deploy it once, end-to-end, so the `zerops.yml` learning curve and the build/run env-var gotcha happen *before* the clock starts. Get a PAT and make one successful REST API call. Read `zerops-showcase-deploy/zerops/scripts/zerops-api.sh`.

> This pre-work is legal — the rules restrict *project* code, not learning the platform. Keep the hackathon repo empty until kickoff.

**Aug 8, hours 0–4 — de-risk.** Prove the single riskiest primitive with a throwaway script: for 5.1, create *and destroy* a project via API. For 5.2, kill a specific HA container. For 5.3, bind and receive on your inbound port. **If the primitive doesn't work, pivot now, not at hour 30.**

**Hours 4–20 — the spine.** One unbroken happy path, hardcoded everywhere it can be. No UI polish, no config, no auth.

**Hours 20–28 — the second beat.** The one detail that makes the demo an argument (5.1: concurrent conflicting PRs). Then the reconciler/cleanup.

**Hours 28–36 — freeze and film.** Code freeze at 36 with the deployment live. Record the video *before* you're tired; expect 4–6 takes.

**Hours 36–44 — the scored artifacts.** README with the one-liner in the first sentence, a screenshot of the thing running, a "what breaks first at scale" section, and `AI-USAGE.md`. Then the social post.

**Hours 44–48 — buffer.** Verify the live URL from a clean browser and phone. It must stay up through judging.

**Three things that lose the most points, in order:** a dead live URL at judging time · a demo video where the terminal is unreadable · a README that explains your architecture before it says what the thing is.

---

## 8. Flags and open questions

1. **Credit amount is ambiguous** — hackathon page says $15, pricing page says $65. Check your balance before architecting.
2. **Port 25 / inbound TCP routing is unverified** (blocks 5.3). Test in hour 0.
3. **API container-kill for a specific HA replica is unverified** (blocks 5.2). Test in hour 0.
4. **`zerops-showcase-deploy` overlaps 5.1's mechanism.** Read it, credit it, and be explicit that your contribution is the product layer — not the API calls.
5. **Use GitHub, not GitLab.** The GitLab token-expiry bug is well documented and would cost you hours.
6. **"MacBook Neo"** is the prize as written on the page; I could not verify the model independently.

---

## Appendix — sources

Six parallel research agents, **726 sources**: platform capability surface (155) · practitioner differentiators & rough edges (100) · judging patterns & prior winners (120) · Zerops prior art & accelerators (70) · 2026 infra-territory whitespace (152) · social/demo mechanics (129).

Independently verified by direct fetch on 2026-08-06: `docs.zerops.io/services`, `docs.zerops.io/zerops-yaml/specification`, `docs.zerops.io/zcp`, `zerops.io/pricing`, `github.com/zeropsio/recipe-rag-starter`, and the full `zeropsio` org repo listing via the GitHub API.

Agent-reported claims corrected during verification: ClickHouse **is** offered (agent omitted it); trial credit is **$65** on the pricing page (agent and event page disagreed); several "recipes" listed speculatively by an agent were replaced with the verified GitHub org listing; `horizontalAutoscaling`/`verticalAutoscaling` are **not** `zerops.yml` keys.
