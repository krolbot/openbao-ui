import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { DEFAULT_ROLE_TEMPLATES, type RoleTemplate } from "@/lib/role-defaults";
import { getValidatedMetadataSession } from "@/lib/metadata-session";
import { parseJsonBody, RequestBodyError } from "@/lib/request-body";
import { isOperator } from "@/lib/ui-admin";

/**
 * Role-template catalog (the Team view's standard roles), per namespace. The
 * namespace is always taken from the caller's `X-Vault-Namespace` header (never
 * a query/body param), so it can't be spoofed to read/write another namespace.
 *   GET /ui2/api/role-templates  — authenticated; seeded with the built-in
 *       defaults until an operator customizes them.
 *   PUT /ui2/api/role-templates  — operator only; saves the list.
 *
 * Templates are non-secret presentation/config data; materializing one into an
 * actual policy + group happens client-side via the OpenBao API.
 */
export const dynamic = "force-dynamic";

const key = (ns: string) => `role-templates::${ns}`;

export async function GET(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace: ns } = session;
  const stored = getConfig<RoleTemplate[]>(key(ns));
  return NextResponse.json({ templates: stored ?? DEFAULT_ROLE_TEMPLATES });
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
  // Namespace was validated together with the bearer and gates this catalog.
  if (!(await isOperator(token, ns))) {
    return NextResponse.json(
      { errors: ["forbidden: requires mount-management capability"] },
      { status: 403 },
    );
  }

  let body: { templates?: RoleTemplate[] };
  try {
    body = await parseJsonBody<typeof body>(req, 64 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ errors: ["invalid JSON"] }, { status });
  }
  if (!Array.isArray(body.templates)) {
    return NextResponse.json(
      { errors: ["templates must be an array"] },
      { status: 400 },
    );
  }
  try {
    setConfig(key(ns), body.templates);
    return NextResponse.json({ templates: body.templates });
  } catch {
    return NextResponse.json(
      { errors: ["could not save templates"] },
      { status: 500 },
    );
  }
}
