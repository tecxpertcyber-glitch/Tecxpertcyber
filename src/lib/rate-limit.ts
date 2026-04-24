// ============================================================
// IN-MEMORY PER-IP RATE LIMITER
// ============================================================
// Sliding-window counter — best-effort (resets on cold start).
// For high-volume production use, swap the Map for Redis/Postgres.
// ============================================================

interface Bucket {
  hits: number[]; // unix timestamps (ms)
}

const buckets = new Map<string, Bucket>();

// Periodic GC so the map can never grow unboundedly
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, b] of buckets.entries()) {
    b.hits = b.hits.filter((t) => t >= cutoff);
    if (b.hits.length === 0) buckets.delete(k);
  }
}, 5 * 60 * 1000).unref?.();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
}

/**
 * Allow up to `maxHits` per `windowMs` for `key`. Returns ok=false if
 * the limit was exceeded. The caller should respond with HTTP 429 +
 * the `Retry-After` header.
 */
export function rateLimit(
  key: string,
  maxHits: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= maxHits) {
    const oldest = bucket.hits[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { ok: false, retryAfterSeconds: retryAfter, remaining: 0 };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: maxHits - bucket.hits.length };
}

/** Clear a specific bucket (e.g. after a successful login). */
export function rateLimitClear(key: string): void {
  buckets.delete(key);
}
