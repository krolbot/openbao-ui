# OpenBao UI — Product Roadmap

A modern, simple web UI for [OpenBao](https://openbao.org) with **Infisical-grade
UX** (clean, fast, progressive disclosure) that **mirrors OpenBao's own
primitives** — namespaces, mounts/engines, paths, policies — rather than
inventing a separate workspace/environment abstraction.

> Status: planning doc. Phase 0 (infra + login + status) is implemented; see
> `README.md`. Everything below is the agreed direction, sequenced into phases.

---

## 1. Design principles

1. **Mirror the primitives, polish the experience.** Surface real OpenBao
   objects (namespace, mount, path, policy, role, lease) with friendly naming
   and great affordances — no hidden "magic" model that users must reverse-engineer.
2. **Per-engine, purpose-built dashboards** (Infisical's biggest UX win) instead
   of one generic key/tree browser. KV, Transit, PKI, SSH, Database each get a
   screen tuned to their workflow.
3. **Scope is always obvious via "switchers"** (see §2). The user can tell at a
   glance: which **namespace**, which **engine/mount**, which **path** they're in.
4. **Capability-aware UI.** Hide/disable what the token can't do using
   `sys/internal/ui/resultant-acl` and `sys/capabilities-self`. Never show a
   button that will 403.
5. **Guardrails on destructive actions.** Every 🔴 operation (seal, rekey,
   rotate, revoke, destroy, delete, raft restore…) gets a typed-confirm modal.
6. **OpenAPI as source of truth.** `sys/internal/specs/openapi` is version-accurate
   for the target build; use it to generate types and drive config forms.

---

## 2. Information architecture & "switchers"

We mirror primitives, so the navigation is built around three nested scope
selectors. Getting *where each switcher lives* right is the core UX job.

```
┌ Namespace ▾ ────────────────────────────── (global, top-left; X-Vault-Namespace)
│
├─ Overview                 system status / health
├─ Secrets        ── Engine ▾ (mount switcher) ── /path/breadcrumbs ──
│     KV · Transit · PKI · SSH · Databases · LDAP · K8s · TOTP …
├─ Access
│     Auth methods · Identity · Policies · Tokens & Leases
└─ Operations
      Seal/Unseal · Rekey/Rotate · Raft · Audit · Quotas · Plugins · Config
```

**The three switchers**

| Switcher | Where it lives | Scope it sets | Backed by |
|---|---|---|---|
| **Namespace** | Global, top-left of the app shell (like an org switcher). Persists across the whole UI; sets `X-Vault-Namespace` on every call. | Tenant / isolation boundary (own mounts, policies, identities, tokens). | `sys/namespaces`, `sys/internal/ui/namespaces` |
| **Engine / mount** | Within a section (e.g. a left rail or header dropdown inside *Secrets* / *Auth methods*). | Which mounted engine you're operating on. | `sys/internal/ui/mounts`, `sys/mounts`, `sys/auth` |
| **Path / breadcrumbs** | In-page breadcrumb + tree inside a KV engine. | Folder location within the engine. | KV `metadata/` LIST |

**Helpful conveniences** (config we expose so it "just works" for users):
- Per-user **default namespace** and **favorite/pinned mounts** (stored client-side).
- A **⌘K command palette** to jump to any namespace / engine / path / action.
- Namespace + engine context shown in the breadcrumb so deep links are unambiguous.

> Mapping note for Infisical refugees: **Namespace ≈ Org/Project scope**,
> **mount ≈ a typed project**, **KV path ≈ folders**. OpenBao has no native
> "environment"; teams typically model environments as **namespaces or separate
> mounts**, so our namespace/mount switchers already cover it. (An opinionated
> cross-environment **comparison matrix** is deferred — see §6 Phase 7.)

---

## 3. Feature domains

Each domain lists **coverage** (primary `/v1/` paths), the **UX** approach, and
**implementation** notes. 🔴 = destructive (needs confirm modal), 🟢 = read-only.

### A. Foundation / app shell  *(Phase 1; extends Phase 0)*
- **Coverage:** all login methods — `auth/userpass`, `approle`, `ldap`,
  `jwt/oidc`, `kubernetes`, `cert`, `radius`, `kerberos`, plus token; namespace
  switcher; session/token bar (`auth/token/lookup-self`, `renew-self`, logout 🔴).
- **UX:** login with method tabs; OIDC redirect/callback (or poll) flow; TTL
  countdown; capability-aware nav; ⌘K palette; dark mode; toasts; empty-state onboarding.
- **Impl:** one BFF route handler per login method; namespace header injected by
  the proxy/BFF; TanStack Query for cache + invalidation; httpOnly token cookie.

### B. KV secrets — the hero  *(Phase 2 — build deep first)*
- **Coverage:** KV v2 (`:mount/data`, `metadata`, `subkeys`, `delete`/`undelete`/`destroy` 🔴,
  CAS), KV v1, Cubbyhole (`cubbyhole/`).
- **UX:** path/folder tree + breadcrumbs; **masked values w/ show-hide**; **inline
  edit**; per-secret **version sidebar with diff + rollback** (KV v2 stores
  versions natively); **tags/comments via `custom_metadata`**; search; copy;
  `.env` import/export; **one-time secret share → response-wrapping** (`sys/wrapping/wrap`).
- **Impl:** dynamic routes `/ui/secrets/[mount]/[...path]`; CodeMirror JSON editor;
  client-side version diff; soft-delete vs destroy clearly distinguished.

### C. Other secrets engines (typed dashboards)  *(Phase 5)*
- **Transit (KMS):** keys list/create/`rotate` 🔴; encrypt/decrypt/sign/verify/datakey
  **modals**; guarded `export`/`backup` 🔴. (`transit/keys`, `transit/encrypt|decrypt|sign|verify`)
- **PKI:** issuers/CAs, roles, `issue`/`sign`, cert list, `revoke` 🔴, CRL, ACME
  config, `tidy`. (`pki/issuers`, `pki/roles`, `pki/issue/:role`, `pki/certs`)
- **SSH:** CA config, roles, `sign`/`issue`, public key. (`ssh/config/ca`, `ssh/sign/:role`)
- **Database / LDAP / K8s / TOTP / RabbitMQ:** connections, dynamic + static
  roles, generate creds, `rotate-root`/`rotate-role` 🔴 — lease-backed.
- **UX:** engine **enable/mount wizard** (`sys/mounts`) with per-type config forms
  (schema-driven from OpenAPI where possible); consistent "configure → use" flow.

### D. Access — auth methods  *(Phase 4)*
- **Coverage:** `sys/auth` enable/disable 🔴/tune + per-method config (userpass
  users, approle role + role-id/secret-id, ldap, oidc roles, k8s, cert, radius).
- **UX:** Infisical's **3-step wizard** (create role → configure auth → issue
  token/secret-id) as the template for OpenBao's CLI-heavy setup.

### E. Access — identity & MFA  *(Phase 4)*
- **Coverage:** entities, entity-aliases, groups (internal/external), group-aliases,
  membership, `merge` 🔴, lookup; **Login MFA** (TOTP/Duo/Okta/PingID —
  open-source in OpenBao) via `identity/mfa/...` + login-enforcement; OIDC provider
  (act as IdP) later.

### F. Access — policies & authz  *(Phase 3)*
- **Coverage:** ACL policies (`sys/policies/acl`), password policies, capabilities
  tester (`sys/capabilities`), resultant-ACL viewer.
- **UX:** HCL editor (CodeMirror, syntax + validate); "what can token X do on
  path Y?" tester.

### G. Access — tokens & leases  *(Phase 3)*
- **Coverage:** token roles, create/lookup-by-accessor/`revoke` 🔴; **lease
  browser** — `sys/leases/lookup`, `renew`, `revoke`/`revoke-prefix`/`revoke-force` 🔴, count.

### H. Operations / admin  *(Phase 6)*
- **Coverage:** status dashboard (`sys/health`, `seal-status`, `leader`,
  `ha-status`, raft `configuration` + `autopilot/state`, `version-history`,
  `host-info`, `metrics`, activity counters) 🟢; **first-run init wizard** +
  seal/unseal + `step-down` 🔴; rekey/rotate/generate-root multi-step 🔴; audit
  devices + (with a log store) a **filterable audit-log table**; raft snapshots
  (download / `restore` 🔴) + peers; quotas (rate-limit, lease-count); plugin
  catalog; CORS/UI config; locked users.

### I. Cross-cutting
- Typed-confirm modals for all 🔴 ops; capability gating everywhere; consistent
  error surfacing of OpenBao `errors[]`; toasts; keyboard nav; dark mode;
  tools (`sys/tools/random|hash`), wrapped-token utility.

---

## 4. OpenBao ≠ Vault — things we rely on / skip

- ✅ **Namespaces are open-source** in OpenBao → first-class namespace switcher.
- ✅ **Login/Identity MFA is open-source** (TOTP/Duo/Okta/PingID).
- ❌ Not present (don't build UI for): Control Groups, Sentinel EGP/RGP, DR/Perf
  replication, Transform/FPE, KMIP secrets engine, KMS secrets engine, cloud-IAM
  auth methods (AWS/Azure/GCP/…). DB plugin set is smaller (e.g. **Valkey** not Redis).

---

## 5. Implementation approach

- **Architecture:** Next.js App Router as a BFF (already established). httpOnly
  token cookie; namespace propagated via header in the proxy/BFF; `/v1/*` proxied
  to OpenBao; `/ui/api/*` for aggregation/custom flows (e.g. OIDC callback).
- **Data:** TanStack Query (cache, optimistic updates, invalidation per mount/path).
- **Forms:** react-hook-form + zod; schema-driven engine/auth config forms from
  `sys/internal/specs/openapi` where feasible.
- **UI kit:** coss ui (Base UI + Tailwind) for tables, dialogs, tabs, command
  palette; CodeMirror for HCL/JSON editing.
- **Routing:** route groups per domain; dynamic per-mount routes
  (`/ui/secrets/[mount]/[...path]`, `/ui/access/auth/[mount]`, …).
- **Types:** generate a typed OpenBao client from OpenAPI to keep paths/params accurate.

---

## 6. Phased plan

| Phase | Theme | Domains | Notable deliverables |
|---|---|---|---|
| **0** ✅ | Infra + login + status | — | Next.js BFF, single image, token/userpass login, Overview |
| **1** | Foundation depth | A | Namespace switcher, all login methods + OIDC, capability-aware nav, ⌘K, dark mode, token/session bar |
| **2** | **KV hero** | B | Full KV v2 browse/CRUD, versions + diff + rollback, masked values, metadata tags, secret-share (wrapping), cubbyhole |
| **3** | Authz core | F, G | ACL HCL editor, capabilities tester, token roles, lease browser |
| **4** | Access mgmt | D, E | Auth-method enable/config wizards, identity entities/groups, MFA |
| **5** | Engines | C | Transit → PKI → SSH → Database dashboards + mount wizard |
| **6** | Operations | H | Init/seal/unseal, rekey/rotate, raft + snapshots, audit devices + log viewer, quotas, plugins |
| **7** | Differentiators | — | Cross-env **comparison matrix**, audit-log store/streaming, secret-sync/integrations, PR-style change & access requests |

---

## 7. Deferred / open questions

- **Comparison matrix** (cross-namespace/mount side-by-side) — deferred to Phase 7;
  revisit once core KV CRUD is solid.
- **Approval workflows** (PR-style change requests, multi-step access requests) —
  high differentiation but require a control-plane layer above OpenBao's stateless
  model; Phase 7+.
- **Audit log viewer** depends on adding a queryable log store behind audit devices.
- Whether to ship an **OpenAPI-generated client** from day one or hand-write typed
  wrappers initially (lean toward generated early to stay version-accurate).
