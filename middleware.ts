import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = process.env.BAO_COOKIE_NAME ?? "bao_token";

/**
 * Gate authenticated app pages. Unauthenticated requests to /ui/* are
 * redirected to /ui/login. The login page and the auth BFF routes stay open.
 */
export function middleware(req: NextRequest) {
  // Normalize away the basePath so the allow-list works regardless of whether
  // Next includes it in the pathname for this runtime version.
  const rel = req.nextUrl.pathname.replace(/^\/ui/, "") || "/";

  // API routes self-authenticate and return JSON status codes (never redirect
  // an XHR to the login HTML); only page navigations are gated here.
  const isPublic =
    rel === "/login" || rel.startsWith("/login/") || rel.startsWith("/api/");

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
