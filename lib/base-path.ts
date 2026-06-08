// Single source of truth for the app's Next.js basePath. Our app is served under
// BASE_PATH (so OpenBao's stock UI can keep `/ui`); client fetches to the BFF use
// API_BASE. Imported by next.config.ts and proxy.ts as well, so changing the path
// is a one-line edit. NOTE: `/v1/*` is NOT under basePath (next.config rewrite
// with basePath:false) — those fetches stay literal `/v1/...`.
export const BASE_PATH = "/ui2";
export const API_BASE = `${BASE_PATH}/api`;
