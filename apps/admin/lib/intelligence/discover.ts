import { connectToDatabase, Store, StoreCheck, StoreDiscovery } from "@monocoupon/db";
import { discoveryExtractionSchema, getResearchCountry } from "@monocoupon/validation";
import { STORE_DISCOVERY_SYSTEM_PROMPT, storeDiscoveryPrompt } from "@/lib/ai/prompts";
import { llmJson } from "./llm";
import { tavilySearchAll } from "./tavily";
import { compact, domainOfUrl, isLikelyStoreDomain, nameFromDomain, networkForUrl } from "./domain";
import { normalizeForMatch, quoteInText } from "./evidence";
import { mapLimit } from "./safeFetch";
import { probeStoreSite } from "./identity";
import { fetchTraffic, trafficTier } from "./traffic";
import { htmlToText } from "./html";
import { safeFetch } from "./safeFetch";
import { leadScore, parseCommission, scanAdRules, type EarlyWarning, type LeadBand } from "./leads";
import { getStoreMoneySummaries } from "@/lib/accounting/aggregate";
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
  /** Evidence that the store runs an affiliate program — only stores with it are shown. Undefined on searches saved before filtering. */
  program?: { via: "list" | "site"; label: string; url: string } | null;
  /** Free early signals, filled in by enrichPending() after a search (see leads.ts). */
  enriched?: boolean;
  network?: string | null;
  commission?: { min: number; max: number } | null;
  rank?: number | null;
  tier?: "very_high" | "high" | "medium" | "low" | "unranked" | null;
  warning?: EarlyWarning | null;
  /** Read-time: your own history with this store (never saved on the search). */
  yours?: { onSite: boolean; lostCents: number; spentCents: number; netCents: number } | null;
  lead?: { score: number; band: LeadBand };
}

export interface HiddenStore {
  name: string;
  domain: string | null;
}

const PROGRAM_WORDS = /affiliat|partner(ship)? program|ambassador|commission|referral program|creator program|influencer program|publisher program/i;

/**
 * A list article's quote counts as proof of THIS brand's program only if it is
 * in the source, talks about a program, and either names the brand or comes
 * shortly after the brand is named.
 */
function listProgramEvidence(programQuote: string | null, brandName: string, sources: { url: string; full: string }[]): string | null {
  if (!programQuote || !PROGRAM_WORDS.test(programQuote)) return null;
  const src = sources.find((x) => quoteInText(programQuote, x.full));
  if (!src) return null;
  if (compact(programQuote).includes(compact(brandName).slice(0, 8))) return src.url;
  const text = normalizeForMatch(src.full);
  const at = text.indexOf(normalizeForMatch(programQuote).slice(0, 40));
  const name = normalizeForMatch(brandName);
  return at > 0 && text.slice(Math.max(0, at - 1200), at).includes(name) ? src.url : null;
}

/** "Legion Athletics" → "legionathletics.com": a free first guess, only kept if the site confirms it. */
export function guessDomain(name: string): string | null {
  const key = compact(name.replace(/^the\s+/i, "").replace(/[™®©]/g, ""));
  return key.length >= 3 ? `${key}.com` : null;
}

/**
 * Free site checks (no credits), bounded so the request stays inside its time
 * limit: confirms a guessed domain (the site must call itself by the brand's
 * name) and looks for an affiliate page or network link on the homepage. Site
 * evidence is preferred over a list mention because it comes from the store.
 */
async function addSiteEvidence(stores: DiscoveredStore[], deadline: number): Promise<void> {
  const todo = stores.filter((s) => !s.domain || s.program?.via !== "site");
  await mapLimit(todo, 8, async (s) => {
    if (Date.now() > deadline) return;
    const domain = s.domain ?? guessDomain(s.name);
    if (!domain || !isLikelyStoreDomain(domain)) return;
    const probe = await probeStoreSite(domain).catch(() => null);
    if (!probe?.ok) return;
    if (!s.domain) {
      const brandKey = compact(s.name.replace(/^the\s+/i, "")).slice(0, 6);
      if (!probe.siteName || !compact(probe.siteName).includes(brandKey)) return; // parked or unrelated domain
      s.domain = domain;
    }
    if (probe.program) s.program = { via: "site", label: probe.program.label, url: probe.program.url };
  });
}

