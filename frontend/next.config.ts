import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
