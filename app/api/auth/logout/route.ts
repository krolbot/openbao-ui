import { NextResponse } from "next/server";

import { clearToken } from "@/lib/session";

/** POST /ui/api/auth/logout — clears the session cookie. */
export async function POST() {
  await clearToken();
  return NextResponse.json({ ok: true });
}
