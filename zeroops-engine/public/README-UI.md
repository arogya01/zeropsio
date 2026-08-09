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
ZEROPS_DEMO_PAT=...            # optional; enables "Deploy for real"
DEMO_REAL_DEPLOY=1             # set 0 to kill-switch real deploys
DEMO_MAX_PROJECTS=10
DEMO_SHARED_URL=https://zeroops-demo.zerops.app
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
  `codeFiles`, `confidence`, `templateName`). Showing the generated manifest is the point;
  it's what proves the deploy is real.

## Demo contracts (JS ↔ DOM)

`demo.js` binds to these in `demo.html`; renaming any of them breaks the page silently:

- IDs: `demo-prompt`, `plan-box`, `plan-card`, `error-box`, `log-box`, `quota-line`,
  `canvas-mode`, `success-box`, `live-link`, `live-hosts`, `workbench`, `template-pill`,
  `confidence-pill`, `llm-pill`, `files-box`, `files-list`, `files-count`, `yaml-box`,
  `yaml-code`, `btn-copy-yaml`, `btn-scaffold`, `btn-simulate`, `btn-deploy`
- Nodes: `node-web-frontend` … `node-cache-valkey`, each wrapped in a `.topo-node`
- Classes: `.template-card[data-id]` toggling `.is-selected`; `.topo-chip` + `.topo-chip__ip`

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