/** ~3.5k tokens: input + output must stay under Groq free tier's 8k tokens per request-minute. */
const CHAR_BUDGET = 13_000;
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

/**
 * Read-time decoration (never saved): the existing Store Check for a store (so
 * it opens for free), your own history with it from Accounting, and the lead
 * score that ranks it.
 */
async function attachChecks(stores: DiscoveredStore[]): Promise<DiscoveredStore[]> {
  const [checks, mine, money] = await Promise.all([
    StoreCheck.find({}, "domain name score").lean(),
    Store.find({}, "name websiteUrl").lean(),
    getStoreMoneySummaries().catch(() => []),
  ]);
  const mineByDomain = new Map(mine.filter((m) => m.websiteUrl).map((m) => [domainOfUrl(m.websiteUrl as string) ?? "", m]));
  return stores.map((s) => {
    const c = checks.find((x) => (s.domain && x.domain === s.domain) || (x.name && compact(x.name) === compact(s.name)));
    const score = c?.score as ScoreResult | null | undefined;
    const domain = s.domain ?? c?.domain ?? null;
    const own = domain ? mineByDomain.get(domain) : undefined;
    const m = own ? money.find((x) => x.storeId === String(own._id)) : undefined;
    const yours = own ? { onSite: true, lostCents: m?.lostCents ?? 0, spentCents: m?.spentCents ?? 0, netCents: m?.netCents ?? 0 } : null;
    const check = c && score ? { id: String(c._id), verdict: score.verdict, trust: score.trust } : null;
    const lead = leadScore({
      hasSiteEvidence: s.program?.via === "site",
      commissionMax: s.commission?.max ?? null,
      network: s.network ?? null,
      tier: s.tier ?? null,
      warning: s.warning ?? null,
      checkVerdict: check?.verdict ?? null,
      lostMoneyBefore: (yours?.lostCents ?? 0) > 0,
    });
    return { ...s, domain, check, yours, lead };
  });
}

export interface DiscoveryResult {
  id: string;
  /** Saved before results were filtered to stores with affiliate programs. */
  legacy: boolean;
  hidden: HiddenStore[];
  country: string;
  category: string;
  keyword: string | null;
  stores: DiscoveredStore[];
  cached: boolean;
  createdAt: string;
}

