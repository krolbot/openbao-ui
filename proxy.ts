import { NextRequest, NextResponse } from "next/server";

import { BASE_PATH } from "@/lib/base-path";

const COOKIE_NAME =
  process.env.BAO_COOKIE_NAME ??
  (process.env.NODE_ENV === "production" ? "__Host-bao_token" : "bao_token");

/**
 * Gate authenticated app pages (Next 16 "proxy" convention, formerly
 * middleware). Unauthenticated requests to our app (/ui2/*) are redirected to
 * /ui2/login; the login page and the auth BFF routes stay open.
 *
 * NOTE: proxy only governs this application's pages. OpenBao is intentionally
 * not reachable through `/ui/*` or `/v1/*` reverse-proxy paths; privileged
 * bootstrap remains a local operator action.
 */
export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Normalize away our basePath so the allow-list works regardless of whether
  // Next includes it in the pathname for this runtime version.
  const rel = pathname.replace(new RegExp(`^${BASE_PATH}`), "") || "/";

  // API routes self-authenticate and return JSON status codes (never redirect
  // an XHR to the login HTML); only page navigations are gated here. Static
  // assets in public/ (e.g. the logo SVGs) must not be redirected either.
  const isAsset = /\.(svg|png|jpe?g|gif|ico|webp|woff2?|css|js|map|txt)$/i.test(
    rel,
  );
  const isPublic =
    rel === "/login" ||
    rel.startsWith("/login/") ||
    rel.startsWith("/api/") ||
    isAsset;

  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL(`${BASE_PATH}/login`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
