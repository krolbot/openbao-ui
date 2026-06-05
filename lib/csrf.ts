// Defense-in-depth CSRF protection for state-changing BFF requests.
//
// The session token lives in a SameSite=lax httpOnly cookie, which already
// blocks cookies on cross-site POST/fetch. As a second layer we verify the
// request originates from our own origin. Browsers always send Sec-Fetch-Site
// (and Origin) on fetch/XHR; a non-browser client (curl, CI) carries no ambient
// cookie and so is not a CSRF vector.
export function isCrossSiteRequest(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host !== req.headers.get("host");
    } catch {
      return true;
    }
  }
  // No browser-set headers => not a browser-driven request => no ambient cookie.
  return false;
}
