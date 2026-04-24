import { NextRequest } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  getSuggestions,
  deleteSuggestion,
  clearAllSuggestions,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (!(await verifyAdminToken(token))) return false;
  return true;
}

// GET /api/admin/suggestions — list suggestions
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await getSuggestions();
    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/suggestions       — clear all
// DELETE /api/admin/suggestions?id=X  — delete one
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      // Validate ID — must be digits only (Postgres BIGSERIAL) or short alnum (Redis fallback)
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
        return Response.json({ error: "Invalid id" }, { status: 400 });
      }
      await deleteSuggestion(id);
      return Response.json({ success: true, deleted: 1 });
    }
    const count = await clearAllSuggestions();
    return Response.json({ success: true, deleted: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
