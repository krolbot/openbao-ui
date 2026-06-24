import type { NextRequest } from "next/server";

/**
 * The browser-facing origin of an incoming request, e.g. "http://localhost:3000"
 * or "https://bao.example.com".
 *
 * Why not `new URL(req.url).origin`? In the single-image deployment Next.js runs
 * as a standalone server bound to `HOSTNAME=0.0.0.0:3000`, so `req.url` carries
 * that *internal* bind address ("https://0.0.0.0:3000") — NOT the host the user
 * actually typed. The OIDC `redirect_uri` has to match the origin the role's
 * `allowed_redirect_uris` (and the Google OAuth client) were registered with,
 * which is the browser's `window.location.origin`. So derive it from the
 * forwarded/Host headers, which faithfully carry the browser-facing host.
 */
export function requestOrigin(req: NextRequest): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host")?.trim();
  if (!host) return new URL(req.url).origin;
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(req.url).protocol.replace(/:$/, "");
  return `${proto}://${host}`;
}
