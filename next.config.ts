import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // ⚠️ DO NOT set `trailingSlash: true` here.
  // It causes all POST/PATCH/DELETE API calls without a trailing slash to be
  // 308-redirected, which strips the request body in browsers — breaking
  // every admin edit/save action. Pages still get crawled fine without it.
  // Hide the X-Powered-By header (small fingerprinting reduction)
  poweredByHeader: false,
  // Defense-in-depth — apply security headers from the static config too,
  // so they're guaranteed even if middleware ever fails.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
