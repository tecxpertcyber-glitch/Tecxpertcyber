// ============================================================
// PERSISTENT STORAGE LAYER
// ============================================================
// Priority 1: Postgres / Supabase (persists forever - best choice)
// Priority 2: Upstash Redis (persists forever on Vercel)
// Priority 3: JSON file (local dev, resets on Vercel deploys)
// ============================================================

import { Redis } from "@upstash/redis";
import { Pool } from "pg";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { readRuntimeDbConfig } from "./db-config";

// In-memory cache for the runtime config so we don't read the file on every request.
let runtimeConfigCache: { postgresUrl?: string; redisUrl?: string; redisToken?: string } | null | undefined = undefined;
let runtimeConfigLoading: Promise<void> | null = null;

async function loadRuntimeConfig(): Promise<void> {
  if (runtimeConfigCache !== undefined) return;
  if (runtimeConfigLoading) return runtimeConfigLoading;
  runtimeConfigLoading = (async () => {
    try {
      const cfg = await readRuntimeDbConfig();
      runtimeConfigCache = cfg
        ? { postgresUrl: cfg.postgresUrl, redisUrl: cfg.redisUrl, redisToken: cfg.redisToken }
        : null;
    } catch {
      runtimeConfigCache = null;
    }
  })();
  return runtimeConfigLoading;
}

/**
 * Async helper called before any DB operation: ensures the runtime config
 * file (if any) has been loaded so detection picks up admin-panel creds.
 */
export async function ensureBackendsReady(): Promise<void> {
  await loadRuntimeConfig();
}

// resetStorageDetection() is defined at the end of this file (it needs
// access to all the cache variables declared further down).

// ── Types ───────────────────────────────────────────────────

export interface JsonCategory {
  id: number;
  title: string;
  iconName: string;
  color: string;
  bg: string;
  sortOrder: number;
}

export interface JsonService {
  id: number;
  categoryId: number;
  name: string;
  price: string;
  sortOrder: number;
}

export interface JsonAdminSetting {
  id: number;
  passwordHash: string;
  /**
   * Token-version counter — included as `tv` in every issued JWT.
   * Bumping it (e.g. on "Logout from all devices" or password change)
   * invalidates every previously-issued token.
   */
  tokenVersion?: number;
}

/**
 * SiteSettings — every customer-facing piece of branding & contact info
 * the admin can edit from the panel without touching code.
 */
export interface SiteSettings {
  // Branding
  name: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  // Contact
  phone: string;
  whatsappNumber: string; // digits only, no '+'
  emails: string[]; // multiple emails supported
  location: string;
  // Customer-facing CTAs
  ctaLabel: string;
  // Optional social
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  // Footer text
  footerNote?: string;
  // ─── Customer-page section copy (editable from admin) ─────
  servicesHeroTitle?: string;          // e.g. "TECXPERT CYBER SERVICES"
  servicesHeroSubtitle?: string;
  whyTitle?: string;                   // "Why Choose Tecxpert?"
  whySubtitle?: string;                // "We make complicated processes simple…"
  whyFeature1Title?: string;           // "Reliable & Secure"
  whyFeature1Desc?: string;
  whyFeature2Title?: string;           // "Extremely Fast"
  whyFeature2Desc?: string;
  whyFeature3Title?: string;           // "Best Prices"
  whyFeature3Desc?: string;
  ctaSectionTitle?: string;            // "Ready to get started?"
  ctaSectionSubtitle?: string;         // "Don't wait in long queues…"
  // ─── M-Pesa Payment Settings ──────────────────────────────
  mpesaEnabled?: boolean;             // master toggle for "Pay first" option
  mpesaPaybill?: string;              // displayed paybill (e.g. "880100")
  mpesaAccountNumber?: string;        // displayed account number (e.g. "111181")
  mpesaInstructions?: string;         // optional extra notes for the customer
  // Daraja STK Push credentials (optional; demo mode without them)
  mpesaShortcode?: string;            // STK push shortcode (often = paybill)
  mpesaConsumerKey?: string;          // Safaricom Daraja consumer key
  mpesaConsumerSecret?: string;       // Safaricom Daraja consumer secret
  mpesaPasskey?: string;              // Lipa Na M-Pesa Online passkey
  mpesaEnv?: "sandbox" | "production"; // which Daraja API to hit
}

export interface JsonDb {
  categories: JsonCategory[];
  services: JsonService[];
  admin_settings: JsonAdminSetting[];
  site_settings?: SiteSettings;
  _meta: { lastId: Record<string, number> };
}

export interface VisitorStats {
  uniqueIps: string[];
  totalPageViews: number;
  lastVisit: string;
}

// ── Storage backend detection ────────────────────────────────

let pgPool: Pool | null = null;
let pgInitialized = false;
let pgSchemaReady: Promise<void> | null = null;
let pgUrlSource: string | null = null;

/**
 * Auto-detect a Postgres connection string from any of the env vars
 * that Vercel database integrations inject. Order = preference:
 *   1. DATABASE_URL          (manual / generic)
 *   2. POSTGRES_URL          (Vercel Postgres / Neon / Supabase integration — pooled)
 *   3. POSTGRES_PRISMA_URL   (Vercel Postgres — pooled w/ pgbouncer params)
 *   4. POSTGRES_URL_NON_POOLING (direct connection — last resort)
 */
