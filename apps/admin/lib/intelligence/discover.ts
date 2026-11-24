import { connectToDatabase, StoreCheck, StoreDiscovery } from "@monocoupon/db";
import { discoveryExtractionSchema, getResearchCountry } from "@monocoupon/validation";
import { STORE_DISCOVERY_SYSTEM_PROMPT, storeDiscoveryPrompt } from "@/lib/ai/prompts";
import { llmJson } from "./llm";
import { tavilySearchAll } from "./tavily";
import { compact, domainOfUrl, isLikelyStoreDomain, nameFromDomain } from "./domain";
import { quoteInText } from "./evidence";
import type { ScoreResult } from "./types";

/**
 * "Find stores": web search for brands in a category + market that run
 * affiliate programs, then the AI lists only brands actually named in those
 * pages (each with a verified quote). Every search is saved as history and
 * reused for free; web-search credits are only spent on a brand-new search or
 * when the admin explicitly asks for a fresh one.
 */

export interface DiscoveredStore {
  name: string;
  domain: string | null;
  note: string | null;
  sourceUrl: string;
  sourceTitle: string;
  /** Filled in at read time from an existing StoreCheck, if this store was already checked. */
  check: { id: string; verdict: ScoreResult["verdict"]; trust: number } | null;
}

const CHAR_BUDGET = 16_000;
/**
 * Brand names in list articles sit in headings ("## 3. West Paw"), numbered
 * or bold lines, and next to commission details — keep those lines, in order.
 */
