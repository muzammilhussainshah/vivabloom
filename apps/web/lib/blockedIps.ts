import { Redis } from "@upstash/redis";

/** Must match the key written by apps/admin/lib/blockedIps.ts. */
const BLOCKED_IPS_KEY = "monocoupon:blocked-ips";

/** How long a fetched list stays valid before Redis is checked again. */
const CACHE_TTL_MS = 30_000;

let redis: Redis | null = null;
let cache: { ips: Set<string>; expiresAt: number } | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!redis) redis = new Redis({ url, token });
  return redis;
}

/**
 * Returns the admin-curated set of blocked IPs, read from Redis (this runs
 * on the Edge runtime in proxy.ts, which can't reach MongoDB directly) and
 * cached in-memory for CACHE_TTL_MS. Mirrors getBlockedCountries.
 *
 * Fails open — returns an empty set (no blocking) if Redis isn't configured
 * or the read fails, so a Redis outage never takes the whole site down.
 */
export async function getBlockedIps(): Promise<Set<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.ips;

  const r = getRedis();
  if (!r) return new Set();

  try {
    const ips = (await r.get<string[]>(BLOCKED_IPS_KEY)) ?? [];
    const set = new Set(ips);
    cache = { ips: set, expiresAt: Date.now() + CACHE_TTL_MS };
    return set;
  } catch (err) {
    console.error("Failed to read blocked IPs from Redis — failing open", err);
    return cache?.ips ?? new Set();
  }
}
