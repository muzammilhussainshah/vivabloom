import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isAllowedByRobots, parseRobots, type RobotsRules } from "./robots";

/**
 * The only way the Store Checker reads third-party websites. Unlike
 * lib/urlFetch.ts (admin-typed URLs only), these URLs come from search
 * results, so they're untrusted:
 * - every hop (including redirects) is DNS-resolved and refused if it points
 *   at a private/loopback/link-local address (SSRF guard);
 * - robots.txt is honoured for page fetches, identified by our own UA token;
 * - reads are capped by time and bytes.
 */

export const USER_AGENT_TOKEN = "VivaBloomAdminBot";
const USER_AGENT = `Mozilla/5.0 (compatible; ${USER_AGENT_TOKEN}/1.0; +https://monocoupon.com)`;
const MAX_REDIRECTS = 5;

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  contentType: string;
  text: string;
  /** Set when we didn't request the page because robots.txt disallows it. */
  blockedByRobots?: boolean;
  error?: string;
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === undefined || b === undefined) return true;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("Refusing to fetch a private address");
    return;
  }
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("Refusing to fetch an internal host");
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Host resolves to a private address");
  }
}

const robotsCache = new Map<string, { rules: RobotsRules | null; at: number }>();
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;

/** robots.txt for an origin (cached per server instance). Null = none / unreadable → everything allowed. */
export async function getRobots(origin: string): Promise<RobotsRules | null> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.at < ROBOTS_TTL_MS) return cached.rules;
  const res = await safeFetch(`${origin}/robots.txt`, { checkRobots: false, timeoutMs: 6000, maxBytes: 300_000, accept: "text/plain,*/*" });
  const rules = res.ok && !/<html/i.test(res.text.slice(0, 500)) ? parseRobots(res.text) : null;
  robotsCache.set(origin, { rules, at: Date.now() });
  return rules;
}

export async function safeFetch(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; accept?: string; checkRobots?: boolean; headers?: Record<string, string> } = {}
): Promise<FetchResult> {
  const { timeoutMs = 10_000, maxBytes = 2_000_000, accept = "text/html,application/xhtml+xml", checkRobots = true, headers = {} } = opts;
  const fail = (url: string, error: string, extra: Partial<FetchResult> = {}): FetchResult => ({
    ok: false,
    status: 0,
    url,
    contentType: "",
    text: "",
    error,
    ...extra,
  });

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return fail(rawUrl, "Invalid URL");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") return fail(url.toString(), "Unsupported protocol");
      await assertPublicHost(url.hostname);

      if (checkRobots) {
        const robots = await getRobots(url.origin);
        if (robots && !isAllowedByRobots(robots, USER_AGENT_TOKEN, url.pathname + url.search)) {
          return fail(url.toString(), "Disallowed by robots.txt", { blockedByRobots: true });
        }
      }

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en-US,en;q=0.8", ...headers },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        void res.body?.cancel().catch(() => {});
        if (!location) return fail(url.toString(), `Redirect without location (${res.status})`);
        url = new URL(location, url);
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.body) return { ok: res.ok, status: res.status, url: url.toString(), contentType, text: "" };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let bytes = 0;
      while (bytes < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        text += decoder.decode(value, { stream: true });
      }
      void reader.cancel().catch(() => {});
      return { ok: res.ok, status: res.status, url: url.toString(), contentType, text };
    }
    return fail(url.toString(), "Too many redirects");
  } catch (err) {
    const message = err instanceof Error ? (err.name === "AbortError" ? "Timed out" : err.message) : "Fetch failed";
    return fail(url.toString(), message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shopify (and many storefronts) localise prices to the visitor's IP. These
 * cookies ask for one market's prices so results don't depend on where the
 * server happens to run.
 */
const MARKET_CURRENCY: Record<string, string> = { us: "USD", gb: "GBP", ca: "CAD", au: "AUD", nz: "NZD", de: "EUR", fr: "EUR", it: "EUR", es: "EUR", nl: "EUR", ie: "EUR", ae: "AED", sa: "SAR" };

export function marketHeaders(country: string | null | undefined): { headers: Record<string, string>; currency: string } {
  const code = (country ?? "us").toLowerCase();
  const currency = MARKET_CURRENCY[code] ?? "USD";
  return { headers: { Cookie: `localization=${code.toUpperCase()}; cart_currency=${currency}` }, currency };
}

/** Runs async jobs with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
