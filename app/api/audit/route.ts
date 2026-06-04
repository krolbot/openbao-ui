import { open, readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { parseAuditLog } from "@/lib/audit-parse";
import { openbao } from "@/lib/openbao";
import { getToken } from "@/lib/session";

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH ?? "/bao/file/audit.log";
// Cap how much of the (append-only) audit log we read per request, so memory
// and latency stay bounded as the file grows under the UI's auto-refresh.
const MAX_READ_BYTES = 512 * 1024;

/** Read the whole file, or just the trailing window for large files. */
async function readRecentAuditLog(): Promise<string> {
  const { size } = await stat(AUDIT_LOG_PATH);
  if (size <= MAX_READ_BYTES) return readFile(AUDIT_LOG_PATH, "utf8");

  const fh = await open(AUDIT_LOG_PATH, "r");
  try {
    const buf = Buffer.alloc(MAX_READ_BYTES);
    await fh.read(buf, 0, MAX_READ_BYTES, size - MAX_READ_BYTES);
    const text = buf.toString("utf8");
    // Drop the partial first line so parseAuditLog only sees whole entries.
    const nl = text.indexOf("\n");
    return nl >= 0 ? text.slice(nl + 1) : text;
  } finally {
    await fh.close();
  }
}

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
    content = await readRecentAuditLog();
  } catch {
    return NextResponse.json({ available: false, records: [] });
  }

  return NextResponse.json({ available: true, records: parseAuditLog(content) });
}
