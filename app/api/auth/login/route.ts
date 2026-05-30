import { NextResponse } from "next/server";

import { openbao, OpenBaoRequestError } from "@/lib/openbao";
import { setToken } from "@/lib/session";

type LoginBody =
  | { method: "token"; token: string }
  | { method: "userpass"; username: string; password: string };

/**
 * POST /ui/api/auth/login
 *
 * Validates credentials against OpenBao server-side, then stores the resulting
 * token in an httpOnly cookie. The raw token never reaches client JS.
 */
export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.method === "token") {
      const token = body.token?.trim();
      if (!token) {
        return NextResponse.json({ error: "Token is required" }, { status: 400 });
      }
      const lookup = await openbao.lookupSelf(token);
      await setToken(token, lookup.data.ttl);
      return NextResponse.json({
        displayName: lookup.data.display_name,
        policies: lookup.data.policies,
      });
    }

    if (body.method === "userpass") {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json(
          { error: "Username and password are required" },
          { status: 400 },
        );
      }
      const res = await openbao.userpassLogin(username, password);
      await setToken(res.auth.client_token, res.auth.lease_duration);
      return NextResponse.json({
        displayName: username,
        policies: res.auth.policies,
      });
    }

    return NextResponse.json({ error: "Unknown auth method" }, { status: 400 });
  } catch (err) {
    if (err instanceof OpenBaoRequestError) {
      // 400/403 from OpenBao -> surface as an auth failure.
      const status = err.status === 403 || err.status === 400 ? 401 : 502;
      return NextResponse.json({ error: err.errors.join(", ") }, { status });
    }
    return NextResponse.json(
      { error: "Could not reach OpenBao" },
      { status: 502 },
    );
  }
}
