/**
 * In-memory rate limiter with configurable windows.
 *
 * WARNING: Does NOT persist across serverless invocations on Vercel.
 * For production, replace with Upstash Redis or similar.
 */

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes

const store = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = DEFAULT_WINDOW_MS
): { allowed: boolean; remaining: number } {
  cleanupExpired();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count += 1;
  const remaining = Math.max(0, maxRequests - entry.count);
  return { allowed: entry.count <= maxRequests, remaining };
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = DEFAULT_WINDOW_MS
): Response | null {
  const { allowed, remaining } = rateLimit(identifier, maxRequests, windowMs);
  if (!allowed) {
    const retryAfterSec = Math.ceil(windowMs / 1000);
    return new Response(
      JSON.stringify({
        error: {
          code: "rate_limited",
          message: "Too many requests. Please try again later.",
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  }
  return null;
}

/** Auth routes: 5 requests per minute */
export function checkAuthRateLimit(ip: string): Response | null {
  return checkRateLimit(`auth:${ip}`, 5, 60_000);
}

/** Spec/stream routes: 3 requests per 24 hours per session token */
export function checkSpecRateLimit(sessionToken: string): Response | null {
  return checkRateLimit(`spec:${sessionToken}`, 3, 24 * 60 * 60_000);
}

/** General API routes: 30 requests per minute */
export function checkGeneralRateLimit(ip: string): Response | null {
  return checkRateLimit(`general:${ip}`, 30, 60_000);
}

/** Reset store — for unit tests only */
export function _resetStore() {
  store.clear();
  lastCleanup = Date.now();
}
