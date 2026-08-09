# ZeroOps UI (first-principles system)

## Design rules

1. **One system** across `/`, `/login`, `/studio` — not marketing skins.
2. **Type:** IBM Plex Sans (UI) + IBM Plex Mono (logs, IDs, YAML, hostnames).
3. **Color is state:** idle / running / ok / fail. Near-monochrome chrome.
4. **No** gradient blobs, emoji feature cards, multi-variant galleries as product UI.
5. **Motion only for deploy state** (topology chip pulse, edge packet-flow). Landing is static.
6. **Specificity:** real project IDs and live URL on the overview page.

## Routes

| Path | Role |
|------|------|
| `/` | Thin technical overview + evidence |
| `/demo` | Judge-day sandbox (templates + canvas theater + optional real deploy) |
| `/login` | Session auth |
| `/studio` | Factory floor (OpenAI key → synth, PAT → zcli stream) |

### Demo day env

```bash
OPENAI_API_KEY=sk-...          # optional; demo falls back without it
ZEROPS_DEMO_PAT=...            # required for "Deploy for real"; set as a SECRET env var
ZEROPS_ORG_ID=...              # optional; only needed if the PAT sees several orgs
DEMO_REAL_DEPLOY=1             # set 0 to kill-switch real deploys
DEMO_MAX_PROJECTS=10
DEMO_SHARED_URL=               # optional; leave EMPTY unless a real shared stack exists.
                               # Never point this at a URL that does not resolve.
```

LLM helpers live under `src/server/llm/` (patterns from Dyad write tags + open-lovable intent mapping).

Shared tokens: `design/system.css`

## `/demo` theme exception

`/demo` is the only route that loads a second token layer, `design/voltage.css`, after
`design/system.css`. It is a deliberate exception, not drift:

- **Why.** `/demo` is the judge-facing surface and has to sell as well as work. It runs
  Inter + JetBrains Mono on a `#101010` canvas with one electric-green accent (`#00d992`),
  8 px cards and 6 px buttons — a marketing register the product chrome doesn't need.
- **How it's contained.** `voltage.css` only re-declares `:root` custom properties plus
  `v-*` component classes. Equal specificity and later source order let it win, so every
  `.zo-*` primitive upgrades without edits. **Do not link it from `studio.html`,
  `landing.html`, or `login.html`** — `design/system.css` (mirrored hex-for-hex in
  `web/src/index.css` for the React landing at `/`) remains the law for those routes.
- **Green means two things, separated by treatment.** Solid green **fill** = primary
  action, max one or two per view. Green **hairline border + green dot + green host text**
  = healthy. Rule 3 above still holds: a healthy container and the Scaffold button must
  never read as the same object. Building stays amber, failed stays red.
- **Structure.** Two stages on one page — a prompt-first hero, and a workbench revealed on
  first run that renders the artifacts `/api/demo/scaffold` returns (`importYaml`,
  `codeFiles`, `matchedKeywords`, `templateName`). Showing the generated manifest is the
  point; it's what proves the deploy is real.

## What `/demo` actually deploys

One template, `starter-node-postgres`, living in **`src/demo-templates/`** — deliberately
*not* in `src/templates/`, which is the Studio library behind `/api/templates` where every
entry is contractually a 5-container stack (`tests/challenger_m3_empirical.test.ts` asserts
`services.length === 5`).

Two services: `webapp` (nodejs@22, public subdomain) and `db` (postgresql@16, private).
The prompt shapes the app's *content*, never its topology — the LLM may write exactly one
file, `webapp/app.config.json`, and malformed JSON is discarded rather than deployed.

`POST /api/demo/deploy` streams **NDJSON** (`{type: log|stage|scaffold|done|error}`) because
a genuine import plus build takes minutes. Guard failures (no PAT, quota full, kill-switch)
still answer with ordinary JSON, so the client branches on `Content-Type`.

Three rules learned the hard way, all enforced in the template:

| Rule | Why |
|------|-----|
| `services:` top level, keyed by `hostname:` | Nested `project.services` with `name:` is rejected by `zcli project project-import` |
| `httpSupport: true`, never `http: true` | Wrong key leaves the port with no public HTTP handler |
| Import alone deploys nothing | `project-import` only creates empty slots; `zcli push` is what ships code |

The live URL is **read back** from `PROJECT_zeropsSubdomainString` (via `zcli project env`)
and polled until it answers. Never construct a URL from the project name — Zerops assigns
`{hostname}-{subdomainHost}-{port}.{region}.zerops.app` and `subdomainHost` is unknowable
in advance. The old hardcoded `https://zeroops-demo.zerops.app` did not resolve.

## Demo contracts (JS ↔ DOM)

`demo.js` binds to these in `demo.html`; renaming any of them breaks the page silently:

- IDs: `demo-prompt`, `plan-box`, `plan-card`, `error-box`, `log-box`, `quota-line`,
  `canvas-mode`, `success-box`, `success-title`, `live-link`, `live-hosts`, `workbench`,
  `template-pill`, `understood-pill`, `llm-pill`, `files-box`, `files-list`, `files-count`,
  `yaml-box`, `yaml-code`, `btn-copy-yaml`, `btn-scaffold`, `btn-simulate`, `btn-deploy`
- Nodes: `node-webapp` and `node-db`, each wrapped in a `.topo-node`. The chip id is
  `'node-' + topology[].id` from `scaffold.js` — the two must move together.
- Classes: `.template-card[data-prompt]` toggling `.is-selected` (example prompts, **not**
  templates — there is only one); `.topo-chip` + `.topo-chip__ip`

`setChip()` swaps only the status class via `classList`, so layout classes on a chip are
safe — but chip geometry still belongs on the `.topo-node` wrapper.

## Archived

`preview/v1…v4` and old Linear/Vercel clone variants are **not** the product. Ignore for judging.

## Studio contracts (tests)

Keep in `studio.html` / `studio.css` / `studio.js`:

- IDs: `chat-feed`, `prompt-bar`, `wb-terminal`, `wb-yaml`, `wb-code`, `code-sidebar`, `code-file-list`, `code-active-filename`, `code-active-content`
- Nodes: `node-web-frontend` … `node-cache-valkey`, class `topo-arrow`
- CSS: `@keyframes packet-flow`, `.topo-chip.building|deploying|healthy|failed`
- JS: `/ws/logs`, alias map, `history` frames
