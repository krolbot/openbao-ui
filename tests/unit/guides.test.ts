import { describe, expect, it } from "vitest";

import { buildSnippets } from "@/lib/guides";

describe("buildSnippets", () => {
  const base = {
    addr: "https://bao.example.com",
    mount: "secret",
    path: "app/config",
    auth: "token" as const,
  };

  it("emits one snippet per supported language", () => {
    const ids = buildSnippets(base).map((s) => s.id);
    expect(ids).toEqual(["cli", "curl", "go", "python", "node", "agent"]);
  });

  it("substitutes the real address, mount and KV v2 data path", () => {
    const byId = Object.fromEntries(buildSnippets(base).map((s) => [s.id, s.code]));
    expect(byId.cli).toContain('BAO_ADDR="https://bao.example.com"');
    expect(byId.cli).toContain("bao kv get -mount=secret app/config");
    // curl / node hit the KV v2 read path under /v1
    expect(byId.curl).toContain("/v1/secret/data/app/config");
    expect(byId.node).toContain("/v1/secret/data/app/config");
    expect(byId.python).toContain('mount_point="secret"');
  });

  it("switches auth flow for AppRole", () => {
    const token = Object.fromEntries(
      buildSnippets(base).map((s) => [s.id, s.code]),
    );
    const approle = Object.fromEntries(
      buildSnippets({ ...base, auth: "approle" }).map((s) => [s.id, s.code]),
    );
    expect(token.cli).not.toContain("auth/approle/login");
    expect(approle.cli).toContain("auth/approle/login");
    expect(approle.curl).toContain("role_id");
  });

  it("normalizes slashes and falls back to sane defaults", () => {
    const out = Object.fromEntries(
      buildSnippets({ addr: "https://x/", mount: "/kv/", path: "/a/b/", auth: "token" }).map(
        (s) => [s.id, s.code],
      ),
    );
    expect(out.curl).toContain("/v1/kv/data/a/b");
    expect(out.curl).not.toContain("//v1");
  });
});
