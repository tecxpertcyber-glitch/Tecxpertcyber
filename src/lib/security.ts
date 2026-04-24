// ============================================================
// SECURITY MODULE
// ============================================================
// • Visit logging (every IP, auto-purge after 24h)
// • Brute-force protection on admin login (escalating lockouts)
// • Strange-traffic detection → automatic 24h IP block
// • Manual admin block/unblock controls
// ============================================================

import {
  ensurePgSchema,
  ensureBackendsReady,
  // We dynamically use the same getPg helper through ensurePgSchema indirectly,
  // but we still need a Pool; storage.ts only exposes ensurePgSchema publicly.
  // For the security module we re-detect the pool through env vars / runtime
  // config exactly like storage.ts does — except simpler because we don't
  // need to support the JSON fallback for security (it'd be useless anyway).
} from "./storage";
import { Pool } from "pg";
import { readRuntimeDbConfig } from "./db-config";

// ─── Local pg pool resolver (mirrors storage.ts) ─────────────
let _securityPool: Pool | null | undefined = undefined;
let _runtimePgUrl: string | undefined = undefined;

async function loadRuntime(): Promise<void> {
  if (_runtimePgUrl !== undefined) return;
  try {
    const cfg = await readRuntimeDbConfig();
    _runtimePgUrl = cfg?.postgresUrl ?? "";
  } catch {
    _runtimePgUrl = "";
  }
}

function detectUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  for (const v of candidates) {
    if (v && v.startsWith("postgres")) return v;
  }
  if (_runtimePgUrl && _runtimePgUrl.startsWith("postgres")) return _runtimePgUrl;
  return null;
}

async function getPool(): Promise<Pool | null> {
  await loadRuntime();
  if (_securityPool !== undefined) return _securityPool;
  const url = detectUrl();
  if (!url) {
    _securityPool = null;
    return null;
  }
  try {
    _securityPool = new Pool({
      connectionString: url,
      ssl:
        url.includes("localhost") || url.includes("127.0.0.1")
          ? false
          : { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 30000,
    });
    return _securityPool;
  } catch {
    _securityPool = null;
    return null;
  }
}

// ─── IP helpers ──────────────────────────────────────────────
// IP masking is DISABLED — admin panel shows full IPs.
// (Set to a one-line passthrough so every callsite shows the real IP.
// To re-enable masking later, restore the previous implementation.)
export function maskIp(ip: string): string {
  return ip || "unknown";
}

// ============================================================
// VISIT LOG  (every visit, auto-purged after 24h)
// ============================================================

const VISIT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FLOOD_WINDOW_MS = 60 * 1000; // 1 minute
const FLOOD_THRESHOLD = 60; // > 60 visits in 1 minute = bot/flood

let lastCleanupAt = 0;
function maybeRunCleanup() {
  const now = Date.now();
  if (now - lastCleanupAt < 60_000) return; // at most once per 60s
  lastCleanupAt = now;
  cleanupVisits().catch(() => null);
}

export interface VisitLogEntry {
  id: number | string;
  ip: string;
  path?: string;
  ts: string;
}

export async function recordVisit(
  ip: string,
  path: string,
  userAgent?: string
): Promise<{ blocked: boolean; reason?: string }> {
  await ensureBackendsReady();
  const pool = await getPool();
  if (!pool) return { blocked: false };
  await ensurePgSchema();

  // Hard block check first
  const blocked = await isIpBlocked(ip);
  if (blocked) {
    return { blocked: true, reason: blocked.reason };
  }

  // Insert visit
  await pool
    .query(
      "INSERT INTO visit_log (ip, path, user_agent) VALUES ($1, $2, $3)",
      [ip, path?.slice(0, 200) || null, userAgent?.slice(0, 200) || null]
    )
    .catch(() => null);

  // Throttled cleanup — runs at most once every 60 seconds so the
  // visit_log table can never balloon under attack while keeping the
  // DELETE off the hot path.
  maybeRunCleanup();

  // Flood detection
  const recent = await pool
    .query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM visit_log WHERE ip = $1 AND ts > NOW() - INTERVAL '1 minute'",
      [ip]
    )
    .catch(() => null);
  const count = recent ? parseInt(recent.rows[0]?.c ?? "0", 10) || 0 : 0;
  if (count > FLOOD_THRESHOLD) {
    await blockIp(
      ip,
      24,
      `Strange traffic: ${count} requests in 60s (flood / bot)`
    );
    return {
      blocked: true,
      reason: `Strange traffic: ${count} requests in 60 seconds`,
    };
  }

  return { blocked: false };
}