export async function discoverStores(opts: { country: string; category: string; keyword?: string | null; force?: boolean; more?: boolean }): Promise<{
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
  if (cached && !opts.force && !opts.more) {
    return { id: String(cached._id), stores: await attachChecks(cached.results as DiscoveredStore[]), cached: true, createdAt: new Date(cached.updatedAt).toISOString() };
  }

  const topic = keyword ? `${keyword} (${opts.category})` : opts.category;
  // "Find more" looks from different angles (network directories, coupon/PPC-friendly programs, programs with stated rates) and merges into the saved search.
  const queries = opts.more
    ? [
        `${topic} brands on Impact OR Awin OR ShareASale OR "CJ Affiliate" OR FlexOffers OR Rakuten affiliate program ${countryName}`,
        `${topic} affiliate program coupon sites allowed paid search PPC allowed ${countryName}`,
        `${topic} brands "join our affiliate program" commission cookie ${countryName}`,
      ]
    : [
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
          maxOutputTokens: 2800,
          deadline: Date.now() + 45_000,
        })
      ).data.brands
    : [];

  const startedAt = Date.now();
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
    const proofUrl = listProgramEvidence(b.programQuote, b.name, sources);
    // Being listed in an "affiliate programs" round-up is evidence too (weaker than the store's own site, which is checked next).
    const roundup = /affiliate|partner program|referral program/i.test(`${home.title} ${home.url}`);
    stores.push({
      name: b.name.trim(),
      domain,
      note,
      sourceUrl: home.url,
      sourceTitle: home.title,
      check: null,
      program: proofUrl
        ? { via: "list", label: note ?? "Affiliate program named in the source", url: proofUrl }
        : roundup
          ? { via: "list", label: note ?? `Listed in “${home.title.slice(0, 70)}”`, url: home.url }
          : null,
    });
  }
  for (const r of homepageHits) {
    const domain = domainOfUrl(r.url) as string;
    const titlePart = (r.title.split(/\s[|–—:-]\s/)[0] ?? "").trim();
    // Homepage titles are often slogans ("Pet Products, Supplies & Accessories") — fall back to the domain's name.
    const name = titlePart && compact(titlePart).includes(compact(domain.split(".")[0] ?? "")) ? titlePart.slice(0, 60) : nameFromDomain(domain);
    if (stores.some((s) => s.domain === domain || compact(s.name) === compact(name))) continue;
    stores.push({ name, domain, note: null, sourceUrl: r.url, sourceTitle: r.title, check: null, program: null });
  }

  // Only stores with affiliate-program evidence are kept; the rest are listed as hidden.
  await addSiteEvidence(stores, Math.max(startedAt + 18_000, Date.now() + 14_000));
  let kept = stores.filter((s) => s.program);
  let hidden: HiddenStore[] = stores.filter((s) => !s.program).map((s) => ({ name: s.name, domain: s.domain }));

  // "Find more" keeps everything already saved (including its enrichment) and only adds new brands.
  if (opts.more && cached) {
    const have = (cached.results ?? []) as DiscoveredStore[];
    const same = (a: { name: string; domain: string | null }, b: { name: string; domain: string | null }) => (a.domain && a.domain === b.domain) || compact(a.name) === compact(b.name);
    kept = [...have, ...kept.filter((n) => !have.some((h) => same(h, n)))];
    const oldHidden = (cached.hidden ?? []) as HiddenStore[];
    hidden = [...oldHidden, ...hidden.filter((h) => !oldHidden.some((o) => same(o, h)) && !kept.some((k) => same(k, h)))];
  }

  const saved = await StoreDiscovery.findOneAndUpdate(
    { key },
    { $set: { country: opts.country, category: opts.category, keyword, results: kept, hidden, programFiltered: true }, $inc: { tavilyCredits: credits } },
    { upsert: true, new: true }
  );
  return { id: String(saved._id), stores: await attachChecks(kept), cached: false, createdAt: new Date().toISOString() };
}

/**
 * Filters a search saved before program filtering existed — for free: a
 * commission note from the list counts as evidence, otherwise the store's
 * own site is checked for an affiliate page or network link.
 */
export async function filterSavedDiscovery(id: string): Promise<void> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return;
  await connectToDatabase();
  const d = await StoreDiscovery.findById(id).lean();
  if (!d || d.programFiltered) return;
  const stores = ((d.results ?? []) as DiscoveredStore[]).map((s) => ({
    ...s,
    program: s.program ?? (s.note && PROGRAM_WORDS.test(s.note) ? { via: "list" as const, label: s.note.replace(/\s*\(?source\s*\d+\)?/gi, "").trim(), url: s.sourceUrl } : null),
  }));
  await addSiteEvidence(stores, Date.now() + 45_000);
  const kept = stores.filter((s) => s.program);
  const hidden: HiddenStore[] = stores.filter((s) => !s.program).map((s) => ({ name: s.name, domain: s.domain }));
  await StoreDiscovery.updateOne({ _id: d._id }, { $set: { results: kept, hidden, programFiltered: true } });
}

/* ---------- Free enrichment ---------- */

