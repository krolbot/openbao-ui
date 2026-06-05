import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { getToken } from "@/lib/session";
import { isOperator } from "@/lib/ui-admin";

/**
 * Definitions of issued app credentials (AppRole machine identities), per
 * namespace. Stores ONLY the non-secret definition — app, env selector, level,
 * and the materialized role/policy names — so they can be listed, rotated, and
 * revoked. The secret_id is shown once at issue/rotate time and is NEVER stored.
 *   GET /ui/api/app-credentials  — authenticated
 *   PUT /ui/api/app-credentials  — operator only (namespace from header)
 */
export const dynamic = "force-dynamic";

const key = (ns: string) => `app-credentials::${ns}`;

export async function GET(req: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const ns = req.headers.get("x-vault-namespace") ?? "";
  return NextResponse.json({ creds: getConfig<unknown[]>(key(ns)) ?? [] });
}

export async function PUT(req: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ errors: ["cross-site request blocked"] }, { status: 403 });
  }
  const ns = req.headers.get("x-vault-namespace") ?? "";
  if (!(await isOperator(token, ns))) {
    return NextResponse.json(
      { errors: ["forbidden: requires mount-management capability"] },
      { status: 403 },
    );
  }
  let body: { creds?: unknown[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ errors: ["invalid JSON"] }, { status: 400 });
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
