import { NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { clearToken } from "@/lib/session";

/** POST /ui/api/auth/logout — clears the session cookie. */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  await clearToken();
  return NextResponse.json({ ok: true });
}
