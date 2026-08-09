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
| `/login` | Session auth |
| `/studio` | Factory floor (real zcli stream) |

Shared tokens: `design/system.css`

## Archived

`preview/v1…v4` and old Linear/Vercel clone variants are **not** the product. Ignore for judging.

## Studio contracts (tests)

Keep in `studio.html` / `studio.css` / `studio.js`:

- IDs: `chat-feed`, `prompt-bar`, `wb-terminal`, `wb-yaml`, `wb-code`, `code-sidebar`, `code-file-list`, `code-active-filename`, `code-active-content`
- Nodes: `node-web-frontend` … `node-cache-valkey`, class `topo-arrow`
- CSS: `@keyframes packet-flow`, `.topo-chip.building|deploying|healthy|failed`
- JS: `/ws/logs`, alias map, `history` frames
