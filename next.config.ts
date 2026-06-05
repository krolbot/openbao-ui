import type { NextConfig } from "next";

/**
 * The "marry" layer between our custom frontend and the OpenBao backend.
 *
 *   /ui/*       -> React pages (this app, served under basePath)
 *   /ui/api/*   -> Next.js route handlers (our BFF: auth, session, ...)
 *   /v1/*       -> rewritten/proxied to the local OpenBao instance
 *
 * In the single Docker image OpenBao runs on 127.0.0.1:8200 and Next.js is the
 * only exposed port; it proxies API traffic to OpenBao via the rewrite below.
 */
const OPENBAO_ADDR = process.env.OPENBAO_ADDR ?? "http://127.0.0.1:8200";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/ui",
  async rewrites() {
    return [
      {
        // basePath:false keeps the proxy at /v1 (NOT /ui/v1).
        source: "/v1/:path*",
        destination: `${OPENBAO_ADDR}/v1/:path*`,
        basePath: false,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/ui",
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
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
