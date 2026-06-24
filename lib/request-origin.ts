import type { NextRequest } from "next/server";

/**
 * Optional hard override for the app's public origin, e.g.
 * `OPENBAO_UI_PUBLIC_URL=https://bao.example.com`. Set this when the app sits
 * behind a proxy/load balancer that doesn't pass Host / X-Forwarded-* reliably,
 * or whenever you want one fixed redirect URI regardless of how a request
 * arrives. Only the origin (scheme://host[:port]) is used — any path is ignored.
 * An unparseable value is ignored so a typo can't silently break sign-in.
 */
export function configuredOrigin(): string | undefined {
  const raw = process.env.OPENBAO_UI_PUBLIC_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/**
 * The browser-facing origin of an incoming request, e.g. "http://localhost:3000"
 * or "https://bao.example.com".
 *
 * Precedence: the OPENBAO_UI_PUBLIC_URL override (if set) wins; otherwise derive
 * it from the forwarded/Host headers.
 *
 * Why not just `new URL(req.url).origin`? In the single-image deployment Next.js
 * runs as a standalone server bound to `HOSTNAME=0.0.0.0:3000`, so `req.url`
 * carries that *internal* bind address ("https://0.0.0.0:3000") — NOT the host
 * the user actually typed. The OIDC `redirect_uri` has to match the origin the
 * role's `allowed_redirect_uris` (and the Google OAuth client) were registered
 * with, which is the browser's `window.location.origin`. So fall back to the
 * forwarded/Host headers, which faithfully carry the browser-facing host.
 */
export function requestOrigin(req: NextRequest): string {
  const override = configuredOrigin();
  if (override) return override;
  const h = req.headers;
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host")?.trim();
  if (!host) return new URL(req.url).origin;
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(req.url).protocol.replace(/:$/, "");
  return `${proto}://${host}`;
}
