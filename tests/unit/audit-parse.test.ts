import { describe, expect, it } from "vitest";

import { parseAuditLine, parseAuditLog } from "@/lib/audit-parse";

const line = JSON.stringify({
  time: "2026-05-31T19:27:00Z",
  type: "request",
  auth: { display_name: "token" },
  request: { operation: "read", path: "secret/data/foo", remote_address: "127.0.0.1" },
});

describe("parseAuditLine", () => {
  it("normalizes a valid entry", () => {
    expect(parseAuditLine(line)).toEqual({
      time: "2026-05-31T19:27:00Z",
      type: "request",
      operation: "read",
      path: "secret/data/foo",
      remote_address: "127.0.0.1",
      display_name: "token",
      error: undefined,
    });
  });

  it("returns null on malformed JSON", () => {
    expect(parseAuditLine("{not json")).toBeNull();
  });
});

describe("parseAuditLog", () => {
  it("drops blank/malformed lines and returns most-recent first", () => {
    const a = JSON.stringify({ time: "1", type: "request", request: { path: "a" } });
    const b = JSON.stringify({ time: "2", type: "response", request: { path: "b" } });
    const records = parseAuditLog([a, "", "garbage", b].join("\n"));
    expect(records.map((r) => r.path)).toEqual(["b", "a"]);
  });

  it("caps the number of records", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ type: "request", request: { path: `p${i}` } }),
    ).join("\n");
    expect(parseAuditLog(many, 3)).toHaveLength(3);
  });
});
