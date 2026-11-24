/**
 * Tavily web search/extract — the Store Checker's only paid data source.
 * Credit costs (docs.tavily.com/guides/api-credits): a basic search is 1
 * credit, an advanced search 2; extract is 1 credit per 5 successful URLs.
 * Callers add the returned `credits` to the StoreCheck's usage counter.
 */

const BASE = "https://api.tavily.com";
const TIMEOUT_MS = 25_000;

export interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score: number;
  publishedDate: string | null;
  rawContent: string | null;
}

function apiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set. Add it to apps/admin/.env.local.");
  return key;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 432 || res.status === 433) throw new Error("Tavily credit limit reached for this month.");
      if (res.status === 401) throw new Error("Tavily rejected the API key (401).");
      if (res.status === 429) throw new Error("Tavily rate limit hit — try again in a minute.");
      throw new Error(`Tavily ${path} failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error(`Tavily ${path} timed out`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function tavilySearch(
  query: string,
  opts: { maxResults?: number; depth?: "basic" | "advanced"; includeRawContent?: boolean; excludeDomains?: string[] } = {}
): Promise<{ results: TavilyResult[]; credits: number }> {
  const depth = opts.depth ?? "basic";
  const data = await post<{ results?: Record<string, unknown>[] }>("/search", {
    query,
    search_depth: depth,
    max_results: opts.maxResults ?? 8,
    include_raw_content: opts.includeRawContent ?? false,
    ...(opts.excludeDomains?.length ? { exclude_domains: opts.excludeDomains } : {}),
  });
  const results = (data.results ?? []).map((r) => ({
    url: String(r.url ?? ""),
    title: String(r.title ?? ""),
    content: String(r.content ?? ""),
    score: Number(r.score ?? 0),
    publishedDate: typeof r.published_date === "string" ? r.published_date : null,
    rawContent: typeof r.raw_content === "string" ? r.raw_content : null,
  }));
  return { results: results.filter((r) => r.url), credits: depth === "advanced" ? 2 : 1 };
}

export async function tavilyExtract(urls: string[]): Promise<{ results: { url: string; text: string }[]; failed: string[]; credits: number }> {
  const unique = [...new Set(urls)].slice(0, 20);
  if (unique.length === 0) return { results: [], failed: [], credits: 0 };
  const data = await post<{ results?: Record<string, unknown>[]; failed_results?: Record<string, unknown>[] }>("/extract", {
    urls: unique,
    extract_depth: "basic",
  });
  const results = (data.results ?? [])
    .map((r) => ({ url: String(r.url ?? ""), text: String(r.raw_content ?? "") }))
    .filter((r) => r.url && r.text);
  const failed = (data.failed_results ?? []).map((r) => String(r.url ?? ""));
  return { results, failed, credits: Math.ceil(results.length / 5) };
}

/**
 * Runs several searches in parallel. Individual failures are tolerated, but if
 * EVERY search fails the error is thrown — "the search broke" must never be
 * mistaken for "the internet has nothing on this store".
 */
export async function tavilySearchAll(
  queries: string[],
  opts: Parameters<typeof tavilySearch>[1] = {}
): Promise<{ results: TavilyResult[][]; credits: number }> {
  const settled = await Promise.allSettled(queries.map((q) => tavilySearch(q, opts)));
  const ok = settled.filter((s): s is PromiseFulfilledResult<{ results: TavilyResult[]; credits: number }> => s.status === "fulfilled");
  if (ok.length === 0 && settled.length > 0) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new Error("Web search failed");
  }
  return {
    results: settled.map((s) => (s.status === "fulfilled" ? s.value.results : [])),
    credits: ok.reduce((sum, s) => sum + s.value.credits, 0),
  };
}
