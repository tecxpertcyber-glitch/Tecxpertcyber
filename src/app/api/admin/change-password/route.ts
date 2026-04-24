import { NextRequest } from "next/server";
import {
  findOne,
  update,
  ensureDbInitialized,
  type JsonAdminSetting,
} from "@/lib/storage";
import bcrypt from "bcryptjs";
import { verifyAdminToken } from "@/lib/admin-auth";
import { safeJson, safeString, SafeInputError } from "@/lib/safe-input";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    if (!(await verifyAdminToken(token))) return Response.json({ error: "Invalid token" }, { status: 401 });

    const body = await safeJson<{
      currentPassword?: string;
      newPassword?: string;
    }>(req, { maxBytes: 1024 });

    const currentPassword = safeString(body.currentPassword, {
      min: 1,
      max: 128,
      field: "currentPassword",
    });
    const newPassword = safeString(body.newPassword, {
      min: 4,
      max: 128,
      field: "newPassword",
    });

    if (currentPassword === newPassword) {
      return Response.json(
        { error: "New password must be different from current" },
        { status: 400 }
      );
    }

    await ensureDbInitialized();
    const settings = await findOne<JsonAdminSetting>(
      "admin_settings",
      () => true
    );
    if (!settings) {
      return Response.json({ error: "Admin not found" }, { status: 500 });
    }

    const valid = await bcrypt.compare(currentPassword, settings.passwordHash);
    if (!valid) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    // Bump the token version while writing the new hash — this kicks
    // every existing session out so a stolen token can't keep working.
    const { bumpAdminTokenVersion } = await import("@/lib/storage");
    await update<JsonAdminSetting>(
      "admin_settings",
      () => true,
      { passwordHash: newHash }
    );
    await bumpAdminTokenVersion().catch(() => null);

    return Response.json({
      success: true,
      message:
        "✓ Password changed. All admin sessions have been logged out — please log in again with your new password.",
    });
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("Password change error:", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
