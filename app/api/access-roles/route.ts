import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { getValidatedMetadataSession } from "@/lib/metadata-session";
import { parseJsonBody, RequestBodyError } from "@/lib/request-body";
import { isOperator } from "@/lib/ui-admin";

/**
 * Definitions of scoped access roles (shareable env groups + app-specific
 * groups), per namespace. These are the structured intent ({ env selector, app,
 * level }); materializing one into an OpenBao policy + identity group happens
 * client-side. Stored so they're editable and re-syncable.
 *   GET /ui2/api/access-roles  — authenticated
 *   PUT /ui2/api/access-roles  — operator only (namespace from header)
 */
export const dynamic = "force-dynamic";

const key = (ns: string) => `access-roles::${ns}`;

export async function GET(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace: ns } = session;
  return NextResponse.json({ roles: getConfig<unknown[]>(key(ns)) ?? [] });
}

export async function PUT(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace: ns, token } = session;
  if (isCrossSiteRequest(req)) {
    return NextResponse.json(
      { errors: ["cross-site request blocked"] },
      { status: 403 },
    );
  }
  // Namespace was validated together with the bearer and gates the storage key.
  if (!(await isOperator(token, ns))) {
    return NextResponse.json(
      { errors: ["forbidden: requires mount-management capability"] },
      { status: 403 },
    );
  }
  let body: { roles?: unknown[] };
  try {
    body = await parseJsonBody<typeof body>(req, 64 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ errors: ["invalid JSON"] }, { status });
  }
  if (!Array.isArray(body.roles)) {
    return NextResponse.json({ errors: ["roles must be an array"] }, { status: 400 });
  }
  try {
    setConfig(key(ns), body.roles);
    return NextResponse.json({ roles: body.roles });
  } catch {
    return NextResponse.json({ errors: ["could not save roles"] }, { status: 500 });
  }
}
