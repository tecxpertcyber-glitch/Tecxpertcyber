import { NextRequest } from "next/server";
import {
  findOne,
  ensureDbInitialized,
  type JsonAdminSetting,
} from "@/lib/storage";
import bcrypt from "bcryptjs";
import { signAdminToken, adminSecretMissing } from "@/lib/admin-auth";
import {
  checkLoginAllowed,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/security";
import { safeJson, safeString, SafeInputError } from "@/lib/safe-input";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function buildLockMessage(gate: {
  reason?: string;
  lockedUntil?: string;
  minutesUntilUnlock?: number;
  nextLockHours?: number;
  lockCount?: number;
}): string {
  const parts: string[] = [];
  if (gate.lockedUntil) {
    const d = new Date(gate.lockedUntil);
    parts.push(
      `🔒 Locked until ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} (${gate.minutesUntilUnlock ?? 0} min)`
    );
  }
  if (gate.reason) parts.push(`Reason: ${gate.reason}`);
  if (gate.nextLockHours && gate.lockCount && gate.lockCount > 0) {
    parts.push(
      `Note: another 3 failures will lock for ${gate.nextLockHours}h.`
    );
  }
  return parts.join(" — ");
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  try {
    // 1) Gate FIRST — even before parsing the body — so a locked IP can't
    //    flood us with bcrypt CPU work
    const gate = await checkLoginAllowed(ip);
    if (!gate.allowed) {
      return Response.json(
        {
          error: buildLockMessage(gate),
          locked: true,
          lockedUntil: gate.lockedUntil,
          minutesUntilUnlock: gate.minutesUntilUnlock,
          reason: gate.reason,
        },
        { status: 423 }
      );
    }

    await ensureDbInitialized();

    // 2) Strict body validation. Cap password length to 128 chars (sane
    //    upper bound; longer than this is almost certainly an attack and
    //    bcrypt's CPU cost grows with input).
    const body = await safeJson<{ password?: string }>(req, { maxBytes: 1024 });
    const password = safeString(body.password, {
      min: 1,
      max: 128,
      field: "password",
    });

    const settings = await findOne<JsonAdminSetting>(
      "admin_settings",
      () => true
    );
    if (!settings) {
      return Response.json({ error: "Admin not configured" }, { status: 500 });
    }

    // bcrypt.compare is constant-time across the same hash → no timing leak
    const valid = await bcrypt.compare(password, settings.passwordHash);

    if (!valid) {
      const after = await recordFailedLogin(ip);
      if (!after.allowed) {
        return Response.json(
          {
            error: buildLockMessage(after),
            locked: true,
            lockedUntil: after.lockedUntil,
            minutesUntilUnlock: after.minutesUntilUnlock,
            reason: after.reason,
          },
          { status: 423 }
        );
      }
      const remaining = after.failsRemaining ?? 0;
      return Response.json(
        {
          error: `Invalid password. ${remaining} ${
            remaining === 1 ? "attempt" : "attempts"
          } remaining before this IP is locked for ${
            (after.lockCount ?? 0) + 1
          } hour${(after.lockCount ?? 0) + 1 === 1 ? "" : "s"}.`,
          attemptsRemaining: remaining,
        },
        { status: 401 }
      );
    }

    await recordSuccessfulLogin(ip);

    const token = await signAdminToken({ admin: true });

    // Build a friendly composite warning if anything's not optimal:
    //   - default password "cyber" still in use
    //   - ADMIN_SECRET env var not set (using fallback per-process key)
    const warnings: string[] = [];
    if (password === "cyber") {
      warnings.push(
        "You are still using the default password 'cyber'. Change it from the Account tab."
      );
    }
    if (adminSecretMissing()) {
      warnings.push(
        "ADMIN_SECRET env var is not set. Editing works, but tokens reset on every server restart. Add a 64-char random ADMIN_SECRET in Vercel for permanent sessions."
      );
    }

    return Response.json({
      success: true,
      token,
      ...(warnings.length > 0 && { warning: warnings.join(" · ") }),
    });
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  // Lightweight health probe so the admin page can show a banner if
  // ADMIN_SECRET is missing before the user even tries to log in.
  return Response.json({ secretConfigured: !adminSecretMissing() });
}
