# Design: approval workflows (change & access requests)

Status: **proposed / not yet implemented.** This scopes the largest remaining
differentiator from the roadmap (Phase 7). It is deliberately a design doc, not
code, because it introduces a **stateful, multi-user control plane** — a
significant architectural change that should be agreed before building.

## Problem

Infisical offers PR-style **change requests** (edits to protected paths need
N approvals before they apply) and **access requests** (time-boxed elevated
access with sign-off). OpenBao has neither: its API is stateless and applies
writes immediately, authorized only by the caller's token/policies.

To add approvals we need somewhere to **hold a pending change**, record
**who approved**, and **apply it on merge** — i.e. state OpenBao doesn't keep.

## Goals / non-goals

- **Goals:** propose a KV change without applying it; require N-of-M approval;
  merge (apply) or reject; an audit trail; time-boxed access requests.
- **Non-goals (v1):** approvals for every engine (start with KV v2 writes/deletes);
  replacing OpenBao policies (approvals are *additive* gating, not authz).

## Why it needs a control plane

OpenBao can't store "a proposed-but-not-applied secret + votes". So we add a
small **stateful service** with a datastore. Two shapes:

1. **Extend the BFF** (this Next.js app) with stateful route handlers + an
   embedded DB. Simplest for the single-image story.
2. **Separate sidecar service** the BFF calls. Cleaner separation / scaling,
   more moving parts.

Recommendation: **(1) for v1** — add a datastore to the existing BFF; revisit a
sidecar if HA/scale demands it.

### Storage
- **SQLite** (e.g. `better-sqlite3`) on a mounted volume — fits the single-image
  ethos; fine for a single replica.
- **Postgres** when running multiple replicas / HA. Keep the data layer behind a
  small interface so the backend is swappable.

## Data model (v1)

```
ChangeRequest {
  id, namespace, mount, path, operation (create|update|delete),
  proposed_data (json, null for delete), cas (int|null),
  author (entity id / oidc sub), justification,
  status (open|approved|rejected|merged|closed),
  approvals [{ approver, decision (approve|reject), at }],
  required_approvals (int), created_at, updated_at
}

AccessRequest {
  id, requester, namespace, path, capabilities[], ttl,
  justification, status (open|approved|rejected|expired),
  approvals[...], granted_token_accessor (nullable), created_at
}

ProtectedPath { namespace, mount, path_glob, required_approvals, reviewers[] }
```

## Flows

**Change request**
1. On a path matched by a `ProtectedPath`, the UI replaces direct "Save" with
   **"Propose change"** → stores a `ChangeRequest` (status `open`). Nothing is
   written to OpenBao yet.
2. Reviewers see it in **Access → Requests** (Pending tab) and Approve/Reject.
   When approvals ≥ `required_approvals` → status `approved`.
3. **Merge** applies the change to OpenBao. Crucially, the apply uses the
   **merger's own token** (or the approvers'), so OpenBao policy still enforces
   that whoever merges is allowed to write — no ambient super-token.
4. Record the merge in the audit trail; mark `merged`.

**Access request**
1. Requester picks path + capabilities + duration + justification.
2. On approval, mint a **short-lived token** (`auth/token/create` with a policy
   scoped to the requested path/caps and `ttl`=duration) and hand it to the
   requester; store the accessor for later revocation/expiry.

## Identity & auth

Approvals require **stable user identities** (you can't approve as "root").
- Use **OIDC** (already wired for login) as the identity source; the `sub` /
  entity id is the actor on requests/approvals.
- `reviewers` reference OpenBao **identity entities/groups** so the existing
  Identity UI manages them.

## Security considerations

- **No standing privilege:** never apply approved changes with an ambient admin
  token. Apply with the actor's token at merge time so OpenBao authz holds.
- **Self-approval:** configurable; default off (author can't approve own request).
- **Break-glass:** an explicit, audited bypass that notifies all reviewers.
- The pending `proposed_data` is sensitive — encrypt at rest (e.g. via the
  Transit engine!) so the approvals DB never stores plaintext secrets.
- All request/approval actions go through the same CSRF-protected BFF.

## UI surface (reuses existing patterns)

- **Access → Requests**: Pending / Closed tabs (table → detail), reusing the
  list+detail and typed-confirm patterns.
- **Protected paths** settings (which globs require approval + reviewer sets).
- **Inline**: when editing a protected KV secret, the editor's primary action
  becomes "Propose change" with a diff preview.

## Phased plan

- **A — Change requests for KV:** datastore + propose/list/approve/reject/merge,
  ProtectedPath config, Requests UI, merge-with-actor-token. Encrypt
  `proposed_data` via Transit.
- **B — Access requests:** scoped-policy + short-lived token minting, expiry.
- **C — Polish:** notifications (Slack/email/webhook), break-glass, multi-step
  sequential approvals.

## Open decisions (need product input)

1. Storage: SQLite (single image) vs Postgres (HA) for v1?
2. Identity: require OIDC, or also support a local user table?
3. Merge authz: actor's token (recommended) vs a constrained service token?
4. Scope of v1: KV-only, or include policy/auth-method changes too?

Until these are decided and built, the UI applies changes directly (today's
behavior); this document is the agreed starting point for the feature.
