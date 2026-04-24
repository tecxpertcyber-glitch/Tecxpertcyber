import { NextRequest } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import { bumpAdminTokenVersion, ensureDbInitialized } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/logout-all
 *
 * Bumps the server-side admin token version, which instantly invalidates
 * every JWT that was previously issued (on any device, in any browser).
 * The current device must re-login as well.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  if (!(await verifyAdminToken(token))) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    await ensureDbInitialized();
    const newVersion = await bumpAdminTokenVersion();
    return Response.json({
      success: true,
      message:
        "✓ All admin sessions on every device have been logged out. You'll need to log in again.",
      tokenVersion: newVersion,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
