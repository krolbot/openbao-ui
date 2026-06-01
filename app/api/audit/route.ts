import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { parseAuditLog } from "@/lib/audit-parse";
import { openbao } from "@/lib/openbao";
import { getToken } from "@/lib/session";

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH ?? "/bao/file/audit.log";

/**
 * GET /ui/api/audit — reads the file audit device's log (which lives on the
 * same container as the BFF) and returns the most recent normalized entries.
 * `available:false` means no audit log file exists (e.g. dev mode / not configured).
 */
export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ errors: ["not authenticated"] }, { status: 401 });
  }

  // Audit records can contain sensitive operational detail — enforce an actual
  // OpenBao capability check on sys/audit rather than relying on UI tab gating.
  try {
    const caps = await openbao.capabilitiesSelf(token, ["sys/audit"]);
    const allowed =
      (caps.data?.["sys/audit"] as string[] | undefined) ??
      caps.data?.capabilities ??
      [];
    if (!allowed.some((c) => ["read", "list", "sudo", "root"].includes(c))) {
      return NextResponse.json({ errors: ["forbidden"] }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ errors: ["forbidden"] }, { status: 403 });
  }

  let content: string;
  try {
    content = await readFile(AUDIT_LOG_PATH, "utf8");
  } catch {
    return NextResponse.json({ available: false, records: [] });
  }

  return NextResponse.json({ available: true, records: parseAuditLog(content) });
}
