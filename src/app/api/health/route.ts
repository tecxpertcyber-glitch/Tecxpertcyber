import {
  verifyStorageLive,
  getVisitorStats,
  ensureDbInitialized,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  // Real liveness probe — no false positives. Cached for 15s.
  const status = await verifyStorageLive();

  // Try to initialise the DB only if the backend is alive
  let dbReady = false;
  if (status.alive) {
    try {
      await ensureDbInitialized();
      dbReady = true;
    } catch {
      dbReady = false;
    }
  }

  let stats = { uniqueIps: 0, totalPageViews: 0, lastVisit: "" };
  if (status.alive) {
    try {
      const vs = await getVisitorStats();
      stats = {
        uniqueIps: vs.uniqueIps.length,
        totalPageViews: vs.totalPageViews,
        lastVisit: vs.lastVisit,
      };
    } catch {
      /* ignore */
    }
  }

  return Response.json({
    ok: status.alive,
    storage: status.backend,
    source: status.source,
    persistent: status.persistent,
    alive: status.alive,
    dbReady,
    error: status.error,
    checkedAt: status.checkedAt,
    visitors: stats,
  });
}
