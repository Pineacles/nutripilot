import type { NextConfig } from "next";

// Content-Security-Policy. Next.js emits inline bootstrap scripts, hence 'unsafe-inline' for scripts
// (a nonce policy would force every page to render dynamically); everything else is first-party.
// The barcode scanner needs the camera (getUserMedia, allowed by Permissions-Policy below) and a
// blob: video source, but no CSP entry for the camera itself. 'unsafe-eval' is dev-only (React
// debugging in `next dev`).
const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
