import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { listLabels, upsertLabel, type LabelScope } from "@/lib/db";
import { getValidatedMetadataSession } from "@/lib/metadata-session";
import { parseJsonBody, RequestBodyError } from "@/lib/request-body";
import { isOperator } from "@/lib/ui-admin";

/**
 * UI "nicer naming" labels for namespaces / mounts / paths.
 *   GET  /ui2/api/labels?namespace=<ns>[&scope=<scope>]  — any authenticated token
 *   PUT  /ui2/api/labels                                  — operator only
 *
 * Reads require only a valid session (labels are non-secret presentation data);
 * writes are CSRF-guarded and gated on mount-management capability.
 */
export const dynamic = "force-dynamic";

const SCOPES = new Set<LabelScope>(["workspace", "environment", "application"]);
const isScope = (s: unknown): s is LabelScope =>
  typeof s === "string" && SCOPES.has(s as LabelScope);

export async function GET(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace } = session;
  const scopeParam = req.nextUrl.searchParams.get("scope");
  if (scopeParam && !isScope(scopeParam)) {
    return NextResponse.json({ errors: ["invalid scope"] }, { status: 400 });
  }
  try {
    const labels = listLabels(namespace, scopeParam as LabelScope | undefined);
    return NextResponse.json({ labels });
  } catch {
    return NextResponse.json(
      { errors: ["could not read labels"] },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace, token } = session;
  if (isCrossSiteRequest(req)) {
    return NextResponse.json(
      { errors: ["cross-site request blocked"] },
      { status: 403 },
    );
  }
  // Namespace was validated together with the bearer and is the only storage scope.
  if (!(await isOperator(token, namespace))) {
    return NextResponse.json(
      { errors: ["forbidden: requires mount-management capability"] },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await parseJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ errors: ["invalid JSON"] }, { status });
  }

  const scope = body.scope;
  const ref = body.ref;
  if (!isScope(scope)) {
    return NextResponse.json({ errors: ["invalid scope"] }, { status: 400 });
  }
  if (typeof ref !== "string" || !ref) {
    return NextResponse.json({ errors: ["ref is required"] }, { status: 400 });
  }

  try {
    const label = upsertLabel({
      namespace,
      scope,
      ref,
      label: body.label,
      description: body.description,
      color: body.color,
      env_group: body.env_group,
    });
    return NextResponse.json({ label });
  } catch {
    return NextResponse.json(
      { errors: ["could not save label"] },
      { status: 500 },
    );
  }
}
