import type { MiddlewareHandler } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  /** Max requests per window */
  max: number;
  /** Window duration in ms */
  windowMs: number;
}

export function rateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();

  // Cleanup stale entries every 60s
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000).unref();

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", String(options.max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, options.max - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too Many Requests" }, 429);
    }

    await next();
  };
}

/** Read rate limiter: 1000 req/min */
export const readLimiter = rateLimitMiddleware({
  max: 1000,
  windowMs: 60_000,
});

/** Write rate limiter: 100 req/min */
export const writeLimiter = rateLimitMiddleware({
  max: 100,
  windowMs: 60_000,
});
