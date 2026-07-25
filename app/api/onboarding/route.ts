import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { getValidatedMetadataSession } from "@/lib/metadata-session";
import { parseJsonBody, RequestBodyError } from "@/lib/request-body";

/**
 * Per-namespace onboarding progress for the "Getting started" checklist.
 *   GET /ui2/api/onboarding?namespace=<ns>
 *   PUT /ui2/api/onboarding   { namespace?, dismissed?, steps? }  (shallow-merged)
 *
 * Stores only non-derivable bits (dismissed flag + manual step marks); the
 * checklist derives most progress from live OpenBao state. Writes need a valid
 * session but not operator rights — dismissing/marking is benign UI state.
 */
export const dynamic = "force-dynamic";

const key = (ns: string) => `onboarding::${ns}`;

type Onboarding = { dismissed?: boolean; steps?: Record<string, boolean> };

export async function GET(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const { namespace: ns } = session;
  return NextResponse.json({ onboarding: getConfig<Onboarding>(key(ns)) ?? {} });
}

export async function PUT(req: NextRequest) {
  const session = await getValidatedMetadataSession(req.headers);
  if (!session) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  if (isCrossSiteRequest(req)) {
    return NextResponse.json(
      { errors: ["cross-site request blocked"] },
      { status: 403 },
    );
  }
  let body: Onboarding & { namespace?: string };
  try {
    body = await parseJsonBody<typeof body>(req, 16 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ errors: ["invalid JSON"] }, { status });
  }
  // Scope onboarding state to the namespace verified with the token.
  const { namespace: ns } = session;
  const current = (getConfig<Onboarding>(key(ns)) ?? {}) as Onboarding;
  const merged: Onboarding = {
    ...current,
    ...(body.dismissed !== undefined ? { dismissed: body.dismissed } : {}),
    steps: { ...current.steps, ...body.steps },
  };
  try {
    setConfig(key(ns), merged);
    return NextResponse.json({ onboarding: merged });
  } catch {
    return NextResponse.json(
      { errors: ["could not save onboarding"] },
      { status: 500 },
    );
  }
}
