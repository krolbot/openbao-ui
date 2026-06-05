# Plan: Settings section

The sidebar's **Settings** entry is the last placeholder. This plans what it
should contain — grounded in the OpenBao endpoints I verified against a live
instance — and how to build it, reusing existing patterns (tabbed section like
Access/Operations, capability-aware nav, Disclosure, typed-confirm, toasts).

## What belongs in Settings (discovered)

| Area | Source / endpoint | Verified |
|---|---|---|
| **Profile** (current token) | `GET auth/token/lookup-self` → accessor, display_name, policies, entity_id, ttl, expire_time, meta, path | ✅ rich data |
| **Preferences** (UI, client-side) | localStorage / cookies — theme, default namespace, pinned mounts | n/a (client) |
| **Namespaces** | `LIST/GET/POST/DELETE sys/namespaces[/:path]` (open-source in OpenBao) | ✅ create→200, list→key_info |
| **Server info** | `GET sys/config/state/sanitized` → version, cluster, storage, listeners, lease TTLs, HA | ✅ full config |
| **CORS** | `GET/POST/DELETE sys/config/cors` → enabled, allowed_origins, allowed_headers | ✅ editable |
| **About** | app version + `sys/seal-status` (OpenBao version), brand, links | ✅ |

Probed but **not available** in this build (skip): `sys/config/ui/custom-messages`
→ 404 "unsupported path". (Global quota config `sys/quotas/config` exists but is
better kept alongside the rate-limit quotas already under Operations.)

## Proposed layout — `/ui/settings` with tabs

1. **Profile** — the signed-in token at a glance: display name, policies
   (badges), accessor (copy), entity id, issue/expire time + TTL, orphan flag,
   metadata. Actions: **Renew** (if renewable, reuses `/ui/api/auth/renew`),
   **Sign out**. Mostly read; lead with name + policies, raw fields behind a
   Disclosure.
2. **Preferences** (client-side, no API) — **Theme** (Light / Dark / System;
   extends the current 2-way toggle), **Default namespace**, **Pinned mounts**
   (used by the switcher / command palette), and **Reset local preferences**.
   Persisted in localStorage; the namespace switcher reads the default.
3. **Namespaces** — list (with `key_info` metadata), **create** (path +
   optional custom_metadata), **delete** (typed-confirm; 🔴 wipes everything in
   it). Complements the namespace *switcher* (which only switches). Gated on
   `can("sys/namespaces")`.
4. **Server** — read-only **sanitized config** (version, cluster name, storage
   type, listeners, default/max lease TTL, HA/clustering) rendered as a labeled
   table; plus an editable **CORS** card (enable, allowed origins, allowed
   headers). Gated on `can("sys/config/state/sanitized")` / `can("sys/config/cors")`.
5. **About** — OpenBao version (from seal-status) + app version, the brand logo,
   and links (openbao.org docs, the repo, SECURITY.md).

## Implementation

- `app/(app)/settings/layout.tsx` — tabbed shell (copy of the Access/Operations
  layout), capability-aware tab list.
- Pages: `settings/page.tsx` (Profile), `preferences/`, `namespaces/`,
  `server/`, `about/`.
- `lib/settings.ts` hooks: `useTokenSelf` (BFF `auth/token/lookup-self`),
  `useNamespaces`/`useCreateNamespace`/`useDeleteNamespace`,
  `useSanitizedConfig`, `useCorsConfig`/`useSetCorsConfig`. All via the existing
  `baoFetch` BFF proxy with `meta.success`/`meta.silentError` for toasts.
- **Reuse**: `useCan` (gating), `Disclosure`, `ConfirmDialog`, `CopyButton`,
  `useTheme` (extend to 3-way), `useNamespace`, `Logo`.
- **Theme 3-way**: extend `components/theme.tsx` to support `system` (matchMedia
  listener) alongside light/dark; the header toggle stays, the explicit choice
  lives in Preferences.
- Enable the **Settings** nav item (remove `disabled`); add Settings entries to
  the ⌘K command palette.

## Verification

- Profile: log in, confirm token fields render; Renew updates TTL.
- Namespaces: create `team-a` → appears in list and in the switcher; delete it.
- Server: sanitized config renders; toggle CORS on with an origin → reads back.
- Preferences: theme persists across reload; default namespace applied.
- Extend the Playwright smoke suite with a Settings tab check; build + lint.

## Open question

- **Theme scope**: 3-way (Light/Dark/System) in Preferences, or keep the simple
  toggle only? (Plan assumes 3-way.)

## Phasing (suggested)

Small enough to do in one pass, but if split: **(A)** Profile + About + enable
nav; **(B)** Namespaces management; **(C)** Server/CORS + Preferences (3-way theme).

## Implemented so far

- Profile, Preferences, Namespaces, Server (+ CORS), About (initial pass).
- **Preferences engine** (`lib/preferences.tsx`) wired into the app: reveal-secrets
  by default, default editor (KV/raw JSON), toast duration, audit-refresh interval.
- **Password Policies** tab (`sys/policies/password`) — CRUD + generate preview.
- **Logging** card on the Server tab (`sys/loggers`) — runtime log level.

## Discovered backlog (from deep API/UX research — ranked, OpenBao-OSS only)

High-value, dev-verifiable additions still open:
1. **Mount tuning** (`sys/mounts/:path/tune`) — per-engine description, lease TTLs,
   listing visibility, audit-non-hmac keys, and per-auth `user_lockout_config`.
2. **Locked users** dashboard + unlock (`sys/locked-users`).
3. **Quota config** (`sys/quotas/config`) — rate-limit response headers / audit
   logging / exempt paths (complements the rate-limit quotas under Operations).
4. **UI custom headers** (`sys/config/ui/headers`) — complements CORS.
5. **OIDC provider** (act as IdP) (`identity/oidc/*`) — providers/keys/clients/scopes.
6. **Tools** utility belt (`sys/tools/random`, `sys/tools/hash`, `sys/wrapping/*`).
7. **Key-rotation config** (`sys/rotate/keyring/config`) + `sys/key-status`, and Raft
   autopilot config/state (`sys/storage/raft/autopilot/*`, raft-only).

Explicitly out of scope (not in OpenBao OSS): replication, control groups,
Sentinel RGP/EGP, client-count config, UI custom *messages*, namespace api-lock,
plugin container runtimes.

More client-side preferences worth adding later: TTL-warning threshold,
typed-confirm strictness for all deletes, table density, date/time format,
pinned/favorite mounts in ⌘K, reduce-motion.
