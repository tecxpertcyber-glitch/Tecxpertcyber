// ============================================================
// CENTRALISED ADMIN AUTH HELPERS
// ============================================================
// • Uses ADMIN_SECRET env var when set (recommended for production)
// • Falls back to a per-instance auto-derived key so editing always works
//   out of the box, but exposes a `usingFallback` flag so the admin UI can
//   warn the user to set a real secret in env vars.
// • Embeds a `tv` (token-version) claim in every JWT so the admin can
//   "Log out from all devices" by bumping the version in the DB.
// ============================================================

import { jwtVerify, SignJWT } from "jose";
import { randomBytes, createHash } from "crypto";
import { getAdminTokenVersion } from "./storage";

const WEAK_SECRETS = new Set([
  "",
  "tecxpert-admin-secret-key-2024",
  "secret",
  "changeme",
  "admin",
  "password",
  "123456",
]);

let cachedKey: Uint8Array | null = null;
let cachedUsingFallback = false;
let cachedInitialised = false;

function ensureKey(): void {
  if (cachedInitialised) return;
  cachedInitialised = true;

  const raw = (process.env.ADMIN_SECRET || "").trim();
  if (raw.length >= 32 && !WEAK_SECRETS.has(raw)) {
    cachedKey = new TextEncoder().encode(raw);
    cachedUsingFallback = false;
    return;
  }

  // Fallback key: derived once per process from random bytes + stable env.
  const stableMix = [
    process.env.DATABASE_URL || "",
    process.env.POSTGRES_URL || "",
    process.env.POSTGRES_PRISMA_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ].join("|");

  const random = randomBytes(32).toString("hex");
  const derived = createHash("sha256")
    .update(`tecxpert::${random}::${stableMix}`)
    .digest();
  cachedKey = derived;
  cachedUsingFallback = true;
}

export function getAdminKey(): Uint8Array {
  ensureKey();
  return cachedKey!;
}

export function isUsingFallbackSecret(): boolean {
  ensureKey();
  return cachedUsingFallback;
}

/**
 * Verify an admin JWT. Returns true only if the signature is valid AND
 * the embedded `tv` claim matches the current token version stored in
 * the DB. (If `tv` is bumped, every old token instantly becomes invalid.)
 */
export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getAdminKey(), {
      clockTolerance: 60,
    });
    if (payload.admin !== true) return false;
    const tokenVer = typeof payload.tv === "number" ? payload.tv : 1;
    let currentVer = 1;
    try {
      currentVer = await getAdminTokenVersion();
    } catch {
      // If the DB is unreachable, accept the token rather than locking
      // the admin out completely. Edits will still fail at the DB layer.
      return true;
    }
    return tokenVer === currentVer;
  } catch {
    return false;
  }
}

/**
 * Sign a new admin JWT — embeds the current token version so we can
 * invalidate it later by bumping the version.
 */
export async function signAdminToken(
  payload: Record<string, unknown> = {}
): Promise<string> {
  let tv = 1;
  try {
    tv = await getAdminTokenVersion();
  } catch {
    /* ignore — keep tv=1 */
  }
  return await new SignJWT({ ...payload, admin: true, tv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAdminKey());
}

export function adminSecretMissing(): boolean {
  return isUsingFallbackSecret();
}
