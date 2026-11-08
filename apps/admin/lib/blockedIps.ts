import { Redis } from "@upstash/redis";

/** Must match the key read by apps/web/lib/blockedIps.ts. */
export const BLOCKED_IPS_KEY = "monocoupon:blocked-ips";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!redis) redis = new Redis({ url, token });
  return redis;
}

/**
 * Pushes the admin-curated blocked-IP list to Redis so apps/web/proxy.ts —
 * which runs on the Edge runtime and can't reach MongoDB directly — can
 * read it without a database round trip. Mirrors syncBlockedCountries.
 */
export async function syncBlockedIps(ips: string[]): Promise<void> {
  const r = getRedis();
  if (!r) {
    console.warn("UPSTASH_REDIS_REST_URL/TOKEN not set — blocked IPs won't be enforced on the public site");
    return;
  }
  await r.set(BLOCKED_IPS_KEY, ips);
}
