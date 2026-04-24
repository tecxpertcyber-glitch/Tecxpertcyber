import { NextRequest } from "next/server";
import {
  verifyStorageLive,
  getVisitorStats,
  readDb,
} from "@/lib/storage";
import { verifyAdminToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice(7);
    if (!(await verifyAdminToken(token)))
      return Response.json({ error: "Invalid token" }, { status: 401 });

    // Real liveness probe — never report "connected" if the DB doesn't respond.
    const live = await verifyStorageLive();

    let totals = { categories: 0, services: 0 };
    let visitors = { uniqueIps: 0, totalPageViews: 0, lastVisit: "" };

    if (live.alive) {
      try {
        const [db, vs] = await Promise.all([readDb(), getVisitorStats()]);
        totals = {
          categories: db.categories.length,
          services: db.services.length,
        };
        visitors = {
          uniqueIps: vs.uniqueIps.length,
          totalPageViews: vs.totalPageViews,
          lastVisit: vs.lastVisit,
        };
      } catch {
        /* ignore — we'll just show zeros */
      }
    }

    return Response.json({
      storage: live.backend,
      source: live.source,
      persistent: live.persistent, // ✅ true ONLY if backend actually responded
      alive: live.alive,
      error: live.error,
      checkedAt: live.checkedAt,
      visitors,
      totals,
    });
  } catch (err) {
    console.error(
      "Stats error:",
      err instanceof Error ? err.message : "unknown"
    );
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
