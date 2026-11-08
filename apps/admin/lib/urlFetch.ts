/**
 * Best-effort server-side fetch of a store's public site signal (title + meta
 * description) — the only "browsing" the category-suggestion AI flow gets,
 * since the chat models it calls have no live internet access. Failures never
 * throw; the caller falls back to matching on the bare URL/domain alone.
 */

const FETCH_TIMEOUT_MS = 8_000;
/** Enough for a page's <head> in practice; avoids downloading a huge document body. */
const MAX_BYTES = 300_000;

export interface SiteSignal {
  title?: string;
  description?: string;
}

/**
 * Rejects loopback/private/link-local hostnames so this admin-only tool can't
 * be used to make the server fetch its own internal network. Not exhaustive
 * DNS-rebinding protection — just a sanity check against the obvious cases,
 * proportionate to a trusted-admin feature.
 */
function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "0.0.0.0" || host === "::1" || host === "[::1]") return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = match?.[1]?.replace(/\s+/g, " ").trim();
  return text ? decodeEntities(text).slice(0, 300) : undefined;
}

function extractMetaDescription(html: string): string | undefined {
  // Matches <meta name="description" content="..."> in either attribute order,
  // then falls back to og:description if the plain meta tag isn't present.
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const text = match?.[1]?.replace(/\s+/g, " ").trim();
    if (text) return decodeEntities(text).slice(0, 500);
  }
  return undefined;
}

/**
 * Fetches a store's homepage and pulls its <title>/meta description, capped
 * to a short timeout and a bounded read so one slow/huge page can't hang or
 * balloon the request. Returns undefined fields (never throws) on any
 * network error, non-HTML response, or blocked/invalid URL.
 */
export async function fetchSiteSignal(rawUrl: string): Promise<SiteSignal> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {};
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return {};
  if (isBlockedHostname(url.hostname)) return {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VivaBloomAdminBot/1.0; +https://monocoupon.com)",
        Accept: "text/html",
      },
    });
    if (!res.ok || !res.body) return {};
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return {};

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytesRead = 0;
    while (bytesRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    void reader.cancel().catch(() => {});

    return { title: extractTitle(html), description: extractMetaDescription(html) };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}
