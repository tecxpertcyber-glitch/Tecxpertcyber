import { NextRequest } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import { Pool } from "pg";
import { Redis } from "@upstash/redis";
import {
  readRuntimeDbConfig,
  writeRuntimeDbConfig,
  clearRuntimeDbConfig,
  getRuntimeConfigPath,
} from "@/lib/db-config";
import {
  resetStorageDetection,
  ensureBackendsReady,
  getStorageBackend,
  isStoragePersistent,
  getPgSource,
  getRedisSource,
  readDb,
  writeDbDirect,
  invalidateLiveStatusCache,
} from "@/lib/storage";
import {
  safeJson,
  safeString,
  safeEnum,
  safePostgresUrl,
  safeHttpUrl,
  SafeInputError,
} from "@/lib/safe-input";

export const dynamic = "force-dynamic";

/**
 * Reject SSRF / internal-network targets unless the URL is clearly
 * localhost (admin testing locally). Production Postgres providers all
 * use public DNS names, so this is a safe restriction.
 */
function looksLikeInternal(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false; // explicitly allowed
  // RFC1918 private ranges
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  // Link-local & metadata
  if (/^169\.254\./.test(h)) return true; // includes AWS metadata 169.254.169.254
  if (/^fc[0-9a-f]{2}:/i.test(h) || /^fd[0-9a-f]{2}:/i.test(h)) return true;
  if (/^fe80:/i.test(h)) return true;
  // 0.0.0.0 / 0.x bogus
  if (/^0\./.test(h)) return true;
  return false;
}

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (!(await verifyAdminToken(token))) return false;
  return true;
}

// ── Test a Postgres connection without saving ───────────────
async function testPostgres(
  url: string
): Promise<{ ok: boolean; error?: string; serverVersion?: string }> {
  let pool: Pool | null = null;
  try {
    // URL was already validated by safePostgresUrl(); double-check the host
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return { ok: false, error: "Invalid URL" };
    }
    if (looksLikeInternal(host)) {
      return {
        ok: false,
        error:
          "For security, internal/private network hosts are blocked. Use your provider's public hostname.",
      };
    }
    pool = new Pool({
      connectionString: url,
      ssl:
        host === "localhost" || host === "127.0.0.1" || host === "::1"
          ? false
          : { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 1000,
    });
    const res = await pool.query<{ version: string }>(
      "SELECT version() AS version"
    );
    return {
      ok: true,
      serverVersion: res.rows[0]?.version?.split(" ").slice(0, 2).join(" "),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

// ── Test Redis (Upstash REST) credentials ───────────────────
async function testRedis(
  url: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return { ok: false, error: "Invalid URL" };
    }
    if (looksLikeInternal(host)) {
      return {
        ok: false,
        error:
          "For security, internal/private network hosts are blocked. Use Upstash's public REST URL.",
      };
    }
    const client = new Redis({ url, token });
    const pingResult = await client.ping();
    if (pingResult !== "PONG" && pingResult !== "pong") {
      return {
        ok: false,
        error: `Unexpected ping response: ${String(pingResult)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── GET /api/admin/database — current connection info ──────
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureBackendsReady();

  const backend = getStorageBackend();
  const persistent = isStoragePersistent();
  const source =
    backend === "postgres"
      ? getPgSource()
      : backend === "upstash-redis"
        ? getRedisSource()
        : null;

  const runtimeConfig = await readRuntimeDbConfig();
  const configPath = await getRuntimeConfigPath();

  return Response.json({
    backend,
    persistent,
    source,
    hasRuntimeConfig: Boolean(runtimeConfig?.postgresUrl || runtimeConfig?.redisUrl),
    runtimeConfiguredAt: runtimeConfig?.configuredAt ?? null,
    runtimeConfigStorage: {
      path: configPath.path,
      isPersistent: configPath.isPersistent,
    },
    envVarsDetected: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
      POSTGRES_PRISMA_URL: Boolean(process.env.POSTGRES_PRISMA_URL),
      KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
      UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    },
  });
}

// ── POST /api/admin/database — test or save credentials ────
//   body: { action: "test" | "connect", type: "postgres" | "redis", url, token? }
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: "test" | "connect";
  let type: "postgres" | "redis";
  let cleanUrl: string;
  let cleanToken: string | undefined;

  try {
    const body = await safeJson<Record<string, unknown>>(req, {
      maxBytes: 4 * 1024,
    });
    action = safeEnum(body.action, ["test", "connect"] as const, "action");
    type = safeEnum(body.type, ["postgres", "redis"] as const, "type");

    if (type === "postgres") {
      cleanUrl = safePostgresUrl(body.url, "url");
    } else {
      cleanUrl = safeHttpUrl(body.url, "url");
      cleanToken = safeString(body.token, {
        min: 8,
        max: 1024,
        field: "token",
      });
    }
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Step 1: always test the connection first
  const testResult =
    type === "postgres"
      ? await testPostgres(cleanUrl)
      : await testRedis(cleanUrl, cleanToken!);

  if (!testResult.ok) {
    return Response.json({
      success: false,
      action,
      error: testResult.error || "Connection failed",
    }, { status: 400 });
  }

  if (action === "test") {
    return Response.json({
      success: true,
      action: "test",
      message: "Connection successful",
      serverVersion: "serverVersion" in testResult ? testResult.serverVersion : undefined,
    });
  }

  if (action === "connect") {
    // Capture existing data BEFORE switching backends so we can migrate it
    let snapshot: Awaited<ReturnType<typeof readDb>> | null = null;
    try {
      snapshot = await readDb();
    } catch {
      snapshot = null;
    }

    // Save the new credentials
    const existing = (await readRuntimeDbConfig()) || {};
    const newConfig =
      type === "postgres"
        ? { ...existing, postgresUrl: cleanUrl }
        : { ...existing, redisUrl: cleanUrl, redisToken: cleanToken! };

    await writeRuntimeDbConfig(newConfig);
    resetStorageDetection();
    invalidateLiveStatusCache();

    // Migrate the snapshot into the new backend (only if it has user data)
    if (snapshot && snapshot.services.length > 0) {
      try {
        // readDb on the new backend will seed defaults if empty;
        // we want to overwrite with the snapshot to preserve existing edits.
        await ensureBackendsReady();
        const fresh = await readDb(); // triggers schema/seed on new backend
        // Merge: keep snapshot's services/categories/admin_settings
        const merged = {
          ...fresh,
          categories: snapshot.categories,
          services: snapshot.services,
          admin_settings: snapshot.admin_settings,
          _meta: snapshot._meta,
        };
        await writeDbDirect(merged);
      } catch (err) {
        console.error("Migration warning:", err instanceof Error ? err.message : "unknown");
      }
    }

    const finalBackend = getStorageBackend();
    const finalSource =
      finalBackend === "postgres"
        ? getPgSource()
        : finalBackend === "upstash-redis"
          ? getRedisSource()
          : null;

    return Response.json({
      success: true,
      action: "connect",
      message: "Database connected and existing data migrated",
      backend: finalBackend,
      source: finalSource,
      persistent: isStoragePersistent(),
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

// ── DELETE /api/admin/database — disconnect runtime config ─
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearRuntimeDbConfig();
  resetStorageDetection();
  invalidateLiveStatusCache();
  return Response.json({ success: true, message: "Runtime database config cleared" });
}
