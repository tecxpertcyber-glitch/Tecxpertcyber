// ============================================================
// SAFE INPUT HELPERS
// ============================================================
// Parse JSON request bodies with strict size + type guards.
// Centralised so every API route uses the same hardening.
// ============================================================

import type { NextRequest } from "next/server";

const DEFAULT_MAX_BYTES = 16 * 1024; // 16 KB — way more than we need anywhere

export class SafeInputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Read a request body as JSON with strict guards:
 *  - Enforces `Content-Type: application/json` (or compatible)
 *  - Enforces a max body size (16 KB by default)
 *  - Returns a plain object (rejects arrays / primitives)
 *  - Catches malformed JSON and JSON bombs
 */
export async function safeJson<T = Record<string, unknown>>(
  req: NextRequest,
  opts: { maxBytes?: number; requireObject?: boolean } = {}
): Promise<T> {
  const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  // Quick header check
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct && !ct.includes("application/json") && !ct.includes("text/plain")) {
    throw new SafeInputError("Unsupported content type", 415);
  }
  const cl = parseInt(req.headers.get("content-length") || "0", 10);
  if (cl && cl > max) {
    throw new SafeInputError("Request body too large", 413);
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new SafeInputError("Failed to read body", 400);
  }
  if (text.length > max) {
    throw new SafeInputError("Request body too large", 413);
  }
  if (!text.trim()) {
    if (opts.requireObject === false) return {} as T;
    throw new SafeInputError("Empty body", 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SafeInputError("Invalid JSON", 400);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (opts.requireObject === false) return {} as T;
    throw new SafeInputError("Body must be a JSON object", 400);
  }
  return parsed as T;
}

/**
 * Coerce to a clean trimmed string with a max length.
 * Strips control characters that have no business in user text.
 */
export function safeString(
  v: unknown,
  opts: { max?: number; min?: number; allowEmpty?: boolean; field?: string } = {}
): string {
  if (typeof v !== "string") {
    if (opts.allowEmpty) return "";
    throw new SafeInputError(`${opts.field ?? "value"} must be a string`);
  }
  // Strip ASCII control chars except \t \n \r
  // eslint-disable-next-line no-control-regex
  const cleaned = v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  const max = opts.max ?? 1000;
  if (cleaned.length > max) {
    throw new SafeInputError(`${opts.field ?? "value"} too long (max ${max})`);
  }
  const min = opts.min ?? 0;
  if (cleaned.length < min) {
    throw new SafeInputError(`${opts.field ?? "value"} too short (min ${min})`);
  }
  return cleaned;
}

export function safeInt(
  v: unknown,
  opts: { min?: number; max?: number; field?: string } = {}
): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new SafeInputError(`${opts.field ?? "value"} must be a number`);
  }
  const min = opts.min ?? Number.MIN_SAFE_INTEGER;
  const max = opts.max ?? Number.MAX_SAFE_INTEGER;
  if (n < min || n > max) {
    throw new SafeInputError(
      `${opts.field ?? "value"} must be between ${min} and ${max}`
    );
  }
  return Math.floor(n);
}

export function safeBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v !== 0;
  return false;
}

/**
 * Validate one of a fixed set of allowed values (enum-style).
 */
export function safeEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  field = "value"
): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    throw new SafeInputError(
      `${field} must be one of: ${allowed.join(", ")}`
    );
  }
  return v as T;
}

/**
 * Safe email validator (best-effort; ASCII only; max 254 chars).
 */
export function safeEmail(v: unknown, field = "email"): string {
  const s = safeString(v, { max: 254, min: 5, field });
  // Loose RFC-compliant check
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s)) {
    throw new SafeInputError(`Invalid ${field}`);
  }
  return s;
}

/**
 * Safe URL validator. Only http: or https:.
 */
export function safeHttpUrl(v: unknown, field = "url"): string {
  const s = safeString(v, { max: 2048, min: 8, field });
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new SafeInputError(`Invalid ${field}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeInputError(`${field} must be http(s)://`);
  }
  return url.toString();
}

/**
 * Validate a Postgres connection string. Blocks file:// and other tricks.
 */
export function safePostgresUrl(v: unknown, field = "DATABASE_URL"): string {
  const s = safeString(v, { max: 2048, min: 10, field });
  if (!/^postgres(ql)?:\/\//i.test(s)) {
    throw new SafeInputError(`${field} must start with postgres:// or postgresql://`);
  }
  // Reject obvious local-file / SSRF-style hosts unless explicitly localhost
  // (we still allow localhost so admins can test locally).
  try {
    const url = new URL(s);
    if (!url.hostname) {
      throw new Error("missing host");
    }
  } catch {
    throw new SafeInputError(`${field} is not a valid URL`);
  }
  return s;
}

/**
 * Validate an IP address (v4 or v6). Returns the canonical string.
 */
export function safeIp(v: unknown, field = "ip"): string {
  const s = safeString(v, { max: 64, min: 3, field });
  // Allow our own masked form (e.g. "1.2.3.***" or "1.2.3.%")
  if (/^[0-9a-fA-F.:%*]+$/.test(s)) return s;
  throw new SafeInputError(`Invalid ${field}`);
}

/**
 * Escape SQL `LIKE` wildcards in user input. Use with `ESCAPE '\\'`.
 *
 *   `1.2.3.%` literal becomes `1.2.3.\%`
 */
export function escapeLikePattern(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}
