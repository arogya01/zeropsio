# ZeroOps Web (React + Vite + Tailwind)

Separate UI for ZeroOps Studio. Talks to the Express API / WebSocket in the parent package.

## Stack

- React 19
- Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Router 7

## Dev

Terminal 1 — API:

```bash
cd .. && npm run dev
# http://localhost:3000
```

Terminal 2 — UI (proxies `/api` + `/ws` → :3000):

```bash
npm run dev
# http://localhost:5173
```

## Build

From engine root:

```bash
npm run build:web
```

Express serves `web/dist` automatically when `index.html` is present.

## Routes

| Path | Page |
|------|------|
| `/` | Landing |
| `/login` | Auth |
| `/studio` | Workbench |