function detectPostgresUrl(): { url: string; source: string } | null {
  // 1) Try the standard names first (priority order)
  const preferred: Array<[string, string | undefined]> = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL],
    ["POSTGRES_URL_NON_POOLING", process.env.POSTGRES_URL_NON_POOLING],
  ];
  for (const [name, value] of preferred) {
    if (value && /^postgres(ql)?:\/\//i.test(value)) {
      return { url: value, source: name };
    }
  }

  // 2) Fall back to scanning ALL env vars for one whose name LOOKS like a
  //    Postgres connection string holder AND whose value actually starts
  //    with `postgres://`. Common via Vercel marketplace prefixes:
  //      STORAGE_POSTGRES_URL, MYDB_DATABASE_URL, etc.
  for (const [name, raw] of Object.entries(process.env)) {
    if (!raw || typeof raw !== "string") continue;
    if (!/^postgres(ql)?:\/\//i.test(raw)) continue;
    // Only accept env vars whose name clearly suggests a postgres URL.
    // This prevents picking up e.g. SUPABASE_SERVICE_ROLE_KEY (a JWT).
    if (!/(POSTGRES|DATABASE|PG)/i.test(name)) continue;
    if (/(KEY|SECRET|TOKEN|PASSWORD|PASSKEY|JWT|ANON)/i.test(name)) continue;
    return { url: raw, source: name };
  }

  // 3) Runtime config saved via the admin panel wizard
  if (runtimeConfigCache?.postgresUrl?.startsWith("postgres")) {
    return { url: runtimeConfigCache.postgresUrl, source: "admin-panel" };
  }
  return null;
}

function getPg(): Pool | null {
  if (pgInitialized) return pgPool;
  pgInitialized = true;

  const detected = detectPostgresUrl();
  if (!detected) {
    pgPool = null;
    return null;
  }

  pgUrlSource = detected.source;
  const url = detected.url;

  try {
    // Supabase / Neon / Vercel Postgres all require SSL.
    pgPool = new Pool({
      connectionString: url,
      ssl: url.includes("localhost") || url.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
    });
    return pgPool;
  } catch {
    pgPool = null;
    return null;
  }
}

export function getPgSource(): string | null {
  getPg();
  return pgUrlSource;
}

