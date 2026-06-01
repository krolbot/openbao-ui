import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { DEFAULT_ROLE_TEMPLATES, type RoleTemplate } from "@/lib/role-defaults";
import { getToken } from "@/lib/session";
import { isOperator } from "@/lib/ui-admin";

/**
 * Role-template catalog (the Team view's standard roles), per namespace.
 *   GET /ui/api/role-templates?namespace=<ns>  — authenticated; seeded with the
 *       built-in defaults until an operator customizes them.
 *   PUT /ui/api/role-templates                  — operator only; saves the list.
 *
 * Templates are non-secret presentation/config data; materializing one into an
 * actual policy + group happens client-side via the OpenBao API.
 */
export const dynamic = "force-dynamic";

const key = (ns: string) => `role-templates::${ns}`;

export async function GET(req: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const ns = req.headers.get("x-vault-namespace") ?? "";
  const stored = getConfig<RoleTemplate[]>(key(ns));
  return NextResponse.json({ templates: stored ?? DEFAULT_ROLE_TEMPLATES });
}

export async function PUT(req: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  if (isCrossSiteRequest(req)) {
    return NextResponse.json(
      { errors: ["cross-site request blocked"] },
      { status: 403 },
    );
  }
  // Namespace comes from the caller's header and gates the operator check, so
  // templates can only be written for a namespace the caller administers.
  const ns = req.headers.get("x-vault-namespace") ?? "";
  if (!(await isOperator(token, ns))) {
    return NextResponse.json(
      { errors: ["forbidden: requires mount-management capability"] },
      { status: 403 },
    );
  }

  let body: { templates?: RoleTemplate[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ errors: ["invalid JSON"] }, { status: 400 });
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
