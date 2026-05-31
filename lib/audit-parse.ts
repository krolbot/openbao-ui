// Pure parsing/normalization of an OpenBao audit log line (one JSON object per
// line). Kept framework-free so it is easy to unit test and reuse.
export type AuditRecord = {
  time?: string;
  type?: string;
  operation?: string;
  path?: string;
  remote_address?: string;
  display_name?: string;
  error?: string;
};

type RawEntry = {
  time?: string;
  type?: string;
  error?: string;
  auth?: { display_name?: string };
  request?: { operation?: string; path?: string; remote_address?: string };
};

/** Parse one audit log line into a normalized record, or null if malformed. */
export function parseAuditLine(line: string): AuditRecord | null {
  try {
    const e = JSON.parse(line) as RawEntry;
    return {
      time: e.time,
      type: e.type,
      operation: e.request?.operation,
      path: e.request?.path,
      remote_address: e.request?.remote_address,
      display_name: e.auth?.display_name,
      error: e.error || undefined,
    };
  } catch {
    return null;
  }
}

/** Parse a whole audit log: most-recent first, capped, malformed lines dropped. */
export function parseAuditLog(content: string, max = 400): AuditRecord[] {
  const lines = content.split("\n").filter(Boolean).slice(-max).reverse();
  const out: AuditRecord[] = [];
  for (const line of lines) {
    const rec = parseAuditLine(line);
    if (rec) out.push(rec);
  }
  return out;
}
