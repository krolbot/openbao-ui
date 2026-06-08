import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { BASE_PATH } from "@/lib/base-path";
import { openbao } from "@/lib/openbao";
import { setToken } from "@/lib/session";

/**
 * GET /ui2/api/auth/oidc/callback?code=&state=
 * The OIDC provider redirects here; we exchange the code for a token, store it,
 * and bounce to the app.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  const store = await cookies();
  const nonce = store.get("oidc_nonce")?.value ?? "";
  const mount = store.get("oidc_mount")?.value ?? "oidc";

  const loginUrl = new URL(`${BASE_PATH}/login`, url.origin);

  if (!code || !state || !nonce) {
    loginUrl.searchParams.set("error", "Invalid OIDC callback");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const res = await openbao.oidcCallback(mount, state, code, nonce);
    await setToken(res.auth.client_token, res.auth.lease_duration);
    store.delete("oidc_nonce");
    store.delete("oidc_mount");
    return NextResponse.redirect(new URL(BASE_PATH, url.origin));
  } catch {
    loginUrl.searchParams.set("error", "OIDC login failed");
    return NextResponse.redirect(loginUrl);
  }
}
