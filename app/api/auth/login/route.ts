import { NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { openbao, OpenBaoRequestError } from "@/lib/openbao";
import { FixedWindowRateLimiter } from "@/lib/rate-limit";
import { parseJsonBody, RequestBodyError } from "@/lib/request-body";
import { setToken } from "@/lib/session";

type LoginBody =
  | { method: "token"; token: string }
  | { method: "userpass"; mount?: string; username: string; password: string }
  | { method: "ldap"; mount?: string; username: string; password: string }
  | { method: "approle"; mount?: string; roleId: string; secretId: string };

const loginRateLimiter = new FixedWindowRateLimiter(10, 60_000);

function isLoginBody(value: unknown): value is LoginBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "method" in value &&
    typeof value.method === "string"
  );
}

function loginRateLimitKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

/**
 * POST /ui2/api/auth/login
 *
 * Validates credentials against OpenBao server-side, then stores the resulting
 * token in an httpOnly cookie. The raw token never reaches client JS.
 */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  let body: LoginBody;
  try {
    const parsed = await parseJsonBody<unknown>(req, 16 * 1024);
    if (!isLoginBody(parsed)) {
      return NextResponse.json({ error: "Invalid login body" }, { status: 400 });
    }
    body = parsed;
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid JSON body" }, { status });
  }
  if (!loginRateLimiter.consume(loginRateLimitKey(req))) {
    return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
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

    if (body.method === "userpass" || body.method === "ldap") {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json(
          { error: "Username and password are required" },
          { status: 400 },
        );
      }
      const res =
        body.method === "ldap"
          ? await openbao.ldapLogin(body.mount || "ldap", username, password)
          : await openbao.userpassLogin(body.mount || "userpass", username, password);
      await setToken(res.auth.client_token, res.auth.lease_duration);
      return NextResponse.json({
        displayName: username,
        policies: res.auth.policies,
      });
    }

    if (body.method === "approle") {
      const { roleId, secretId } = body;
      if (!roleId || !secretId) {
        return NextResponse.json(
          { error: "Role ID and Secret ID are required" },
          { status: 400 },
        );
      }
      const res = await openbao.approleLogin(
        body.mount || "approle",
        roleId,
        secretId,
      );
      await setToken(res.auth.client_token, res.auth.lease_duration);
      return NextResponse.json({
        displayName: "approle",
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
