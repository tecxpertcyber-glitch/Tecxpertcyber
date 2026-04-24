import { NextRequest } from "next/server";
import { trackVisitor } from "@/lib/storage";
import { recordVisit } from "@/lib/security";
import { safeJson, safeString } from "@/lib/safe-input";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIp(req);

    // Hard rate limit: max 30 pings per minute per IP for /api/track
    // (a real customer triggers ~1-3 per page navigation; 30 is generous)
    const rl = rateLimit(`track:${ip}`, 30, 60_000);
    if (!rl.ok) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
      });
    }

    // Body is optional & tiny ({path?, kind?}), 1 KB hard cap
    let path: string | undefined;
    let kind: "visitor" | "admin" | "internal" = "visitor";
    try {
      const body = await safeJson<{ path?: string; kind?: string }>(req, {
        maxBytes: 1024,
        requireObject: false,
      });
      if (body && typeof body === "object") {
        if (body.path !== undefined) {
          path = safeString(body.path, { max: 200, field: "path", allowEmpty: true });
        }
        if (body.kind === "admin" || body.kind === "internal") {
          kind = body.kind;
        }
      }
    } catch {
      /* allow empty / sendBeacon raw blobs */
    }

    // Server-side cross-check: if the path starts with /admin or /hacker,
    // override the client-supplied kind so a malicious client can't lie.
    const pathLc = (path || "/").toLowerCase();
    if (pathLc.startsWith("/admin")) kind = "admin";
    else if (pathLc.startsWith("/hacker")) kind = "internal";

    // Truncate user-agent to avoid huge log rows
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 200);

    // Security check + visit log (also enforces blocked IPs / flood detection)
    const sec = await recordVisit(ip, path || "/", userAgent).catch(() => ({
      blocked: false as const,
    }));
    if (sec.blocked) {
      return Response.json(
        { error: sec.reason || "Blocked" },
        { status: 403 }
      );
    }

    const stats = await trackVisitor(ip, kind);

    return Response.json({
      uniqueVisitors: stats.uniqueIps.length,
      totalPageViews: stats.totalPageViews,
      lastVisit: stats.lastVisit,
    });
  } catch {
    return Response.json({ uniqueVisitors: 0, totalPageViews: 0 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
