import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { OPENBAO_ADDR } from "@/lib/openbao";
import { getToken } from "@/lib/session";

/**
 * Authenticated passthrough proxy: /ui/api/bao/<path> -> OPENBAO_ADDR/v1/<path>
 *
 * Injects the httpOnly token (so it never reaches client JS) and forwards the
 * caller's namespace. Client-side TanStack Query talks only to this route.
 *
 * Notes:
 *  - OpenBao LIST is expressed as GET with `?list=true` (browsers can't send the
 *    LIST verb), which this proxy forwards verbatim.
 *  - We deliberately scope to the user's own token — this is no more privileged
 *    than the user calling the OpenBao API directly.
 */
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }

  // CSRF defense-in-depth on state-changing methods.
  if (req.method !== "GET" && req.method !== "HEAD" && isCrossSiteRequest(req)) {
    return NextResponse.json({ errors: ["cross-site request blocked"] }, { status: 403 });
  }

  const { path } = await ctx.params;
  // Keep the proxy strictly scoped under /v1/ — reject traversal segments
  // (encodeURIComponent does not encode "." so ".." would otherwise escape).
  if (path.some((seg) => seg === "." || seg === "..")) {
    return NextResponse.json({ errors: ["invalid path"] }, { status: 400 });
  }
  const search = req.nextUrl.search; // preserves ?list=true, ?version=N, etc.
  const url = `${OPENBAO_ADDR}/v1/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers: Record<string, string> = { "X-Vault-Token": token };
  const ns = req.headers.get("x-vault-namespace");
  if (ns) headers["X-Vault-Namespace"] = ns;

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let body: string | undefined;
  if (hasBody) {
    body = await req.text();
    if (body) headers["Content-Type"] = "application/json";
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { errors: ["could not reach OpenBao"] },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