export async function cleanupVisits(): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;
  await ensurePgSchema();
  const cutoff = new Date(Date.now() - VISIT_TTL_MS).toISOString();
  const res = await pool.query("DELETE FROM visit_log WHERE ts < $1", [cutoff]);
  return res.rowCount ?? 0;
}

export async function getRecentVisits(limit = 100): Promise<{
  items: VisitLogEntry[];
  count24h: number;
  topIps: Array<{ ip: string; count: number }>;
}> {
  const pool = await getPool();
  if (!pool) return { items: [], count24h: 0, topIps: [] };
  await ensurePgSchema();
  await cleanupVisits();

  const [itemsRes, countRes, topRes] = await Promise.all([
    pool.query<{
      id: number;
      ip: string;
      path: string | null;
      ts: Date;
    }>(
      "SELECT id, ip, path, ts FROM visit_log ORDER BY ts DESC LIMIT $1",
      [limit]
    ),
    pool.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM visit_log WHERE ts > NOW() - INTERVAL '24 hours'"
    ),
    pool.query<{ ip: string; c: string }>(
      `SELECT ip, COUNT(*)::text AS c
       FROM visit_log
       WHERE ts > NOW() - INTERVAL '24 hours'
       GROUP BY ip
       ORDER BY COUNT(*) DESC
       LIMIT 10`
    ),
  ]);

  return {
    items: itemsRes.rows.map((r) => ({
      id: r.id,
      ip: maskIp(r.ip),
      path: r.path ?? undefined,
      ts: r.ts.toISOString(),
    })),
    count24h: parseInt(countRes.rows[0]?.c ?? "0", 10) || 0,
    topIps: topRes.rows.map((r) => ({
      ip: maskIp(r.ip),
      count: parseInt(r.c, 10) || 0,
    })),
  };
}

// ============================================================
// LOGIN BRUTE-FORCE PROTECTION
// ============================================================

const LOGIN_FAIL_THRESHOLD = 3; // fails in 1 hour → lock
const LOGIN_FAIL_WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window
const LOGIN_LOCK_MAX_HOURS = 24; // cap escalation at 24h

export interface LoginGate {
  allowed: boolean;
  reason?: string;
  lockedUntil?: string; // ISO
  minutesUntilUnlock?: number;
  failsInWindow?: number;
  failsRemaining?: number;
  lockCount?: number;
  nextLockHours?: number;
}

/**
 * Check whether an IP is currently allowed to attempt login.
 * Run BEFORE checking the password.
 */
export async function checkLoginAllowed(ip: string): Promise<LoginGate> {
  const pool = await getPool();
  if (!pool) {
    // Without a DB we can't track attempts → fail-open
    return { allowed: true };
  }
  await ensurePgSchema();

  // Hard IP block first
  const blocked = await isIpBlocked(ip);
  if (blocked) {
    const minutes = Math.max(
      1,
      Math.round((new Date(blocked.blockedUntil).getTime() - Date.now()) / 60000)
    );
    return {
      allowed: false,
      reason: `Your IP is blocked. ${blocked.reason}`,
      lockedUntil: blocked.blockedUntil,
      minutesUntilUnlock: minutes,
    };
  }

  const res = await pool.query<{
    fail_count: number;
    lock_count: number;
    locked_until: Date | null;
    last_fail: Date | null;
    reason: string | null;
  }>(
    "SELECT fail_count, lock_count, locked_until, last_fail, reason FROM login_attempts WHERE ip = $1",
    [ip]
  );

  if (res.rows.length === 0) {
    return {
      allowed: true,
      failsInWindow: 0,
      failsRemaining: LOGIN_FAIL_THRESHOLD,
      lockCount: 0,
    };
  }

  const row = res.rows[0];
  const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
  const now = new Date();

  if (lockedUntil && lockedUntil > now) {
    const minutes = Math.max(
      1,
      Math.round((lockedUntil.getTime() - now.getTime()) / 60000)
    );
    const nextLockHours = Math.min(
      LOGIN_LOCK_MAX_HOURS,
      (row.lock_count ?? 0) + 1
    );
    return {
      allowed: false,
      reason:
        row.reason ||
        `${LOGIN_FAIL_THRESHOLD} failed login attempts in 1 hour`,
      lockedUntil: lockedUntil.toISOString(),
      minutesUntilUnlock: minutes,
      failsInWindow: row.fail_count ?? 0,
      lockCount: row.lock_count ?? 0,
      nextLockHours,
    };
  }

  // Compute failures in the rolling window
  const lastFail = row.last_fail ? new Date(row.last_fail) : null;
  const inWindow =
    lastFail && now.getTime() - lastFail.getTime() < LOGIN_FAIL_WINDOW_MS
      ? row.fail_count ?? 0
      : 0;

  return {
    allowed: true,
    failsInWindow: inWindow,
    failsRemaining: Math.max(0, LOGIN_FAIL_THRESHOLD - inWindow),
    lockCount: row.lock_count ?? 0,
  };
}

