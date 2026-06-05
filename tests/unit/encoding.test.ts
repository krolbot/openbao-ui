import { describe, expect, it } from "vitest";

import { fromBase64, toBase64 } from "@/lib/encoding";

describe("base64 encoding", () => {
  it("round-trips ASCII", () => {
    expect(fromBase64(toBase64("hello openbao"))).toBe("hello openbao");
  });

  it("round-trips UTF-8 (emoji, accents)", () => {
    const s = "pâté 🔐 naïve — ✓";
    expect(fromBase64(toBase64(s))).toBe(s);
  });

  it("encodes to standard base64", () => {
    expect(toBase64("hi")).toBe("aGk=");
  });

  it("round-trips an empty string", () => {
    expect(fromBase64(toBase64(""))).toBe("");
  });
});
