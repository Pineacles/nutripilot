import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Changes on every build, so the service worker URL changes and phones pick up the new version.
  env: { NEXT_PUBLIC_BUILD_STAMP: String(Date.now()) },
  async headers() {
    return [
      {
        // The browser must always see a new service worker right after a deploy.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.INTERNAL_API_URL || "http://api:8000"}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${process.env.INTERNAL_API_URL || "http://api:8000"}/health`,
      },
      {
        source: "/docs",
        destination: `${process.env.INTERNAL_API_URL || "http://api:8000"}/docs`,
      },
      {
        source: "/openapi.json",
        destination: `${process.env.INTERNAL_API_URL || "http://api:8000"}/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
