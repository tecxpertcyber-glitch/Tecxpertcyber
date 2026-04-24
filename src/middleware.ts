// ============================================================
// EDGE MIDDLEWARE — first line of defence
// ============================================================
// • Strips suspicious / unsupported HTTP methods
// • Caps inbound body size at the edge (1 MB hard limit)
// • Adds defense-in-depth security headers to every response
// • Detects path-traversal attempts and obvious scanner probes
// ============================================================

import { NextRequest, NextResponse } from "next/server";

// Methods we actually use anywhere
const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

// Common malicious / bot probe paths — block early so they don't even hit Next
const PROBE_PATTERNS = [
  /\.php$/i,
  /\.asp$/i,
  /\.aspx$/i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/wp-content/i,
  /\/xmlrpc\.php/i,
  /\/\.env/i,
  /\/\.git/i,
  /\/\.aws/i,
  /\/cgi-bin/i,
  /\/phpmyadmin/i,
  /\/\.htaccess/i,
  /\/web\.config/i,
  /\.\.\/|\.\.%2f|%2e%2e/i, // path traversal
];

const MAX_INBOUND_BYTES = 1024 * 1024; // 1 MB hard cap

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  // 1) Block weird HTTP methods
  if (!ALLOWED_METHODS.has(method)) {
    return new NextResponse("Method not allowed", { status: 405 });
  }

  // 2) Block obvious scanner probes
  if (PROBE_PATTERNS.some((re) => re.test(pathname))) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 3) Cap inbound payload size at the edge
  const cl = parseInt(req.headers.get("content-length") || "0", 10);
  if (cl > MAX_INBOUND_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  // 4) Add security headers to every response
  const res = NextResponse.next();
  applySecurityHeaders(res);
  return res;
}

function applySecurityHeaders(res: NextResponse) {
  // Content Security Policy — strict but allows the inline JSON-LD <script>
  // we render on the services page (we use 'unsafe-inline' for scripts because
  // Next.js inlines its hydration data; you can tighten this further with
  // nonces if needed).
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // wa.me / mailto / tel and our own API
    "connect-src 'self' https://api.safaricom.co.ke https://sandbox.safaricom.co.ke",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()"
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("X-XSS-Protection", "0");
  // Hide the framework name a little
  res.headers.delete("x-powered-by");
}

export const config = {
  // Run on every route except Next internals & static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
