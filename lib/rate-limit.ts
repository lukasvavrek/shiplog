/**
 * Simple in-memory sliding window rate limiter.
 *
 * NOTE: This is per-process. For multi-instance / serverless deployments,
 * swap out the store for a shared Redis backend (e.g. @upstash/ratelimit).
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check whether `key` is within the allowed limit.
 *
 * @param key       Unique identifier (e.g. `userId:routeName`)
 * @param limit     Max number of requests allowed
 * @param windowMs  Sliding window size in milliseconds
 * @returns `{ allowed: boolean; remaining: number; resetAt: number }`
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const count = entry.timestamps.length;
  const resetAt = entry.timestamps[0]
    ? entry.timestamps[0] + windowMs
    : now + windowMs;

  if (count >= limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: limit - count - 1, resetAt };
}
