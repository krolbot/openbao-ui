import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { getValidatedMetadataSession } from "@/lib/metadata-session";
import { parseJsonBody, RequestBodyError } from "@/lib/request-body";
import { isOperator } from "@/lib/ui-admin";

/**
 * Definitions of issued app credentials (AppRole machine identities), per
 * namespace. Stores ONLY the non-secret definition — app, env selector, level,
 * and the materialized role/policy names — so they can be listed, rotated, and
 * revoked. The secret_id is shown once at issue/rotate time and is NEVER stored.
 *   GET /ui2/api/app-credentials  — authenticated
 *   PUT /ui2/api/app-credentials  — operator only (namespace from header)
 */
export const dynamic = "force-dynamic";

const key = (ns: string) => `app-credentials::${ns}`;

export async function GET(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace: ns } = session;
  return NextResponse.json({ creds: getConfig<unknown[]>(key(ns)) ?? [] });
}

export async function PUT(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace: ns, token } = session;
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ errors: ["cross-site request blocked"] }, { status: 403 });
  }
  if (!(await isOperator(token, ns))) {
    return NextResponse.json(
      { errors: ["forbidden: requires mount-management capability"] },
      { status: 403 },
    );
  }
  let body: { creds?: unknown[] };
  try {
    body = await parseJsonBody<typeof body>(req, 64 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ errors: ["invalid JSON"] }, { status });
  }
  if (!Array.isArray(body.creds)) {
    return NextResponse.json({ errors: ["creds must be an array"] }, { status: 400 });
  }
  try {
    setConfig(key(ns), body.creds);
    return NextResponse.json({ creds: body.creds });
  } catch {
    return NextResponse.json({ errors: ["could not save credentials"] }, { status: 500 });
  }
}
