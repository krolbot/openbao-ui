import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { getToken } from "@/lib/session";

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH ?? "/bao/file/audit.log";
const MAX_LINES = 400;

type RawEntry = {
  time?: string;
  type?: string;
  error?: string;
  auth?: { display_name?: string };
  request?: { operation?: string; path?: string; remote_address?: string };
};

export type AuditRecord = {
  time?: string;
  type?: string;
  operation?: string;
  path?: string;
  remote_address?: string;
  display_name?: string;
  error?: string;
};

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

  let content: string;
  try {
    content = await readFile(AUDIT_LOG_PATH, "utf8");
  } catch {
    return NextResponse.json({ available: false, records: [] });
  }

  const lines = content.split("\n").filter(Boolean).slice(-MAX_LINES).reverse();
  const records: AuditRecord[] = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line) as RawEntry;
      records.push({
        time: e.time,
        type: e.type,
        operation: e.request?.operation,
        path: e.request?.path,
        remote_address: e.request?.remote_address,
        display_name: e.auth?.display_name,
        error: e.error || undefined,
      });
    } catch {
      // skip malformed lines
    }
  }

  return NextResponse.json({ available: true, records });
}
