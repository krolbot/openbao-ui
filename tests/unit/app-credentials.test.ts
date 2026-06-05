import { describe, expect, it } from "vitest";

import { credNames, envIdent } from "@/lib/app-credentials";

describe("credNames", () => {
  it("names a read-only (viewer) credential", () => {
    expect(credNames("payments", "prod", "viewer")).toEqual({
      role: "payments-prod",
      policy: "payments-prod-read",
    });
  });

  it("names a read/write (editor) credential", () => {
    expect(credNames("payments", "prod-eu", "editor")).toEqual({
      role: "payments-prod-eu",
      policy: "payments-prod-eu-editor",
    });
  });

  it("sanitizes unsafe characters in app/env names", () => {
    const { role, policy } = credNames("My App!", "prod/east", "viewer");
    expect(role).toBe("My-App-prod-east");
    expect(policy).toBe("My-App-prod-east-read");
    // no spaces, slashes, or doubled separators
    expect(role).not.toMatch(/[^a-zA-Z0-9_.-]/);
  });
});

describe("envIdent", () => {
  it("is the mount for the mount-per-env layout", () => {
    expect(envIdent({ mount: "prod" })).toBe("prod");
  });
  it("disambiguates env folders in a single mount", () => {
    expect(envIdent({ mount: "secret", envPath: "prod" })).toBe("secret-prod");
  });
});
