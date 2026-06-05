import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = process.env.BAO_COOKIE_NAME ?? "bao_token";

/**
 * Gate authenticated app pages (Next 16 "proxy" convention, formerly
 * middleware). Unauthenticated requests to /ui/* are redirected to /ui/login;
 * the login page and the auth BFF routes stay open.
 *
 * NOTE: this only governs the app's basePath (/ui). The `/v1/*` proxy lives
 * outside basePath (next.config rewrite with basePath:false), so this never
 * runs on it — the unauthenticated bootstrap/discovery calls the login and
 * seal flows make (sys/seal-status, sys/init, sys/unseal,
 * sys/internal/ui/mounts) reach OpenBao directly, by design.
 */
export function proxy(req: NextRequest) {
  // Normalize away the basePath so the allow-list works regardless of whether
  // Next includes it in the pathname for this runtime version.
  const rel = req.nextUrl.pathname.replace(/^\/ui/, "") || "/";

  // API routes self-authenticate and return JSON status codes (never redirect
  // an XHR to the login HTML); only page navigations are gated here. Static
  // assets in public/ (e.g. the logo SVGs) must not be redirected either.
  const isAsset = /\.(svg|png|jpe?g|gif|ico|webp|woff2?|css|js|map|txt)$/i.test(rel);
  // /v1/* is the unauthenticated OpenBao proxy used by the seal/bootstrap and
  // login-discovery flows. It already sits outside basePath (so this normally
  // doesn't run on it), but exempt it explicitly as defense in depth.
  const isPublic =
    rel === "/login" ||
    rel.startsWith("/login/") ||
    rel.startsWith("/api/") ||
    rel === "/v1" ||
    rel.startsWith("/v1/") ||
    isAsset;

  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/ui/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
