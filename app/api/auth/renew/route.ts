import { NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { openbao, OpenBaoRequestError } from "@/lib/openbao";
import { getToken, setToken } from "@/lib/session";

/** POST /ui2/api/auth/renew — renew-self and refresh the cookie lifetime. */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const res = await openbao.renewSelf(token);
    const ttl = res.auth.lease_duration;
    await setToken(res.auth.client_token || token, ttl);
    return NextResponse.json({ ttl });
  } catch (err) {
    const msg =
      err instanceof OpenBaoRequestError
        ? err.errors.join(", ")
        : "Renew failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