/**
 * Record a failed login. Returns the gate state AFTER the increment.
 */
export async function recordFailedLogin(ip: string): Promise<LoginGate> {
  const pool = await getPool();
  if (!pool) return { allowed: true };
  await ensurePgSchema();

  // First, check current state
  const current = await pool.query<{
    fail_count: number;
    lock_count: number;
    last_fail: Date | null;
  }>(
    "SELECT fail_count, lock_count, last_fail FROM login_attempts WHERE ip = $1",
    [ip]
  );
  const now = new Date();
  let failCount = 0;
  let lockCount = 0;
  if (current.rows.length > 0) {
    const row = current.rows[0];
    lockCount = row.lock_count ?? 0;
    const lastFail = row.last_fail ? new Date(row.last_fail) : null;
    if (
      lastFail &&
      now.getTime() - lastFail.getTime() < LOGIN_FAIL_WINDOW_MS
    ) {
      failCount = (row.fail_count ?? 0) + 1;
    } else {
      failCount = 1; // reset window
    }
  } else {
    failCount = 1;
  }

  // Did we hit the lock threshold?
  if (failCount >= LOGIN_FAIL_THRESHOLD) {
    const newLockCount = lockCount + 1;
    const lockHours = Math.min(LOGIN_LOCK_MAX_HOURS, newLockCount); // 1h, 2h, 3h… cap 24h
    const lockedUntil = new Date(now.getTime() + lockHours * 60 * 60 * 1000);
    const reason = `${LOGIN_FAIL_THRESHOLD} failed login attempts within 1 hour`;
    await pool.query(
      `INSERT INTO login_attempts (ip, fail_count, lock_count, locked_until, last_fail, reason)
       VALUES ($1, 0, $2, $3, $4, $5)
       ON CONFLICT (ip) DO UPDATE
         SET fail_count = 0,
             lock_count = $2,
             locked_until = $3,
             last_fail = $4,
             reason = $5`,
      [ip, newLockCount, lockedUntil.toISOString(), now.toISOString(), reason]
    );
    const nextLockHours = Math.min(LOGIN_LOCK_MAX_HOURS, newLockCount + 1);
    return {
      allowed: false,
      reason,
      lockedUntil: lockedUntil.toISOString(),
      minutesUntilUnlock: lockHours * 60,
      failsInWindow: 0,
      lockCount: newLockCount,
      nextLockHours,
    };
  }

  // Just increment fail count
  await pool.query(
    `INSERT INTO login_attempts (ip, fail_count, lock_count, last_fail)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (ip) DO UPDATE
       SET fail_count = $2,
           last_fail = $3`,
    [ip, failCount, now.toISOString()]
  );

  return {
    allowed: true,
    failsInWindow: failCount,
    failsRemaining: LOGIN_FAIL_THRESHOLD - failCount,
    lockCount,
  };
}

/**
 * Record a successful login. Resets the fail counter (keeps lock_count
 * for 1 hour so a single correct guess doesn't reset the escalation,
 * but does unlock immediately so the legitimate user can keep working).
 */
export async function recordSuccessfulLogin(ip: string): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await ensurePgSchema();
  await pool.query(
    `INSERT INTO login_attempts (ip, fail_count, lock_count, locked_until, last_success)
     VALUES ($1, 0, 0, NULL, NOW())
     ON CONFLICT (ip) DO UPDATE
       SET fail_count = 0,
           locked_until = NULL,
           last_success = NOW()`,
    [ip]
  );
}

export interface LoginAttemptRecord {
  ip: string; // masked
  failCount: number;
  lockCount: number;
  lockedUntil?: string;
  lastFail?: string;
  lastSuccess?: string;
  reason?: string;
}