function focusListText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 400);
  const score = (l: string) =>
    /^#{1,4}\s|^\d{1,2}[.)]\s|^\*\*[^*]{2,60}\*\*|^[-*]\s+\*\*/.test(l) ? 3 : /commission|affiliate program|cookie|%|\.com\b/i.test(l) ? 2 : 0;
  const ranked = lines.map((l, i) => ({ l, i, s: score(l) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
  const keep: { l: string; i: number }[] = [];
  let used = 0;
  for (const x of ranked) {
    if (used + x.l.length + 1 > maxChars) continue;
    keep.push(x);
    used += x.l.length + 1;
  }
  return keep.sort((a, b) => a.i - b.i).map((x) => x.l).join("\n") || text.slice(0, maxChars);
}

/** Marks stores that already have a Store Check (matched by domain, else by name), so they open without spending credits. */
async function attachChecks(stores: DiscoveredStore[]): Promise<DiscoveredStore[]> {
  const checks = await StoreCheck.find({}, "domain name score").lean();
  return stores.map((s) => {
    const c = checks.find((x) => (s.domain && x.domain === s.domain) || (x.name && compact(x.name) === compact(s.name)));
    const score = c?.score as ScoreResult | null | undefined;
    return { ...s, domain: s.domain ?? c?.domain ?? null, check: c && score ? { id: String(c._id), verdict: score.verdict, trust: score.trust } : null };
  });
}

export interface DiscoveryResult {
  id: string;
  country: string;
  category: string;
  keyword: string | null;
  stores: DiscoveredStore[];
  cached: boolean;
  createdAt: string;
}

export async function discoverStores(opts: { country: string; category: string; keyword?: string | null; force?: boolean }): Promise<{
  id: string;
  stores: DiscoveredStore[];
  cached: boolean;
  createdAt: string;
}> {
  await connectToDatabase();
  const countryName = getResearchCountry(opts.country)?.name ?? opts.country.toUpperCase();
  const keyword = opts.keyword?.trim() || null;
  const key = `${opts.country}|${opts.category}|${keyword ?? ""}`.toLowerCase();

  const cached = await StoreDiscovery.findOne({ key }).lean();
  // A saved search is always reused — only an explicit "search again" spends credits.
  if (cached && !opts.force) {
    return { id: String(cached._id), stores: await attachChecks(cached.results as DiscoveredStore[]), cached: true, createdAt: new Date(cached.updatedAt).toISOString() };
  }

  const topic = keyword ? `${keyword} (${opts.category})` : opts.category;
  const queries = [
    `best ${topic} brands with affiliate programs ${countryName}`,
    `${topic} affiliate programs ${countryName} commission brands list`,
    `top direct-to-consumer ${topic} brands ${countryName} online store`,
  ];
  const searched = await tavilySearchAll(queries, { maxResults: 7, includeRawContent: true });
  const credits = searched.credits;

  const seen = new Set<string>();
  const results = searched.results.flat().filter((r) => !seen.has(r.url) && seen.add(r.url));

  // A search hit that IS a store's own homepage is direct evidence of a candidate store.
  const homepageHits = results.filter((r) => {
    const d = domainOfUrl(r.url);
    return d && isLikelyStoreDomain(d) && /^\/?$/.test(new URL(r.url).pathname);
  });

  // Lists ("12 best pet brands…") get most of the budget, and only their heading / commission lines.
  const lists = results.filter((r) => !homepageHits.includes(r) && !/youtube\.com|mapquest\.com/.test(r.url));
  const perList = Math.floor(CHAR_BUDGET / Math.max(1, Math.min(lists.length, 7)));
  const sources: { url: string; title: string; text: string; full: string }[] = [];
  let budget = CHAR_BUDGET;
  for (const r of lists) {
    const full = `${r.title}\n${r.content}\n${r.rawContent ?? ""}`;
    const text = focusListText(full, perList);
    if (budget - text.length < 0) break;
    budget -= text.length;
    sources.push({ url: r.url, title: r.title, text, full });
  }
  if (sources.length === 0 && homepageHits.length === 0) {
    throw new Error("The web search returned nothing for this market and category. Try a different keyword.");
  }

  const brands = sources.length
    ? (
        await llmJson({
          task: "storeDiscovery",
          system: STORE_DISCOVERY_SYSTEM_PROMPT,
          user: storeDiscoveryPrompt({ country: countryName, category: opts.category, keyword, sources: sources.map((s) => ({ url: s.url, text: s.text })) }),
          schema: discoveryExtractionSchema,
          maxOutputTokens: 2200,
          deadline: Date.now() + 50_000,
        })
      ).data.brands
    : [];

  const stores: DiscoveredStore[] = [];
  const names = new Set<string>();
  for (const b of brands) {
    const nameKey = compact(b.name);
    // The quote must exist in a source AND name the brand — otherwise the AI made it up.
    if (!nameKey || names.has(nameKey) || !compact(b.quote ?? "").includes(nameKey.slice(0, 8))) continue;
    const cited = b.source != null ? sources[b.source] : undefined;
    const home = cited && quoteInText(b.quote, cited.full) ? cited : sources.find((s) => quoteInText(b.quote, s.full));
    if (!home) continue;
    // Keep a domain only if it's written in a source, and it's a store (not a marketplace/network/publisher).
    let domain = b.domain ? domainOfUrl(/^https?:/.test(b.domain) ? b.domain : `https://${b.domain}`) : null;
    if (domain && (!sources.some((s) => s.full.toLowerCase().includes(domain as string)) || !isLikelyStoreDomain(domain))) domain = null;
    if (domain && domain === domainOfUrl(home.url)) domain = isLikelyStoreDomain(domain) ? domain : null;
    names.add(nameKey);
    // A commission note is only shown if every number in it appears in the source it came from.
    let note = b.note?.replace(/\s*\(?source\s*\d+\)?/gi, "").trim() || null;
    if (note && (note.match(/\d+(?:\.\d+)?/g) ?? []).some((n) => !home.full.includes(n))) note = null;
    stores.push({ name: b.name.trim(), domain, note, sourceUrl: home.url, sourceTitle: home.title, check: null });
  }
  for (const r of homepageHits) {
    const domain = domainOfUrl(r.url) as string;
    const titlePart = (r.title.split(/\s[|–—:-]\s/)[0] ?? "").trim();
    // Homepage titles are often slogans ("Pet Products, Supplies & Accessories") — fall back to the domain's name.
    const name = titlePart && compact(titlePart).includes(compact(domain.split(".")[0] ?? "")) ? titlePart.slice(0, 60) : nameFromDomain(domain);
    if (stores.some((s) => s.domain === domain || compact(s.name) === compact(name))) continue;
    stores.push({ name, domain, note: null, sourceUrl: r.url, sourceTitle: r.title, check: null });
  }

  const saved = await StoreDiscovery.findOneAndUpdate(
    { key },
    { $set: { country: opts.country, category: opts.category, keyword, results: stores }, $inc: { tavilyCredits: credits } },
    { upsert: true, new: true }
  );
  return { id: String(saved._id), stores: await attachChecks(stores), cached: false, createdAt: new Date().toISOString() };
}

/* ---------- History ---------- */

export interface DiscoveryHistoryItem {
  id: string;
  country: string;
  category: string;
  keyword: string | null;
  count: number;
  checked: number;
  credits: number;
  updatedAt: string;
}

export async function listDiscoveryHistory(): Promise<DiscoveryHistoryItem[]> {
  await connectToDatabase();
  const [docs, checks] = await Promise.all([
    StoreDiscovery.find({}).sort({ updatedAt: -1 }).limit(100).lean(),
    StoreCheck.find({}, "domain name").lean(),
  ]);
  const checkedDomains = new Set(checks.map((c) => c.domain));
  const checkedNames = new Set(checks.map((c) => (c.name ? compact(c.name) : "")).filter(Boolean));
  return docs.map((d) => {
    const results = (d.results ?? []) as DiscoveredStore[];
    return {
      id: String(d._id),
      country: d.country,
      category: d.category,
      keyword: d.keyword ?? null,
      count: results.length,
      checked: results.filter((r) => (r.domain && checkedDomains.has(r.domain)) || checkedNames.has(compact(r.name))).length,
      credits: d.tavilyCredits ?? 0,
      updatedAt: new Date(d.updatedAt).toISOString(),
    };
  });
}

/** One saved search, re-opened for free. */
export async function getDiscovery(id: string): Promise<DiscoveryResult | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  await connectToDatabase();
  const d = await StoreDiscovery.findById(id).lean();
  if (!d) return null;
  return {
    id: String(d._id),
    country: d.country,
    category: d.category,
    keyword: d.keyword ?? null,
    stores: await attachChecks((d.results ?? []) as DiscoveredStore[]),
    cached: true,
    createdAt: new Date(d.updatedAt).toISOString(),
  };
}

/** Every store found by any saved search, deduplicated, with where it was found. */
export async function getAllDiscoveredStores(): Promise<(DiscoveredStore & { foundIn: string[] })[]> {
  await connectToDatabase();
  const docs = await StoreDiscovery.find({}).sort({ updatedAt: -1 }).lean();
  const byKey = new Map<string, DiscoveredStore & { foundIn: string[] }>();
  for (const d of docs) {
    const label = `${d.category}${d.keyword ? ` · ${d.keyword}` : ""} · ${getResearchCountry(d.country)?.name ?? d.country.toUpperCase()}`;
    for (const s of (d.results ?? []) as DiscoveredStore[]) {
      const key = s.domain ?? compact(s.name);
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.foundIn.includes(label)) existing.foundIn.push(label);
        if (!existing.note && s.note) existing.note = s.note;
        if (!existing.domain && s.domain) existing.domain = s.domain;
      } else {
        byKey.set(key, { ...s, foundIn: [label] });
      }
    }
  }
  const stores = await attachChecks([...byKey.values()]);
  return stores as (DiscoveredStore & { foundIn: string[] })[];
}

export async function deleteDiscovery(id: string): Promise<void> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return;
  await connectToDatabase();
  await StoreDiscovery.deleteOne({ _id: id });
}
