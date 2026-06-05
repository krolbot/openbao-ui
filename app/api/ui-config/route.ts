import { NextRequest, NextResponse } from "next/server";

import { isCrossSiteRequest } from "@/lib/csrf";
import { getConfig, setConfig } from "@/lib/db";
import { getToken } from "@/lib/session";
import { isOperator } from "@/lib/ui-admin";

/**
 * UI configuration (branding + login customization).
 *   GET  /ui/api/ui-config  — PUBLIC, returns only whitelisted presentation
 *                             fields so the unauthenticated login page can brand
 *                             itself. Never returns secrets.
 *   PUT  /ui/api/ui-config  — root-namespace operator only. This is a single
 *                             server-global blob (one CONFIG_KEY, not
 *                             per-namespace), so authorization is checked in the
 *                             root namespace regardless of the caller's current
 *                             namespace — a child-namespace operator must not be
 *                             able to change server-wide login branding.
 *
 * Phase 1 establishes the route + store; Phase 2 (login customization) fills in
 * branding/default-method/ordering on top of it.
 */
export const dynamic = "force-dynamic";

const CONFIG_KEY = "ui";

// Fields safe to expose without authentication (login page branding).
const PUBLIC_KEYS = [
  "branding",
  "defaultLoginMethod",
  "hideTokenLogin",
  "loginMethodOrder",
] as const;

type UiConfig = Record<string, unknown>;

export async function GET() {
  const cfg = (getConfig<UiConfig>(CONFIG_KEY) ?? {}) as UiConfig;
  const pub: UiConfig = {};
  for (const k of PUBLIC_KEYS) {
    if (k in cfg) pub[k] = cfg[k];
  }
  return NextResponse.json({ config: pub });
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
  // Global setting → require mount-management capability in the ROOT namespace,
  // not whatever namespace the caller is currently browsing.
  if (!(await isOperator(token, ""))) {
    return NextResponse.json(
      { errors: ["forbidden: requires mount-management capability"] },
      { status: 403 },
    );
  }

  let body: UiConfig;
  try {
    body = (await req.json()) as UiConfig;
  } catch {
    return NextResponse.json({ errors: ["invalid JSON"] }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { errors: ["body must be a JSON object"] },
      { status: 400 },
    );
  }

  const current = (getConfig<UiConfig>(CONFIG_KEY) ?? {}) as UiConfig;
  const merged = { ...current, ...body };
  try {
    setConfig(CONFIG_KEY, merged);
    return NextResponse.json({ config: merged });
  } catch {
    return NextResponse.json(
      { errors: ["could not save config"] },
      { status: 500 },
    );
  }
}