async function enrichOne(s: DiscoveredStore, deadline: number): Promise<void> {
  const domain = s.domain;
  const text = `${s.program?.label ?? ""} ${s.note ?? ""}`;
  s.commission = parseCommission(text);
  if (!domain || Date.now() > deadline) return;
  const [probe, traffic] = await Promise.all([probeStoreSite(domain).catch(() => null), fetchTraffic(domain).catch(() => null)]);
  s.network = probe?.program?.network ?? (s.program?.url ? networkForUrl(s.program.url) : null) ?? s.network ?? null;
  if (traffic) {
    s.rank = traffic.rank;
    s.tier = trafficTier(traffic.rank);
  }
  // Read the store's own affiliate page (not a network's) and look for rules about coupon sites / paid search / brand terms.
  const pageUrl = probe?.program?.url ?? (s.program?.via === "site" ? s.program.url : null);
  if (pageUrl && domainOfUrl(pageUrl) === domain && Date.now() < deadline) {
    const res = await safeFetch(pageUrl, { timeoutMs: 7000, maxBytes: 1_500_000 }).catch(() => null);
    if (res?.ok && res.text) s.warning = scanAdRules(htmlToText(res.text), pageUrl);
  }
  // Done only if the popularity lookup worked (it is rate-limited) — otherwise try again next time.
  s.enriched = Boolean(traffic);
}

/**
 * Adds free early signals (network, commission rate, popularity rank, rules on
 * the store's affiliate page) to saved stores that don't have them yet. No web
 * search credits and no AI; bounded per call — the page calls it again while
 * `remaining` is above zero.
 */
export async function enrichPending(opts: { limit?: number; budgetMs?: number } = {}): Promise<{ done: number; remaining: number }> {
  await connectToDatabase();
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const limit = opts.limit ?? 8;
  const [docs, checks] = await Promise.all([StoreDiscovery.find({}).sort({ updatedAt: -1 }).limit(100), StoreCheck.find({}, "domain name").lean()]);
  const pending: { doc: (typeof docs)[number]; store: DiscoveredStore }[] = [];
  let total = 0;
  for (const doc of docs) {
    for (const store of (doc.results ?? []) as DiscoveredStore[]) {
      // A store saved without a website can still be enriched once a Store Check has revealed its domain.
      if (!store.domain) store.domain = domainFromChecks(store, checks);
      if (!needsEnrichment(store)) continue;
      total++;
      if (pending.length < limit) pending.push({ doc, store });
    }
  }
  await mapLimit(pending, 2, async ({ store }) => {
    await enrichOne(store, deadline);
  });
  const touched = new Set(pending.map((p) => p.doc));
  for (const doc of touched) {
    // A plain $set (not doc.save) so two overlapping enrichment calls can't fail with a version conflict.
    await StoreDiscovery.updateOne({ _id: doc._id }, { $set: { results: doc.toObject().results } }, { timestamps: false });
  }
  const finished = pending.filter((p) => p.store.enriched).length;
  return { done: finished, remaining: Math.max(0, total - finished) };
}

function domainFromChecks(s: DiscoveredStore, checks: { domain: string; name?: string | null }[]): string | null {
  return checks.find((c) => c.name && compact(c.name) === compact(s.name))?.domain ?? null;
}

/** Only stores with a known website can be enriched; the rest are skipped (not retried forever). */
function needsEnrichment(s: DiscoveredStore): boolean {
  return !s.enriched && Boolean(s.domain);
}

export async function countPendingEnrichment(): Promise<number> {
  await connectToDatabase();
  const [docs, checks] = await Promise.all([StoreDiscovery.find({}, "results").sort({ updatedAt: -1 }).limit(100).lean(), StoreCheck.find({}, "domain name").lean()]);
  return docs.reduce(
    (n, d) => n + ((d.results ?? []) as DiscoveredStore[]).filter((s) => !s.enriched && Boolean(s.domain ?? domainFromChecks(s, checks))).length,
    0
  );
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
    legacy: !d.programFiltered,
    hidden: (d.hidden ?? []) as HiddenStore[],
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
