import type { NextConfig } from "next";

import { BASE_PATH } from "./lib/base-path";

/**
 * The "marry" layer between our custom frontend and the OpenBao backend.
 *
 *   /ui2/*      -> React pages (this app, served under basePath)
 *   /ui2/api/*  -> Next.js route handlers (our BFF: auth, session, ...)
 *
 * In the single Docker image OpenBao runs on 127.0.0.1:8200 and is never
 * exposed through Next rewrites. All application traffic uses authenticated,
 * bounded BFF routes under /ui2/api. This deliberately excludes OpenBao's
 * stock UI and raw /v1 transport: otherwise unauthenticated bootstrap APIs
 * could be reached by any visitor before an operator initializes the server.
 */

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: BASE_PATH,
  async redirects() {
    return [
      {
        source: "/",
        destination: BASE_PATH,
        basePath: false,
        permanent: false,
      },
    ];
  },
  async headers() {
    // Security headers for a secrets UI: no framing (clickjacking), no MIME
    // sniffing, and no referrer leakage of paths to third parties.
    return [
      {
        source: "/:path*",
        basePath: false,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'sha256-GsHNcCTMw/cAiGHeOrUisRG5jLKewA09uoLlTwzqkxI='; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
