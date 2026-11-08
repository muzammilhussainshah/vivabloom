import { Redis } from "@upstash/redis";

/** Must match the key written by apps/admin/lib/blockedCountries.ts. */
const BLOCKED_COUNTRIES_KEY = "monocoupon:blocked-countries";

/** How long a fetched list stays valid before Redis is checked again. */
const CACHE_TTL_MS = 30_000;

let redis: Redis | null = null;
let cache: { countries: Set<string>; expiresAt: number } | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!redis) redis = new Redis({ url, token });
  return redis;
}

/**
 * Returns the admin-configured set of blocked country codes, read from
 * Redis (this runs on the Edge runtime in proxy.ts, which can't reach
 * MongoDB directly) and cached in-memory for CACHE_TTL_MS.
 *
 * Fails open — returns an empty set (no blocking) if Redis isn't configured
 * or the read fails, so a Redis outage never takes the whole site down.
 */
export async function getBlockedCountries(): Promise<Set<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.countries;

  const r = getRedis();
  if (!r) return new Set();

  try {
    const codes = (await r.get<string[]>(BLOCKED_COUNTRIES_KEY)) ?? [];
    const countries = new Set(codes);
    cache = { countries, expiresAt: Date.now() + CACHE_TTL_MS };
    return countries;
  } catch (err) {
    console.error("Failed to read blocked countries from Redis — failing open", err);
    return cache?.countries ?? new Set();
  }
}
