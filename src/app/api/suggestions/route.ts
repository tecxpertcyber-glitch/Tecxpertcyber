import { NextRequest } from "next/server";
import { addSuggestion, getSuggestions } from "@/lib/storage";
import { safeJson, safeString, SafeInputError } from "@/lib/safe-input";
import { isIpBlocked } from "@/lib/security";

export const dynamic = "force-dynamic";

// Per-IP in-memory rate limit (best-effort; complements the persistent block list)
const lastSubmit = new Map<string, number[]>();

// Garbage collect the rate-limit map so it can't grow without bound
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [ip, arr] of lastSubmit.entries()) {
    const fresh = arr.filter((t) => t >= cutoff);
    if (fresh.length === 0) lastSubmit.delete(ip);
    else lastSubmit.set(ip, fresh);
  }
}, 10 * 60 * 1000).unref?.();

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const arr = lastSubmit.get(ip) || [];
  const fresh = arr.filter((t) => now - t < 60 * 60 * 1000);
  if (fresh.length >= 5) {
    return { ok: false, reason: "Too many suggestions. Try again later." };
  }
  if (fresh.length > 0 && now - fresh[fresh.length - 1] < 30_000) {
    return {
      ok: false,
      reason: "Please wait a few seconds before sending another suggestion.",
    };
  }
  fresh.push(now);
  lastSubmit.set(ip, fresh);
  return { ok: true };
}

// POST /api/suggestions
export async function POST(req: NextRequest) {
  try {
    const ip = getIp(req);

    // Hard block check
    const blocked = await isIpBlocked(ip).catch(() => null);
    if (blocked) {
      return Response.json(
        { error: "Your IP is blocked. " + blocked.reason },
        { status: 403 }
      );
    }

    // Strict JSON body (max 8 KB — message capped at 500 chars)
    const body = await safeJson<{ message?: string }>(req, { maxBytes: 8 * 1024 });
    const message = safeString(body.message, {
      min: 3,
      max: 500,
      field: "message",
    });

    const limit = checkRateLimit(ip);
    if (!limit.ok) {
      return Response.json({ error: limit.reason }, { status: 429 });
    }

    const created = await addSuggestion(message, ip);
    return Response.json({
      success: true,
      message: "✓ Thank you! Your suggestion has been received.",
      suggestion: { id: created.id, createdAt: created.createdAt },
    });
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

// GET /api/suggestions  — count only (no message text in public)
export async function GET() {
  try {
    const data = await getSuggestions();
    return Response.json({ count: data.count, ttlHours: data.ttlHours });
  } catch {
    return Response.json({ count: 0, ttlHours: 24 });
  }
}
