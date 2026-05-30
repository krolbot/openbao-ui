# OpenBao UI

A modern, simple UI for [OpenBao](https://openbao.org) — Infisical-style UX,
built with **Next.js**, **Tailwind CSS**, and **[coss ui](https://coss.com/ui/docs)**
(copy-paste components on Base UI). The UI and OpenBao ship in a **single Docker
image**.

## Architecture

Next.js is the single front door (a BFF), and OpenBao runs alongside it inside
the same image, reachable only on loopback:

```
                 ┌───────────────────────── single Docker image ─────────────────────────┐
   browser  ───► │  Next.js (:3000)                                                         │
                 │   ├── /ui/*       → React pages (coss ui)                                 │
                 │   ├── /ui/api/*   → BFF route handlers (auth, session)                    │
                 │   └── /v1/*       → rewrite/proxy ─────────►  OpenBao (127.0.0.1:8200)    │
                 └──────────────────────────────────────────────────────────────────────────┘
```

- **`/ui/*`** — application pages (served under `basePath: /ui`).
- **`/ui/api/*`** — custom API routes. Login validates credentials against
  OpenBao server-side and stores the token in an **httpOnly cookie** — it never
  reaches client JS.
- **`/v1/*`** — transparently proxied to the embedded OpenBao
  (`next.config.ts` → `rewrites()`).

Only port **3000** is exposed; OpenBao stays internal.

## Local development

Run OpenBao in dev mode and the UI separately:

```bash
# 1. OpenBao (in one terminal)
bao server -dev -dev-root-token-id=root        # listens on :8200

# 2. UI (in another terminal)
pnpm install
pnpm dev                                        # http://localhost:3000
```

Open <http://localhost:3000> → you'll be redirected to `/ui/login`. Sign in with
the **Token** method using `root`. The Overview page then shows live seal status,
your token's policies, and the enabled secret engines — all fetched through the
proxy, proving the frontend ↔ backend wiring end to end.

Config via env (see `.env.example`): `OPENBAO_ADDR`, `BAO_COOKIE_NAME`.

## Single image (UI + OpenBao)

```bash
docker build -t openbao-ui .
docker run --rm -p 3000:3000 -e BAO_DEV=1 -e BAO_DEV_ROOT_TOKEN_ID=root openbao-ui
# or:
docker compose up --build
```

Then visit <http://localhost:3000> and log in with token `root`.

- **Dev mode** (`BAO_DEV=1`, default): in-memory, auto-unsealed, fixed root
  token — great for trying it out, **not** for production.
- **Non-dev** (`BAO_DEV=0`): boots from `docker/openbao.hcl` (file storage). The
  instance starts **sealed/uninitialized** — initialize and unseal it via the
  API/CLI, and mount a volume at `/bao/file`, before the UI is usable.

## coss ui

Components live in `components/ui/*`. The coss registry is configured in
`components.json` (`@coss`), so real coss/Base-UI components can be pulled in via
the shadcn CLI as the UI grows:

```bash
npx shadcn@latest add @coss/<component>
```

## Status

This is the **infra/skeleton**. Implemented: project scaffold, coss ui wiring,
single-image Docker setup, and a working login + Overview dashboard. Secret CRUD
(KV v2), policy/auth-method management, and multi-namespace support come next.
