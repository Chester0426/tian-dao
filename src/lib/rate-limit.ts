/**
 * Simple in-memory rate limiter.
 *
 * WARNING: This does NOT persist across serverless invocations on Vercel.
 * For production, replace with Upstash Redis or similar.
 * See: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 */

const windowMs = 60_000; // 1 minute window
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  maxRequests: number
): { allowed: boolean; remaining: number } {
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

/**
 * Check rate limit and return 429 response if exceeded.
 * Returns null if allowed, or a NextResponse to return immediately.
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10
): Response | null {
  const { allowed, remaining } = rateLimit(identifier, maxRequests);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  }
  return null;
}
