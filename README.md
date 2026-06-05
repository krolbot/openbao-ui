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

Run OpenBao (or the bundled mock) and the UI separately:

```bash
# 1. Backend (one terminal) — real OpenBao …
bao server -dev -dev-root-token-id=root        # listens on :8200
#    … or the dependency-free mock (in-memory KV v2, no install needed):
pnpm mock:bao                                   # listens on :8200, token: root

# 2. UI (another terminal)
pnpm install
pnpm dev                                        # http://localhost:3000
```

Open <http://localhost:3000> → you'll be redirected to `/ui/login`. Sign in with
the **Token** method using `root`. The Overview page shows live seal status, your
token's policies, and the enabled secret engines; **Secrets** lets you browse KV
engines, create/edit secrets, view version history, and roll back — all fetched
through the proxy, proving the frontend ↔ backend wiring end to end.

Config via env (see `.env.example`): `OPENBAO_ADDR`, `BAO_COOKIE_NAME`.

### Architecture detail: client data flow

Interactive pages use **TanStack Query** against an **authenticated BFF proxy**
(`/ui/api/bao/<path>`). The proxy injects the httpOnly token and the
`X-Vault-Namespace` header server-side, so the token is never exposed to client
JS while the UI still gets live, cacheable reads/writes.

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
  instance starts **sealed/uninitialized** — the UI detects this at `/ui/login`
  and walks you through the built-in **initialize → save keys → unseal** flow.
  Mount a volume at `/bao/file` to persist storage.

## coss ui

Components live in `components/ui/*`. The coss registry is configured in
`components.json` (`@coss`), so real coss/Base-UI components can be pulled in via
the shadcn CLI as the UI grows:

```bash
npx shadcn@latest add @coss/<component>
```

## Features

A full management UI, not just a viewer — everything below is implemented and
talks to OpenBao live through the proxy:

**Secrets**
- KV **v2 and v1** — browse, create, and edit, with **version history,
  one-click rollback**, and soft-delete / destroy
- **Environments** — friendly names, colors, and shareable **env groups** layered
  on your KV mounts; create or disable an environment right from the UI
- **Compare** a secret path across environments side by side
- Dashboards for **Transit, PKI, SSH, Database, and Cubbyhole**

**Access**
- **Team** — members (identity entities), role templates, and **scoped access
  roles**: grant an env group + app at a chosen level with a **live preview of the
  exact policy**, materialized as a real OpenBao policy + identity group
- **Auth methods** — enable/configure userpass, LDAP, AppRole, and a guided
  **Google (OIDC) sign-in wizard**
- **Identity** (entities & groups), **policies & capabilities**, **tokens**,
  **leases**, and **MFA**

**Operations**
- Seal status / health, **quotas**, **plugins**, and an **audit log** viewer
- Built-in **initialize → save keys → unseal** bootstrap flow for fresh instances

**Settings**
- Login customization / branding, server config, password policies, preferences,
  and **multi-namespace** switching

Plus a command palette, dark mode, copy-paste **integration guides** for your
app, and a first-run onboarding checklist.

> Early but real, and actively developed. Feedback, issues, and PRs are very
> welcome.
