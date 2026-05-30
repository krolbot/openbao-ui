import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { openbao, OpenBaoRequestError } from "@/lib/openbao";

/**
 * POST /ui/api/auth/oidc/start  { mount?, role? }
 * Returns the provider auth URL to redirect to, and stashes the client nonce +
 * mount in httpOnly cookies for the callback to use.
 *
 * NOTE: requires an OIDC auth method configured in OpenBao with this app's
 * callback registered as an allowed redirect URI.
 */
export async function POST(req: NextRequest) {
  let body: { mount?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mount = body.mount || "oidc";
  const nonce = crypto.randomUUID();
  const redirectUri = `${new URL(req.url).origin}/ui/api/auth/oidc/callback`;

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
