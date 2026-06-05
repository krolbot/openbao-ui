import { describe, expect, it } from "vitest";

import { buildAccessPolicy } from "@/lib/access-policy";

describe("buildAccessPolicy", () => {
  it("scopes an app across a mount-per-env group (editor)", () => {
    const hcl = buildAccessPolicy({
      envs: [{ mount: "prod" }, { mount: "dev" }],
      app: "payments",
      level: "editor",
    });
    expect(hcl).toContain('path "prod/data/payments/*"');
    expect(hcl).toContain('path "dev/data/payments/*"');
    expect(hcl).toContain('path "prod/metadata/payments/*"');
    // can browse the app folder...
    expect(hcl).toContain('path "prod/metadata/payments"');
    // ...but NOT the mount root (sibling apps stay hidden)
    expect(hcl).not.toMatch(/path "prod\/metadata"\s*\{/);
    // editor data caps include write/delete; metadata stays read/list
    expect(hcl).toContain('create", "read", "update", "delete", "list"');
  });

  it("supports the single-mount + env-folder layout", () => {
    const hcl = buildAccessPolicy({
      envs: [{ mount: "secret", envPath: "prod" }],
      app: "payments",
      level: "viewer",
    });
    expect(hcl).toContain('path "secret/data/prod/payments/*"');
    expect(hcl).toContain('path "secret/metadata/prod/payments/*"');
    expect(hcl).toContain('path "secret/metadata/prod/payments"');
    // viewer is read-only
    expect(hcl).not.toContain("update");
  });

  it("grants the whole environment when no app is given (env-group grant)", () => {
    const hcl = buildAccessPolicy({
      envs: [{ mount: "prod" }],
      level: "editor",
    });
    expect(hcl).toContain('path "prod/data/*"');
    expect(hcl).toContain('path "prod/metadata/*"');
    // can list the env root to discover apps
    expect(hcl).toMatch(/path "prod\/metadata"\s*\{/);
  });

  it("admin adds sudo on data and full metadata", () => {
    const hcl = buildAccessPolicy({ envs: [{ mount: "prod" }], app: "x", level: "admin" });
    expect(hcl).toContain('"sudo"');
  });

  it("sanitizes unsafe characters so HCL can't be injected", () => {
    const hcl = buildAccessPolicy({
      // a malicious app name trying to break out of the quoted string and add
      // its own path block
      envs: [{ mount: "prod" }],
      app: 'x" {\n  capabilities = ["sudo"]\n}\npath "secret/*',
      level: "viewer",
    });
    // the quote/newline payload is stripped — no stray quotes or extra blocks
    expect(hcl).not.toContain('secret/*');
    expect(hcl).not.toContain('"sudo"');
    // every `path "..."` line is well-formed (no unescaped quote inside)
    for (const m of hcl.matchAll(/path "([^"]*)"/g)) {
      expect(m[1]).not.toContain('"');
      expect(m[1]).not.toContain("\n");
    }
  });

  it("grants shared key bundles read-only alongside the app", () => {
    const hcl = buildAccessPolicy({
      envs: [{ mount: "prod" }],
      app: "backend",
      level: "editor",
      shared: ["stripe"],
    });
    // the app's own secrets keep the editor caps
    expect(hcl).toContain('path "prod/data/backend/*"');
    expect(hcl).toContain('create", "read", "update", "delete", "list"');
    // the shared bundle is read-only, regardless of the role level
    expect(hcl).toContain('path "prod/data/_shared/stripe/*"');
    expect(hcl).toMatch(/path "prod\/data\/_shared\/stripe\/\*" \{\s*capabilities = \["read"\]/);
    expect(hcl).toContain("shared: stripe");
  });

  it("de-duplicates and normalizes slashes", () => {
    const hcl = buildAccessPolicy({
      envs: [{ mount: "/prod/" }, { mount: "prod" }],
      app: "/payments/",
      level: "viewer",
    });
    // both env entries normalize to the same paths -> single block each
    expect(hcl.match(/path "prod\/data\/payments\/\*"/g)?.length).toBe(1);
    expect(hcl).not.toContain("//");
  });
});
