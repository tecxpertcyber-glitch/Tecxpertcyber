import { NextRequest } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import { getDetailedVisitors, getAdminVisitors } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  if (!(await verifyAdminToken(token)))
    return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const [report, adminVisitors] = await Promise.all([
      getDetailedVisitors(),
      getAdminVisitors(),
    ]);
    return Response.json({
      ...report,
      adminVisitors, // separate list of IPs that loaded /admin
    });
  } catch (err) {
    console.error(
      "Visitors error:",
      err instanceof Error ? err.message : "unknown"
    );
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
