import { NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { openbao } from "@/lib/openbao";
import { clearToken, getToken } from "@/lib/session";

/** POST /ui2/api/auth/logout — clears the session cookie. */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  const token = await getToken();
  if (token) {
    try {
      await openbao.revokeSelf(token);
    } catch {
      // Local logout remains reliable even when OpenBao is temporarily unavailable.
    }
  }
  await clearToken();
  return NextResponse.json({ ok: true });
}
