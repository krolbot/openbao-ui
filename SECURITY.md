# Security model

This UI is a thin BFF in front of OpenBao. It holds no secrets itself; OpenBao
remains the source of truth and the enforcement point for every operation.

## Token handling
- The OpenBao token is stored in an **httpOnly** cookie (`bao_token`), so it is
  never readable by client-side JavaScript (mitigates token theft via XSS).
- The cookie is `SameSite=lax`, `secure` in production, `path=/`.
- All authenticated calls go through the BFF proxy (`/ui2/api/bao/*`), which
  injects the token server-side. The browser never sends the token directly.

## Authorization
- OpenBao enforces all authz. The BFF proxy is **no more privileged than the
  user's own token** — it simply forwards the user's token.
- The UI is capability-aware (`sys/internal/ui/resultant-acl`) for affordances
  only; it is not a security boundary. A limited token cannot perform actions
  the API would reject regardless of what the UI shows.

## CSRF
- `SameSite=lax` already blocks the session cookie on cross-site POST/fetch.
- Defense-in-depth: state-changing BFF routes (`/ui2/api/auth/*`, non-GET
  `/ui2/api/bao/*`) reject cross-site requests via an Origin / `Sec-Fetch-Site`
  same-origin check (`lib/csrf.ts`). Non-browser clients (no ambient cookie) are
  not a CSRF vector and are allowed.

## Proxy hardening
- The proxy is strictly scoped under `/v1/`; path segments of `.`/`..` are
  rejected so a crafted path cannot escape the prefix.
- Only `X-Vault-Token`, `X-Vault-Namespace`, and `Content-Type` are forwarded
  upstream — arbitrary client headers are not proxied.
- The unauthenticated `/v1/*` rewrite is a plain reverse proxy (used for
  `sys/seal-status`, `sys/init`, `sys/unseal`); OpenBao enforces auth on every
  other path, so this exposes nothing beyond OpenBao's own API surface.

## Response headers
Set globally (`next.config.ts`): `X-Frame-Options: DENY` +
`Content-Security-Policy: frame-ancestors 'none'` (anti-clickjacking),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.

## OIDC
- The OIDC login uses a server-generated `client_nonce` (httpOnly cookie) and
  the provider-returned `state`; the callback validates both. The provider must
  allow-list this app's callback URL.

## Deployment notes
- Run behind TLS. In the single image OpenBao listens only on loopback; the
  Next.js server is the sole exposed port.
- Dev mode (`BAO_DEV=1`) uses a fixed root token and in-memory storage — never
  use it in production.
