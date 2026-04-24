import { NextRequest } from "next/server";
import {
  readDb,
  insert,
  update,
  remove,
  ensureDbInitialized,
  trackVisitor,
  getStorageBackend,
  type JsonCategory,
  type JsonService,
} from "@/lib/storage";
import { CATEGORIES } from "@/data/services";
import {
  safeJson,
  safeString,
  safeInt,
  safeEnum,
  SafeInputError,
} from "@/lib/safe-input";
import { verifyAdminToken } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_ICONS = [
  "Briefcase",
  "ShieldCheck",
  "Globe",
  "GraduationCap",
  "Printer",
  "Laptop",
  "CreditCard",
  "MousePointer2",
] as const;

// Allow only Tailwind class strings we issue ourselves (defence-in-depth so
// nobody can inject arbitrary class strings that might be later rendered).
const TAILWIND_CLASS_RE = /^[a-z0-9\-/:. ]+$/i;

function safeClassName(v: unknown, field: string): string {
  const s = safeString(v, { max: 100, min: 1, field });
  if (!TAILWIND_CLASS_RE.test(s)) {
    throw new SafeInputError(`${field} contains invalid characters`);
  }
  return s;
}

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// GET /api/services — public
export async function GET(req: NextRequest) {
  try {
    const ip = getIp(req);

    // Rate-limit so a bot can't pummel the DB. 60 reads/min per IP is
    // way more than any real customer needs.
    const rl = rateLimit(`services:${ip}`, 60, 60_000);
    if (!rl.ok) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
      });
    }

    await ensureDbInitialized();
    const db = await readDb();
    trackVisitor(ip).catch(() => {});

    const result = db.categories.map((cat) => ({
      id: cat.id,
      title: cat.title,
      iconName: cat.iconName as (typeof ALLOWED_ICONS)[number],
      color: cat.color,
      bg: cat.bg,
      services: db.services
        .filter((s) => s.categoryId === cat.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ id: s.id, name: s.name, price: s.price })),
    }));

    return Response.json({
      categories: result,
      source: "db",
      storage: getStorageBackend(),
    });
  } catch (err) {
    console.error("Storage error in /api/services:", err instanceof Error ? err.message : "unknown");
    return Response.json(
      { categories: CATEGORIES, source: "static-fallback" },
      { status: 200 }
    );
  }
}

const ADMIN_ACTIONS = [
  "updatePrice",
  "addService",
  "deleteService",
  "updateServiceName",
  "addCategory",
  "deleteCategory",
] as const;

// POST /api/services — admin (auth required)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice(7);
    if (!(await verifyAdminToken(token))) return Response.json({ error: "Invalid token" }, { status: 401 });

    const body = await safeJson<Record<string, unknown>>(req, {
      maxBytes: 8 * 1024,
    });
    const action = safeEnum(body.action, ADMIN_ACTIONS, "action");

    await ensureDbInitialized();

    switch (action) {
      case "updatePrice": {
        const id = safeInt(body.id, { min: 1, field: "id" });
        const price = safeString(body.price, { min: 1, max: 50, field: "price" });
        await update<JsonService>(
          "services",
          (s) => s.id === id,
          { price }
        );
        return Response.json({ success: true });
      }

      case "addService": {
        const categoryId = safeInt(body.categoryId, {
          min: 1,
          field: "categoryId",
        });
        const name = safeString(body.name, { min: 1, max: 200, field: "name" });
        const price = safeString(body.price, { min: 1, max: 50, field: "price" });
        const sortOrder =
          body.sortOrder !== undefined && body.sortOrder !== null
            ? safeInt(body.sortOrder, { min: 0, max: 10000, field: "sortOrder" })
            : 0;
        const inserted = await insert<JsonService>("services", {
          categoryId,
          name,
          price,
          sortOrder,
        });
        return Response.json({ success: true, service: inserted });
      }

      case "deleteService": {
        const id = safeInt(body.id, { min: 1, field: "id" });
        await remove<JsonService>("services", (s) => s.id === id);
        return Response.json({ success: true });
      }

      case "updateServiceName": {
        const id = safeInt(body.id, { min: 1, field: "id" });
        const name = safeString(body.name, { min: 1, max: 200, field: "name" });
        await update<JsonService>("services", (s) => s.id === id, { name });
        return Response.json({ success: true });
      }

      case "addCategory": {
        const title = safeString(body.title, {
          min: 1,
          max: 100,
          field: "title",
        });
        const iconName = safeEnum(body.iconName, ALLOWED_ICONS, "iconName");
        const color = safeClassName(body.color, "color");
        const bg = safeClassName(body.bg, "bg");
        const sortOrder =
          body.sortOrder !== undefined && body.sortOrder !== null
            ? safeInt(body.sortOrder, { min: 0, max: 10000, field: "sortOrder" })
            : 0;
        const inserted = await insert<JsonCategory>("categories", {
          title,
          iconName,
          color,
          bg,
          sortOrder,
        });
        return Response.json({ success: true, category: inserted });
      }

      case "deleteCategory": {
        const id = safeInt(body.id, { min: 1, field: "id" });
        await remove<JsonService>("services", (s) => s.categoryId === id);
        await remove<JsonCategory>("categories", (c) => c.id === id);
        return Response.json({ success: true });
      }
    }
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("Admin API error:", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
