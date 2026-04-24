import { NextRequest } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  getRecentVisits,
  getRecentLoginAttempts,
  getBlockedIps,
  blockIp,
  unblockMaskedIp,
  cleanupVisits,
} from "@/lib/security";
import {
  safeJson,
  safeInt,
  safeString,
  safeEnum,
  safeIp,
  SafeInputError,
} from "@/lib/safe-input";

export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (!(await verifyAdminToken(token))) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [visits, attempts, blocks] = await Promise.all([
      getRecentVisits(50),
      getRecentLoginAttempts(),
      getBlockedIps(),
    ]);
    return Response.json({
      visits,
      loginAttempts: attempts,
      blocked: blocks,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

const SECURITY_ACTIONS = ["block", "unblock", "cleanup"] as const;

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await safeJson<Record<string, unknown>>(req, { maxBytes: 4096 });
    const action = safeEnum(body.action, SECURITY_ACTIONS, "action");

    if (action === "block") {
      const ip = safeIp(body.ip, "ip");
      const hours = safeInt(body.hours ?? 24, {
        min: 1,
        max: 720,
        field: "hours",
      });
      const reason = safeString(
        body.reason ?? "Manually blocked by admin",
        { max: 200, field: "reason", allowEmpty: true }
      );
      await blockIp(ip, hours, reason || "Manually blocked by admin");
      return Response.json({ success: true });
    }

    if (action === "unblock") {
      const ip = safeIp(body.ip, "ip");
      const removed = await unblockMaskedIp(ip);
      return Response.json({ success: true, removed });
    }

    if (action === "cleanup") {
      const removed = await cleanupVisits();
      return Response.json({ success: true, removed });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
