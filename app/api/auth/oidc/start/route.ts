import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { API_BASE } from "@/lib/base-path";
import { isCrossSiteRequest } from "@/lib/csrf";
import { openbao, OpenBaoRequestError } from "@/lib/openbao";

/**
 * POST /ui2/api/auth/oidc/start  { mount?, role? }
 * Returns the provider auth URL to redirect to, and stashes the client nonce +
 * mount in httpOnly cookies for the callback to use.
 *
 * NOTE: requires an OIDC auth method configured in OpenBao with this app's
 * callback registered as an allowed redirect URI.
 */
export async function POST(req: NextRequest) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  let body: { mount?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mount = body.mount || "oidc";
  const nonce = crypto.randomUUID();
  const redirectUri = `${new URL(req.url).origin}${API_BASE}/auth/oidc/callback`;

  try {
    const res = await openbao.oidcAuthURL(mount, body.role, redirectUri, nonce);
    const store = await cookies();
    const opts = {
      httpOnly: true as const,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 300,
    };
    store.set("oidc_nonce", nonce, opts);
    store.set("oidc_mount", mount, opts);
    return NextResponse.json({ authUrl: res.data.auth_url });
  } catch (err) {
    const msg =
      err instanceof OpenBaoRequestError
        ? err.errors.join(", ")
        : "Could not start OIDC login";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
