import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { getToken } from "@/lib/session";

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
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }
  const ns = req.headers.get("x-vault-namespace") ?? "";
  return NextResponse.json({ onboarding: getConfig<Onboarding>(key(ns)) ?? {} });
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
  let body: Onboarding & { namespace?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ errors: ["invalid JSON"] }, { status: 400 });
  }
  // Scope onboarding state to the caller's namespace (header), not the body.
  const ns = req.headers.get("x-vault-namespace") ?? "";
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