export async function ensurePgSchema(): Promise<void> {
  if (pgSchemaReady) return pgSchemaReady;
  const pool = getPg();
  if (!pool) return;
  pgSchemaReady = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visitor_ips (
        ip TEXT PRIMARY KEY,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visitor_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // Separate table for IPs that visited the admin panel (NOT the same
    // as login_attempts — those are people who tried to log in. This is
    // anyone who simply loaded /admin in their browser.)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_visitor_ips (
        ip TEXT PRIMARY KEY,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id BIGSERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        ip TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS suggestions_created_at_idx ON suggestions (created_at DESC);`
    );
    // ─── Security tables ───
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visit_log (
        id BIGSERIAL PRIMARY KEY,
        ip TEXT NOT NULL,
        path TEXT,
        user_agent TEXT,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS visit_log_ts_idx ON visit_log (ts DESC);`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS visit_log_ip_ts_idx ON visit_log (ip, ts DESC);`
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        ip TEXT PRIMARY KEY,
        fail_count INTEGER NOT NULL DEFAULT 0,
        lock_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_fail TIMESTAMPTZ,
        last_success TIMESTAMPTZ,
        reason TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_ips (
        ip TEXT PRIMARY KEY,
        blocked_until TIMESTAMPTZ NOT NULL,
        reason TEXT NOT NULL,
        blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  })();
  return pgSchemaReady;
}

let redisClient: Redis | null | undefined = undefined;
let redisSource: string | null = null;

/**
 * Auto-detect Upstash REST credentials from either:
 *   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (Upstash direct)
 *   - KV_REST_API_URL / KV_REST_API_TOKEN                (Vercel KV integration)
 */
function detectRedisCreds(): { url: string; token: string; source: string } | null {
  // 1) Try the standard names first
  const preferred: Array<[string, string | undefined, string | undefined]> = [
    [
      "UPSTASH_REDIS_REST_URL",
      process.env.UPSTASH_REDIS_REST_URL,
      process.env.UPSTASH_REDIS_REST_TOKEN,
    ],
    [
      "KV_REST_API_URL",
      process.env.KV_REST_API_URL,
      process.env.KV_REST_API_TOKEN,
    ],
  ];
  for (const [name, url, tok] of preferred) {
    if (url && tok) return { url, token: tok, source: name };
  }

  // 2) Scan ALL env vars for any pair that looks like a Redis REST URL +
  //    matching token. This catches Vercel marketplace prefixes like
  //    UPSTASH_KV_REST_API_URL, MYAPP_KV_REST_API_TOKEN, etc.
  const env = process.env;
  for (const [name, raw] of Object.entries(env)) {
    if (!raw || typeof raw !== "string") continue;
    if (!/^https?:\/\//i.test(raw)) continue;
    // Accept names that look like a Redis URL holder
    if (!/(REDIS|KV)/i.test(name)) continue;
    if (!/(URL|REST_API)/i.test(name)) continue;
    if (/(TOKEN|KEY|SECRET|PASSWORD)/i.test(name)) continue;
    // Find a matching token by replacing URL→TOKEN in the env-var name
    const tokenName = name
      .replace(/_URL$/i, "_TOKEN")
      .replace(/_REST_API_URL$/i, "_REST_API_TOKEN");
    const token = env[tokenName];
    if (token) return { url: raw, token, source: name };
  }

  // 3) Runtime config saved via the admin panel wizard
  if (runtimeConfigCache?.redisUrl && runtimeConfigCache?.redisToken) {
    return {
      url: runtimeConfigCache.redisUrl,
      token: runtimeConfigCache.redisToken,
      source: "admin-panel",
    };
  }
  return null;
}

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const creds = detectRedisCreds();
  if (creds) {
    try {
      redisClient = new Redis({ url: creds.url, token: creds.token });
      redisSource = creds.source;
      return redisClient;
    } catch {
      redisClient = null;
      return null;
    }
  }

  redisClient = null;
  return null;
}

export function getRedisSource(): string | null {
  getRedis();
  return redisSource;
}

export function getStorageBackend(): "postgres" | "upstash-redis" | "json-file" {
  if (getPg()) return "postgres";
  if (getRedis()) return "upstash-redis";
  return "json-file";
}

/**
 * Synchronous backend-type check. NOTE: this only tells you the configured
 * backend, NOT whether it's actually reachable. Use `verifyStorageLive()`
 * for the real status.
 */
export function isStoragePersistent(): boolean {
  const backend = getStorageBackend();
  return backend === "postgres" || backend === "upstash-redis";
}

// ── Live storage verification (no false positives) ──────────

interface LiveStatus {
  backend: "postgres" | "upstash-redis" | "json-file";
  alive: boolean;        // did the actual DB respond?
  persistent: boolean;   // alive AND persistent backend
  source: string | null; // where the connection string came from
  error?: string;        // human-readable error if not alive
  checkedAt: string;     // ISO timestamp of the probe
}

let liveStatusCache: { value: LiveStatus; ts: number } | null = null;
const LIVE_CACHE_MS = 15 * 1000; // re-probe at most every 15s

/**
 * Actually pings the configured backend and returns its real status.
 * Cached for 15 seconds so admin polling doesn't hammer the DB.
 *
 * This is the truth. Use this instead of `isStoragePersistent()` whenever
 * you display "DB connected?" to a human.
 */
export async function verifyStorageLive(force = false): Promise<LiveStatus> {
  if (!force && liveStatusCache && Date.now() - liveStatusCache.ts < LIVE_CACHE_MS) {
    return liveStatusCache.value;
  }
  await ensureBackendsReady();
  const backend = getStorageBackend();
  const source =
    backend === "postgres"
      ? pgUrlSource
      : backend === "upstash-redis"
        ? redisSource
        : null;

  let alive = false;
  let error: string | undefined;

  if (backend === "postgres") {
    const pool = getPg();
    if (pool) {
      try {
        const res = await pool.query<{ ok: number }>("SELECT 1 AS ok");
        alive = res.rows[0]?.ok === 1;
        if (!alive) error = "Unexpected response from DB";
      } catch (e) {
        alive = false;
        error = e instanceof Error ? e.message : "Unknown DB error";
      }
    } else {
      error = "Pool not initialised";
    }
  } else if (backend === "upstash-redis") {
    const redis = getRedis();
    if (redis) {
      try {
        const r = await redis.ping();
        alive = r === "PONG" || r === "pong";
        if (!alive) error = `Unexpected ping reply: ${String(r)}`;
      } catch (e) {
        alive = false;
        error = e instanceof Error ? e.message : "Unknown Redis error";
      }
    }
  } else {
    // json-file: check we can read+write
    try {
      const db = await readDb();
      alive = !!db;
    } catch (e) {
      alive = false;
      error = e instanceof Error ? e.message : "JSON file unreachable";
    }
  }

  const status: LiveStatus = {
    backend,
    alive,
    // persistent = alive AND backend is durable (postgres/redis, not json-file)
    persistent: alive && (backend === "postgres" || backend === "upstash-redis"),
    source,
    error,
    checkedAt: new Date().toISOString(),
  };
  liveStatusCache = { value: status, ts: Date.now() };
  return status;
}

/**
 * Invalidate the cached live status — call after the admin connects/disconnects
 * a database via the wizard so the next probe runs immediately.
 */
export function invalidateLiveStatusCache(): void {
  liveStatusCache = null;
}

// ── JSON file fallback ───────────────────────────────────────

const DB_DIR_LOCAL = path.join(process.cwd(), "data");
const DB_FILE_LOCAL = path.join(DB_DIR_LOCAL, "db.json");
const DB_FILE_TMP = "/tmp/tecxpert-db.json";

let dbPathCache: string | null = null;

async function resolveDbPath(): Promise<string> {
  if (dbPathCache) return dbPathCache;
  try {
    await fs.access(DB_DIR_LOCAL);
    const testFile = path.join(DB_DIR_LOCAL, ".write-test");
    await fs.writeFile(testFile, "", { flag: "wx" });
    await fs.unlink(testFile);
    dbPathCache = DB_FILE_LOCAL;
  } catch {
    dbPathCache = DB_FILE_TMP;
  }
  return dbPathCache;
}

let writeLock: Promise<void> = Promise.resolve();

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const wait = new Promise<void>((r) => { release = r; });
  const prev = writeLock;
  writeLock = prev.then(() => wait);
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

async function readJsonDb(): Promise<JsonDb> {
  const dbPath = await resolveDbPath();
  try {
    const raw = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    const fresh = getInitialDb();
    const hash = await bcrypt.hash("cyber", 10);
    fresh.admin_settings[0].passwordHash = hash;
    await writeJsonDb(fresh);
    return fresh;
  }
}

async function writeJsonDb(data: JsonDb): Promise<void> {
  await withLock(async () => {
    const dbPath = await resolveDbPath();
    const dir = path.dirname(dbPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    const tmp = `${dbPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmp, dbPath);
  });
}

// ── Redis helpers ────────────────────────────────────────────

async function readRedisDb(): Promise<JsonDb> {
  const redis = getRedis()!;
  const raw = await redis.get<string>("db");
  if (raw) {
    // Upstash may auto-parse JSON; handle both cases
    return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as JsonDb);
  }
  const fresh = getInitialDb();
  const hash = await bcrypt.hash("cyber", 10);
  fresh.admin_settings[0].passwordHash = hash;
  await redis.set("db", JSON.stringify(fresh));
  return fresh;
}

async function writeRedisDb(data: JsonDb): Promise<void> {
  const redis = getRedis()!;
  await redis.set("db", JSON.stringify(data));
}

// ── Postgres helpers ─────────────────────────────────────────

async function readPgDb(): Promise<JsonDb> {
  const pool = getPg()!;
  await ensurePgSchema();
  const res = await pool.query<{ value: JsonDb }>(
    "SELECT value FROM kv_store WHERE key = $1",
    ["db"]
  );
  if (res.rows.length > 0 && res.rows[0].value) {
    return res.rows[0].value;
  }
  const fresh = getInitialDb();
  const hash = await bcrypt.hash("cyber", 10);
  fresh.admin_settings[0].passwordHash = hash;
  await writePgDb(fresh);
  return fresh;
}