export async function getRecentLoginAttempts(): Promise<LoginAttemptRecord[]> {
  const pool = await getPool();
  if (!pool) return [];
  await ensurePgSchema();
  const res = await pool.query<{
    ip: string;
    fail_count: number;
    lock_count: number;
    locked_until: Date | null;
    last_fail: Date | null;
    last_success: Date | null;
    reason: string | null;
  }>(
    `SELECT ip, fail_count, lock_count, locked_until, last_fail, last_success, reason
     FROM login_attempts
     WHERE last_fail > NOW() - INTERVAL '7 days'
        OR locked_until > NOW()
     ORDER BY COALESCE(last_fail, last_success) DESC NULLS LAST
     LIMIT 50`
  );
  return res.rows.map((r) => ({
    ip: maskIp(r.ip),
    failCount: r.fail_count ?? 0,
    lockCount: r.lock_count ?? 0,
    lockedUntil: r.locked_until?.toISOString(),
    lastFail: r.last_fail?.toISOString(),
    lastSuccess: r.last_success?.toISOString(),
    reason: r.reason ?? undefined,
  }));
}

// ============================================================
// HARD IP BLOCKS
// ============================================================

export interface BlockedIpRecord {
  ip: string; // masked when shown
  blockedUntil: string;
  reason: string;
  blockedAt: string;
}

export async function blockIp(
  ip: string,
  hours: number,
  reason: string
): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await ensurePgSchema();
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await pool.query(
    `INSERT INTO blocked_ips (ip, blocked_until, reason, blocked_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (ip) DO UPDATE
       SET blocked_until = $2, reason = $3, blocked_at = NOW()`,
    [ip, until, reason.slice(0, 200)]
  );
}

export async function unblockIp(ip: string): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await ensurePgSchema();
  await pool.query("DELETE FROM blocked_ips WHERE ip = $1", [ip]);
}

export async function isIpBlocked(ip: string): Promise<
  { blockedUntil: string; reason: string } | null
> {
  const pool = await getPool();
  if (!pool) return null;
  await ensurePgSchema();
  const res = await pool.query<{ blocked_until: Date; reason: string }>(
    "SELECT blocked_until, reason FROM blocked_ips WHERE ip = $1 AND blocked_until > NOW()",
    [ip]
  );
  if (res.rows.length === 0) return null;
  return {
    blockedUntil: res.rows[0].blocked_until.toISOString(),
    reason: res.rows[0].reason,
  };
}

export async function getBlockedIps(): Promise<{
  active: BlockedIpRecord[];
  expired: BlockedIpRecord[];
}> {
  const pool = await getPool();
  if (!pool) return { active: [], expired: [] };
  await ensurePgSchema();
  // Auto-cleanup expired blocks older than 7 days
  await pool
    .query("DELETE FROM blocked_ips WHERE blocked_until < NOW() - INTERVAL '7 days'")
    .catch(() => null);
  const res = await pool.query<{
    ip: string;
    blocked_until: Date;
    reason: string;
    blocked_at: Date;
  }>(
    "SELECT ip, blocked_until, reason, blocked_at FROM blocked_ips ORDER BY blocked_at DESC LIMIT 100"
  );
  const now = new Date();
  const active: BlockedIpRecord[] = [];
  const expired: BlockedIpRecord[] = [];
  for (const r of res.rows) {
    const rec: BlockedIpRecord = {
      ip: maskIp(r.ip),
      blockedUntil: r.blocked_until.toISOString(),
      reason: r.reason,
      blockedAt: r.blocked_at.toISOString(),
    };
    if (r.blocked_until > now) active.push(rec);
    else expired.push(rec);
  }
  return { active, expired };
}

/**
 * Lookup the un-masked block info for a given IP (for the manual unblock action).
 * The admin endpoint passes the masked IP back, but we need the real one to
 * delete from the table. We do a LIKE match on the un-masked stem.
 */
export async function unblockMaskedIp(maskedIp: string): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;
  await ensurePgSchema();

  // Validate input shape — only digits, dots, colons, hex chars,
  // optional asterisks, and percent signs.
  if (!/^[0-9a-fA-F.:%*]+$/.test(maskedIp) || maskedIp.length > 64) {
    return 0;
  }

  // Escape any pre-existing % or _ that the user might have typed,
  // THEN turn our masking asterisks into a single-char or multi-char
  // wildcard (`%`). This prevents pattern-injection like `%` matching
  // every row.
  const escaped = maskedIp.replace(/[\\%_]/g, (m) => "\\" + m);
  const stem = escaped.replace(/\*+/g, "%");

  const res = await pool.query(
    "DELETE FROM blocked_ips WHERE ip LIKE $1 ESCAPE '\\'",
    [stem]
  );
  return res.rowCount ?? 0;
}
