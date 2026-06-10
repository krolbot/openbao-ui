import { NextResponse } from "next/server";

import { openbao, OpenBaoRequestError } from "@/lib/openbao";
import { clearToken, getToken } from "@/lib/session";

/**
 * GET /ui2/api/auth/session — returns info about the current token, or 401 if
 * there is no valid session. Clears the cookie if the token is no longer valid.
 */
export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const lookup = await openbao.lookupSelf(token);
    return NextResponse.json({
      displayName: lookup.data.display_name,
      policies: lookup.data.policies,
      ttl: lookup.data.ttl,
      renewable: lookup.data.renewable,
    });
  } catch (err) {
    if (err instanceof OpenBaoRequestError && err.status === 403) {
      await clearToken();
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Could not reach OpenBao" },
      { status: 502 },
    );
  }
}