async function writePgDb(data: JsonDb): Promise<void> {
  const pool = getPg()!;
  await ensurePgSchema();
  await pool.query(
    `INSERT INTO kv_store (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    ["db", JSON.stringify(data)]
  );
}

// ── Unified read/write ───────────────────────────────────────

export async function readDb(): Promise<JsonDb> {
  await ensureBackendsReady();
  if (getPg()) return readPgDb();
  if (getRedis()) return readRedisDb();
  return readJsonDb();
}

async function writeDb(data: JsonDb): Promise<void> {
  await ensureBackendsReady();
  if (getPg()) return writePgDb(data);
  if (getRedis()) return writeRedisDb(data);
  return writeJsonDb(data);
}

/**
 * Direct write — used during database migrations to overwrite the
 * destination backend with a snapshot from the previous backend.
 */
export async function writeDbDirect(data: JsonDb): Promise<void> {
  return writeDb(data);
}

// ── Collection helpers ───────────────────────────────────────

export async function getCollection<T extends keyof JsonDb>(
  name: T
): Promise<JsonDb[T]> {
  const db = await readDb();
  return db[name];
}

export async function find<T>(
  name: keyof JsonDb,
  predicate: (item: T) => boolean
): Promise<T[]> {
  const db = await readDb();
  return ((db[name] as unknown) as T[]).filter(predicate);
}

export async function findOne<T>(
  name: keyof JsonDb,
  predicate: (item: T) => boolean
): Promise<T | null> {
  const db = await readDb();
  return ((db[name] as unknown) as T[]).find(predicate) ?? null;
}

export async function insert<T>(
  name: keyof JsonDb,
  item: Omit<T, "id">
): Promise<T> {
  const db = await readDb();
  const collection = (db[name] as unknown) as T[];
  const nextId = (db._meta.lastId[name] ?? 0) + 1;
  db._meta.lastId[name] = nextId;
  const newItem = { id: nextId, ...item } as unknown as T;
  collection.push(newItem);
  await writeDb(db);
  return newItem;
}

export async function update<T>(
  name: keyof JsonDb,
  predicate: (item: T) => boolean,
  updates: Partial<T>
): Promise<number> {
  const db = await readDb();
  const collection = (db[name] as unknown) as T[];
  let count = 0;
  for (const item of collection) {
    if (predicate(item)) {
      Object.assign(item as object, updates);
      count++;
    }
  }
  if (count > 0) await writeDb(db);
  return count;
}

export async function remove<T>(
  name: keyof JsonDb,
  predicate: (item: T) => boolean
): Promise<number> {
  const db = await readDb();
  const collection = (db[name] as unknown) as T[];
  const before = collection.length;
  const filtered = collection.filter((i) => !predicate(i));
  if (filtered.length !== before) {
    (db[name] as unknown) = filtered;
    await writeDb(db);
  }
  return before - filtered.length;
}

export async function ensureDbInitialized(): Promise<void> {
  const db = await readDb();
  let mutated = false;
  const settings = db.admin_settings[0];
  if (settings && settings.passwordHash.includes("placeholder")) {
    settings.passwordHash = await bcrypt.hash("cyber", 10);
    mutated = true;
  }
  // Backfill site settings if missing (new feature on existing DB)
  if (!db.site_settings) {
    db.site_settings = getDefaultSiteSettings();
    mutated = true;
  }
  // Backfill tokenVersion if missing (new feature on existing DB)
  if (settings && settings.tokenVersion === undefined) {
    settings.tokenVersion = 1;
    mutated = true;
  }
  if (mutated) await writeDb(db);
}

// ── Admin token-version helpers (for "Logout from all devices") ──

/** Get the current admin token version (defaults to 1). */
export async function getAdminTokenVersion(): Promise<number> {
  const db = await readDb();
  return db.admin_settings[0]?.tokenVersion ?? 1;
}

/** Bump the admin token version → invalidates every previously-issued token. */
export async function bumpAdminTokenVersion(): Promise<number> {
  const db = await readDb();
  const settings = db.admin_settings[0];
  if (!settings) throw new Error("admin not configured");
  settings.tokenVersion = (settings.tokenVersion ?? 1) + 1;
  await writeDb(db);
  return settings.tokenVersion;
}

// ── Site settings helpers ────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings> {
  const db = await readDb();
  // Merge with defaults so new fields (added in code updates) are present
  // even on existing rows that were stored before the field existed.
  const defaults = getDefaultSiteSettings();
  return { ...defaults, ...(db.site_settings ?? {}) };
}

export async function updateSiteSettings(
  updates: Partial<SiteSettings>
): Promise<SiteSettings> {
  const db = await readDb();
  // Merge defaults first so newly-added fields (like mpesaEnabled) are
  // populated for existing rows that were saved before the field existed.
  const current = { ...getDefaultSiteSettings(), ...(db.site_settings ?? {}) };
  const next: SiteSettings = { ...current, ...updates };
  // Sanitize WhatsApp number: digits only
  if (typeof updates.whatsappNumber === "string") {
    next.whatsappNumber = updates.whatsappNumber.replace(/\D/g, "");
  }
  // Filter & dedupe emails
  if (Array.isArray(updates.emails)) {
    next.emails = Array.from(
      new Set(updates.emails.map((e) => e.trim()).filter(Boolean))
    );
  }
  db.site_settings = next;
  await writeDb(db);
  return next;
}

export function getDefaultSiteSettings(): SiteSettings {
  return {
    name: "Tecxpert Cyber Services",
    tagline: "Fast. Reliable. Affordable.",
    heroTitle: "TECXPERT CYBER SERVICES",
    heroSubtitle:
      "Fast, reliable, and affordable digital solutions for all your business, government, and personal documentation needs.",
    phone: "+254 702 988155",
    whatsappNumber: "254702988155",
    emails: ["tecxpertcyber@gmail.com"],
    location: "Kenya",
    ctaLabel: "Order on WhatsApp",
    footerNote: "",
    // Section copy defaults
    servicesHeroTitle: "TECXPERT CYBER SERVICES",
    servicesHeroSubtitle:
      "Fast, reliable, and affordable digital solutions for all your business, government, and personal documentation needs.",
    whyTitle: "Why Choose Us?",
    whySubtitle: "We make complicated processes simple and fast.",
    whyFeature1Title: "Reliable & Secure",
    whyFeature1Desc:
      "Your documents and data are handled with the utmost security and confidentiality.",
    whyFeature2Title: "Extremely Fast",
    whyFeature2Desc:
      "We value your time. Most services are completed within minutes or hours.",
    whyFeature3Title: "Best Prices",
    whyFeature3Desc:
      "Quality service doesn't have to be expensive. We offer the most competitive rates.",
    ctaSectionTitle: "Ready to get started?",
    ctaSectionSubtitle:
      "Don't wait in long queues. Contact us today and let us handle the paperwork for you!",
    // Payment defaults
    mpesaEnabled: true,
    mpesaPaybill: "880100",
    mpesaAccountNumber: "111181",
    mpesaInstructions:
      "Pay via M-Pesa. After payment, send your order via WhatsApp.",
    mpesaShortcode: "880100",
    mpesaEnv: "sandbox",
  };
}

// ── Visitor tracking ─────────────────────────────────────────

export type VisitKind = "visitor" | "admin" | "internal";

export async function trackVisitor(
  ip: string,
  kind: VisitKind = "visitor"
): Promise<VisitorStats> {
  // Decide which table/key to use based on the kind:
  //   - "admin"    → admin_visitor_ips (separate from customers)
  //   - "internal" → not tracked at all
  //   - "visitor"  → normal visitor_ips (customer-facing)
  if (kind === "internal") {
    return getVisitorStats();
  }

  const ipsTable = kind === "admin" ? "admin_visitor_ips" : "visitor_ips";
  const redisIpsKey = kind === "admin" ? "admin:ips" : "visitors:ips";

  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO ${ipsTable} (ip, first_seen, last_seen)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (ip) DO UPDATE SET last_seen = NOW()`,
      [ip]
    );
    if (kind === "visitor") {
      // Only customer page-views increment the public counters
      await pool.query(
        `INSERT INTO visitor_meta (key, value)
         VALUES ('pageViews', '1')
         ON CONFLICT (key) DO UPDATE SET value = (COALESCE(visitor_meta.value::int, 0) + 1)::text`
      );
      await pool.query(
        `INSERT INTO visitor_meta (key, value) VALUES ('lastVisit', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [now]
      );
    }
    return getVisitorStats();
  }

  const redis = getRedis();
  if (redis) {
    const viewsKey = "visitors:pageViews";
    const lastKey = "visitors:lastVisit";
    const now = new Date().toISOString();

    await redis.sadd(redisIpsKey, ip);
    if (kind === "visitor") {
      await redis.incr(viewsKey);
      await redis.set(lastKey, now);
    }

    const members = await redis.smembers("visitors:ips");
    const views = await redis.get<number>(viewsKey);

    return {
      uniqueIps: members,
      totalPageViews: views ?? 0,
      lastVisit: now,
    };
  }

  // Fallback: in-memory (resets each invocation)
  return { uniqueIps: [ip], totalPageViews: 1, lastVisit: new Date().toISOString() };
}

/** Read just the admin-visitor list (people who loaded /admin). */
export async function getAdminVisitors(): Promise<{ ip: string; firstSeen?: string; lastSeen?: string }[]> {
  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    const res = await pool.query<{ ip: string; first_seen: Date; last_seen: Date }>(
      "SELECT ip, first_seen, last_seen FROM admin_visitor_ips ORDER BY last_seen DESC LIMIT 100"
    );
    return res.rows.map((r) => ({
      ip: r.ip,
      firstSeen: r.first_seen?.toISOString?.(),
      lastSeen: r.last_seen?.toISOString?.(),
    }));
  }
  const redis = getRedis();
  if (redis) {
    const ips = await redis.smembers("admin:ips");
    return ips.map((ip) => ({ ip }));
  }
  return [];
}

export async function getVisitorStats(): Promise<VisitorStats> {
  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    const [ipsRes, viewsRes, lastRes] = await Promise.all([
      pool.query<{ ip: string }>("SELECT ip FROM visitor_ips"),
      pool.query<{ value: string }>("SELECT value FROM visitor_meta WHERE key = 'pageViews'"),
      pool.query<{ value: string }>("SELECT value FROM visitor_meta WHERE key = 'lastVisit'"),
    ]);
    return {
      uniqueIps: ipsRes.rows.map((r) => r.ip),
      totalPageViews: viewsRes.rows[0] ? parseInt(viewsRes.rows[0].value, 10) || 0 : 0,
      lastVisit: lastRes.rows[0]?.value ?? "",
    };
  }

  const redis = getRedis();
  if (redis) {
    const [members, views, lastVisit] = await Promise.all([
      redis.smembers("visitors:ips"),
      redis.get<number>("visitors:pageViews"),
      redis.get<string>("visitors:lastVisit"),
    ]);
    return {
      uniqueIps: members,
      totalPageViews: views ?? 0,
      lastVisit: lastVisit ?? "",
    };
  }

  return { uniqueIps: [], totalPageViews: 0, lastVisit: "" };
}

/**
 * Detailed visitor list for the admin panel — includes first/last seen
 * timestamps when available (Postgres only). For Redis/JSON fallback
 * we just return the IPs.
 */
export interface DetailedVisitor {
  ip: string;
  firstSeen?: string;
  lastSeen?: string;
}

export interface DetailedVisitorReport {
  visitors: DetailedVisitor[];
  totalUnique: number;
  totalPageViews: number;
  lastVisit: string;
  visitorsToday: number;
  visitorsThisWeek: number;
}

function maskIp(ip: string): string {
  // IP masking DISABLED — show full IPs in admin views.
  return ip || "unknown";
}

export async function getDetailedVisitors(): Promise<DetailedVisitorReport> {
  const pool = getPg();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  if (pool) {
    await ensurePgSchema();
    const [allRes, todayRes, weekRes, viewsRes, lastRes] = await Promise.all([
      pool.query<{ ip: string; first_seen: Date; last_seen: Date }>(
        "SELECT ip, first_seen, last_seen FROM visitor_ips ORDER BY last_seen DESC LIMIT 100"
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM visitor_ips WHERE last_seen >= $1",
        [dayAgo]
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM visitor_ips WHERE last_seen >= $1",
        [weekAgo]
      ),
      pool.query<{ value: string }>(
        "SELECT value FROM visitor_meta WHERE key = 'pageViews'"
      ),
      pool.query<{ value: string }>(
        "SELECT value FROM visitor_meta WHERE key = 'lastVisit'"
      ),
    ]);
    return {
      visitors: allRes.rows.map((r) => ({
        ip: maskIp(r.ip),
        firstSeen: r.first_seen?.toISOString?.() ?? String(r.first_seen),
        lastSeen: r.last_seen?.toISOString?.() ?? String(r.last_seen),
      })),
      totalUnique: allRes.rowCount ?? 0,
      totalPageViews: viewsRes.rows[0] ? parseInt(viewsRes.rows[0].value, 10) || 0 : 0,
      lastVisit: lastRes.rows[0]?.value ?? "",
      visitorsToday: parseInt(todayRes.rows[0]?.count ?? "0", 10) || 0,
      visitorsThisWeek: parseInt(weekRes.rows[0]?.count ?? "0", 10) || 0,
    };
  }

  // Redis / JSON fallback — no per-visitor timestamps
  const stats = await getVisitorStats();
  return {
    visitors: stats.uniqueIps.map((ip) => ({ ip: maskIp(ip) })),
    totalUnique: stats.uniqueIps.length,
    totalPageViews: stats.totalPageViews,
    lastVisit: stats.lastVisit,
    visitorsToday: 0,
    visitorsThisWeek: 0,
  };
}

// ── Initial data ────────────────────────────────────────────

function getInitialDb(): JsonDb {
  return {
    categories: [
      { id: 1, title: "Business & Legal", iconName: "Briefcase", color: "text-blue-400", bg: "bg-blue-400/10", sortOrder: 1 },
      { id: 2, title: "Government & Identity", iconName: "ShieldCheck", color: "text-emerald-400", bg: "bg-emerald-400/10", sortOrder: 2 },
      { id: 3, title: "Travel & Immigration", iconName: "Globe", color: "text-amber-400", bg: "bg-amber-400/10", sortOrder: 3 },
      { id: 4, title: "Education & Career", iconName: "GraduationCap", color: "text-purple-400", bg: "bg-purple-400/10", sortOrder: 4 },
      { id: 5, title: "Printing & Design", iconName: "Printer", color: "text-rose-400", bg: "bg-rose-400/10", sortOrder: 5 },
      { id: 6, title: "Digital & Creative", iconName: "Laptop", color: "text-cyan-400", bg: "bg-cyan-400/10", sortOrder: 6 },
      { id: 7, title: "Driving & Transport", iconName: "CreditCard", color: "text-orange-400", bg: "bg-orange-400/10", sortOrder: 7 },
      { id: 8, title: "Other Services", iconName: "MousePointer2", color: "text-slate-400", bg: "bg-slate-400/10", sortOrder: 8 },
    ],
    services: [
      { id: 1, categoryId: 1, name: "Business Registration", price: "500", sortOrder: 1 },
      { id: 2, categoryId: 1, name: "VAT / Rental Renewals", price: "300", sortOrder: 2 },
      { id: 3, categoryId: 1, name: "Motor Vehicle Transfer", price: "400", sortOrder: 3 },
      { id: 4, categoryId: 1, name: "AGPO Registration", price: "500", sortOrder: 4 },
      { id: 5, categoryId: 1, name: "Tax Compliance Certificate", price: "500", sortOrder: 5 },
      { id: 6, categoryId: 1, name: "CR 12 Application", price: "300", sortOrder: 6 },
      { id: 7, categoryId: 1, name: "Marriage Certificate", price: "500", sortOrder: 7 },
      { id: 8, categoryId: 1, name: "KRA Returns", price: "200", sortOrder: 8 },
      { id: 9, categoryId: 2, name: "KRA PIN Registration", price: "200", sortOrder: 1 },
      { id: 10, categoryId: 2, name: "SHA Application", price: "200", sortOrder: 2 },
      { id: 11, categoryId: 2, name: "NSSF Application", price: "200", sortOrder: 3 },
      { id: 12, categoryId: 2, name: "Good Conduct Certificate", price: "150", sortOrder: 4 },
      { id: 13, categoryId: 2, name: "ID Card Application", price: "150", sortOrder: 5 },
      { id: 14, categoryId: 2, name: "Huduma Booking", price: "50", sortOrder: 6 },
      { id: 15, categoryId: 2, name: "TSC Number", price: "300", sortOrder: 7 },
      { id: 16, categoryId: 2, name: "Food Handler Certificate", price: "300", sortOrder: 8 },
      { id: 17, categoryId: 3, name: "Visa Application", price: "600", sortOrder: 1 },
      { id: 18, categoryId: 3, name: "Passport Application", price: "600", sortOrder: 2 },
      { id: 19, categoryId: 3, name: "East Africa Passport", price: "600", sortOrder: 3 },
      { id: 20, categoryId: 3, name: "USA Green Card Application", price: "300", sortOrder: 4 },
      { id: 21, categoryId: 4, name: "HELB Application", price: "350", sortOrder: 1 },
      { id: 22, categoryId: 4, name: "Student Project / Business Plan", price: "Contact us", sortOrder: 2 },
      { id: 23, categoryId: 5, name: "Digital Passport Photo (2)", price: "50", sortOrder: 1 },
      { id: 24, categoryId: 5, name: "Digital Passport Photo (4)", price: "100", sortOrder: 2 },
      { id: 25, categoryId: 5, name: "Photo Printing (4×6)", price: "50", sortOrder: 3 },
      { id: 26, categoryId: 5, name: "Lamination", price: "50", sortOrder: 4 },
      { id: 27, categoryId: 5, name: "Binding (50 pages)", price: "100", sortOrder: 5 },
      { id: 28, categoryId: 5, name: "Scanning (per page)", price: "20", sortOrder: 6 },
      { id: 29, categoryId: 5, name: "Printing (color, per page)", price: "20", sortOrder: 7 },
      { id: 30, categoryId: 5, name: "Photocopy (per page)", price: "5", sortOrder: 8 },
      { id: 31, categoryId: 5, name: "Typing (per page)", price: "50", sortOrder: 9 },
      { id: 32, categoryId: 6, name: "Web Design", price: "800", sortOrder: 1 },
      { id: 33, categoryId: 6, name: "Software Solution", price: "400", sortOrder: 2 },
      { id: 34, categoryId: 6, name: "Logo Design", price: "500", sortOrder: 3 },
      { id: 35, categoryId: 6, name: "Business Card Design", price: "200", sortOrder: 4 },
      { id: 36, categoryId: 6, name: "Letterhead Design", price: "150", sortOrder: 5 },
      { id: 37, categoryId: 6, name: "Banner Design", price: "Contact us", sortOrder: 6 },
      { id: 38, categoryId: 7, name: "Driving License Renewal", price: "200", sortOrder: 1 },
      { id: 39, categoryId: 7, name: "Smart DL Application", price: "200", sortOrder: 2 },
      { id: 40, categoryId: 7, name: "Interim Licence Application", price: "150", sortOrder: 3 },
      { id: 41, categoryId: 7, name: "PSV Badge Application", price: "150", sortOrder: 4 },
      { id: 42, categoryId: 7, name: "Temporary Permit", price: "200", sortOrder: 5 },
      { id: 43, categoryId: 7, name: "Motor Vehicle Acceptance", price: "400", sortOrder: 6 },
      { id: 44, categoryId: 7, name: "Motor Vehicle Inspection", price: "200", sortOrder: 7 },
      { id: 45, categoryId: 7, name: "Driving Licence Application", price: "200", sortOrder: 8 },
      { id: 46, categoryId: 8, name: "eCitizen Services", price: "Contact us", sortOrder: 1 },
      { id: 47, categoryId: 8, name: "Browsing (per minute)", price: "1", sortOrder: 2 },
    ],
    admin_settings: [
      { id: 1, passwordHash: "$2a$10$placeholder_will_be_replaced" },
    ],
    site_settings: getDefaultSiteSettings(),
    _meta: { lastId: { categories: 8, services: 47, admin_settings: 1 } },
  };
}

// ─────────────────────────────────────────────────────────────
// Suggestions  (auto-cleanup: 24h normally, 1h when overflowing)
// ─────────────────────────────────────────────────────────────

export interface Suggestion {
  id: number | string;
  message: string;
  ip?: string;
  createdAt: string; // ISO
}

const SUGGESTION_OVERFLOW_THRESHOLD = 50; // beyond this → use 1h cutoff
const SUGGESTION_NORMAL_TTL_MS = 24 * 60 * 60 * 1000;
const SUGGESTION_OVERFLOW_TTL_MS = 60 * 60 * 1000;
const SUGGESTION_MAX_LEN = 500;

function maskIpForSuggestion(ip: string | undefined): string | undefined {
  // IP masking DISABLED — show full IPs in admin views.
  if (!ip || ip === "unknown") return undefined;
  return ip;
}

/** Run cleanup based on current backlog size. Returns # deleted. */
export async function cleanupSuggestions(): Promise<number> {
  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    const countRes = await pool.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM suggestions"
    );
    const count = parseInt(countRes.rows[0]?.c ?? "0", 10) || 0;
    const ttlMs =
      count > SUGGESTION_OVERFLOW_THRESHOLD
        ? SUGGESTION_OVERFLOW_TTL_MS
        : SUGGESTION_NORMAL_TTL_MS;
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    const del = await pool.query(
      "DELETE FROM suggestions WHERE created_at < $1",
      [cutoff]
    );
    return del.rowCount ?? 0;
  }

  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>("suggestions");
    let arr: Suggestion[] = [];
    try {
      arr = raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Suggestion[])) : [];
    } catch {
      arr = [];
    }
    const ttl =
      arr.length > SUGGESTION_OVERFLOW_THRESHOLD
        ? SUGGESTION_OVERFLOW_TTL_MS
        : SUGGESTION_NORMAL_TTL_MS;
    const cutoff = Date.now() - ttl;
    const before = arr.length;
    const filtered = arr.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
    if (filtered.length !== before) {
      await redis.set("suggestions", JSON.stringify(filtered));
    }
    return before - filtered.length;
  }

  // JSON-file fallback
  const db = await readDb();
  const list: Suggestion[] = ((db as unknown) as { suggestions?: Suggestion[] }).suggestions || [];
  const ttl =
    list.length > SUGGESTION_OVERFLOW_THRESHOLD
      ? SUGGESTION_OVERFLOW_TTL_MS
      : SUGGESTION_NORMAL_TTL_MS;
  const cutoff = Date.now() - ttl;
  const before = list.length;
  const filtered = list.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
  if (filtered.length !== before) {
    ((db as unknown) as { suggestions?: Suggestion[] }).suggestions = filtered;
    await writeDb(db);
  }
  return before - filtered.length;
}

/** Add a new suggestion. Auto-runs cleanup. Returns the new row. */
export async function addSuggestion(
  message: string,
  ip?: string
): Promise<Suggestion> {
  const trimmed = (message || "").trim().slice(0, SUGGESTION_MAX_LEN);
  if (!trimmed) throw new Error("Message is empty");

  await cleanupSuggestions();

  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    const res = await pool.query<{ id: number; created_at: Date }>(
      "INSERT INTO suggestions (message, ip) VALUES ($1, $2) RETURNING id, created_at",
      [trimmed, ip ?? null]
    );
    return {
      id: res.rows[0].id,
      message: trimmed,
      ip: maskIpForSuggestion(ip),
      createdAt: res.rows[0].created_at.toISOString(),
    };
  }

  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>("suggestions");
    let arr: Suggestion[] = [];
    try {
      arr = raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Suggestion[])) : [];
    } catch {
      arr = [];
    }
    const next: Suggestion = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      message: trimmed,
      ip,
      createdAt: new Date().toISOString(),
    };
    arr.push(next);
    await redis.set("suggestions", JSON.stringify(arr));
    return { ...next, ip: maskIpForSuggestion(ip) };
  }

  // JSON file fallback
  const db = await readDb();
  const list: Suggestion[] =
    ((db as unknown) as { suggestions?: Suggestion[] }).suggestions || [];
  const next: Suggestion = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    message: trimmed,
    ip,
    createdAt: new Date().toISOString(),
  };
  list.push(next);
  ((db as unknown) as { suggestions?: Suggestion[] }).suggestions = list;
  await writeDb(db);
  return { ...next, ip: maskIpForSuggestion(ip) };
}

/** Get all current suggestions (newest first). Auto-runs cleanup. */
export async function getSuggestions(): Promise<{
  items: Suggestion[];
  count: number;
  ttlHours: number;
  cleanupRanCount: number;
}> {
  const cleanupRanCount = await cleanupSuggestions();
  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    const res = await pool.query<{
      id: number;
      message: string;
      ip: string | null;
      created_at: Date;
    }>(
      "SELECT id, message, ip, created_at FROM suggestions ORDER BY created_at DESC LIMIT 200"
    );
    const items = res.rows.map((r) => ({
      id: r.id,
      message: r.message,
      ip: maskIpForSuggestion(r.ip ?? undefined),
      createdAt: r.created_at.toISOString(),
    }));
    return {
      items,
      count: items.length,
      ttlHours:
        items.length > SUGGESTION_OVERFLOW_THRESHOLD ? 1 : 24,
      cleanupRanCount,
    };
  }

  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>("suggestions");
    let arr: Suggestion[] = [];
    try {
      arr = raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Suggestion[])) : [];
    } catch {
      arr = [];
    }
    arr.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      items: arr.map((s) => ({ ...s, ip: maskIpForSuggestion(s.ip) })),
      count: arr.length,
      ttlHours: arr.length > SUGGESTION_OVERFLOW_THRESHOLD ? 1 : 24,
      cleanupRanCount,
    };
  }

  const db = await readDb();
  const list: Suggestion[] =
    ((db as unknown) as { suggestions?: Suggestion[] }).suggestions || [];
  list.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return {
    items: list.map((s) => ({ ...s, ip: maskIpForSuggestion(s.ip) })),
    count: list.length,
    ttlHours: list.length > SUGGESTION_OVERFLOW_THRESHOLD ? 1 : 24,
    cleanupRanCount,
  };
}

export async function deleteSuggestion(id: number | string): Promise<void> {
  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    await pool.query("DELETE FROM suggestions WHERE id = $1", [id]);
    return;
  }
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>("suggestions");
    let arr: Suggestion[] = [];
    try {
      arr = raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Suggestion[])) : [];
    } catch {
      arr = [];
    }
    arr = arr.filter((s) => String(s.id) !== String(id));
    await redis.set("suggestions", JSON.stringify(arr));
    return;
  }
  const db = await readDb();
  const list: Suggestion[] =
    ((db as unknown) as { suggestions?: Suggestion[] }).suggestions || [];
  ((db as unknown) as { suggestions?: Suggestion[] }).suggestions = list.filter(
    (s) => String(s.id) !== String(id)
  );
  await writeDb(db);
}

export async function clearAllSuggestions(): Promise<number> {
  const pool = getPg();
  if (pool) {
    await ensurePgSchema();
    const res = await pool.query("DELETE FROM suggestions");
    return res.rowCount ?? 0;
  }
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>("suggestions");
    let arr: Suggestion[] = [];
    try {
      arr = raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Suggestion[])) : [];
    } catch {
      arr = [];
    }
    const before = arr.length;
    await redis.set("suggestions", JSON.stringify([]));
    return before;
  }
  const db = await readDb();
  const list: Suggestion[] =
    ((db as unknown) as { suggestions?: Suggestion[] }).suggestions || [];
  const before = list.length;
  ((db as unknown) as { suggestions?: Suggestion[] }).suggestions = [];
  await writeDb(db);
  return before;
}

// ── Cache reset (placed last so all module-level vars are in scope) ─────

/**
 * Force re-detection of all storage backends. Call this after the admin
 * saves new database credentials via the setup wizard so the next request
 * picks them up immediately without a server restart.
 */
export function resetStorageDetection(): void {
  runtimeConfigCache = undefined;
  runtimeConfigLoading = null;
  if (pgPool) {
    pgPool.end().catch(() => {});
  }
  pgPool = null;
  pgInitialized = false;
  pgSchemaReady = null;
  pgUrlSource = null;
  redisClient = undefined;
  redisSource = null;
  dbPathCache = null;
}

