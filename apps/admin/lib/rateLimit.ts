import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!redis) redis = new Redis({ url, token });
  return redis;
}

export interface RateLimitOptions {
  /** Distinct limiter bucket — different buckets don't share each other's quota. */
  name: string;
  requests: number;
  window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
}

function getLimiter(opts: RateLimitOptions): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  let rl = limiters.get(opts.name);
  if (!rl) {
    rl = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(opts.requests, opts.window),
      prefix: `monocoupon:${opts.name}`,
    });
    limiters.set(opts.name, rl);
  }
  return rl;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Returns allowed:true (fail-open) if Upstash isn't configured yet, so the
 * rest of the admin panel keeps working before that env var is set up —
 * but logs a warning since this should be rate-limited in real use.
 */
export async function checkRateLimit(identifier: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const rl = getLimiter(opts);
  if (!rl) {
    console.warn(`UPSTASH_REDIS_REST_URL/TOKEN not set — "${opts.name}" requests are not rate-limited`);
    return { allowed: true, limit: 0, remaining: 0, reset: 0 };
  }

  const result = await rl.limit(identifier);
  return { allowed: result.success, limit: result.limit, remaining: result.remaining, reset: result.reset };
}
