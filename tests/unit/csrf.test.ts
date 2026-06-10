import { describe, expect, it } from "vitest";

import { isCrossSiteRequest } from "@/lib/csrf";

function req(headers: Record<string, string>) {
  return new Request("http://localhost/ui2/api/auth/login", {
    method: "POST",
    headers,
  });
}

describe("isCrossSiteRequest", () => {
  it("allows same-origin fetches", () => {
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "same-origin" }))).toBe(false);
  });

  it("allows direct navigations (Sec-Fetch-Site: none)", () => {
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "none" }))).toBe(false);
  });

  it("blocks cross-site requests", () => {
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "same-site" }))).toBe(true);
  });

  it("treats a foreign Origin as cross-site", () => {
    expect(isCrossSiteRequest(req({ origin: "https://evil.example.com" }))).toBe(true);
  });

  it("allows non-browser clients with no Origin/Sec-Fetch-Site (no ambient cookie)", () => {
    expect(isCrossSiteRequest(req({}))).toBe(false);
  });
});
