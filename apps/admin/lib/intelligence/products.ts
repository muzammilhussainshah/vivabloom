import { productExplanationSchema } from "@monocoupon/validation";
import { STORE_PRODUCTS_SYSTEM_PROMPT, storeProductsPrompt } from "@/lib/ai/prompts";
import { llmJson } from "./llm";
import { getRobots, mapLimit, marketHeaders, safeFetch } from "./safeFetch";
import { tavilySearch, type TavilyResult } from "./tavily";
import { getJsonLd, getLinks, ldType } from "./html";
import { compact, domainOfUrl } from "./domain";
import type { IdentityResult, PolicyItem, ProductComponent, ProductItem, ProductsResult, ProgramResult, SourceRef, StepUsage } from "./types";

/**
 * Step 4 — which products are actually popular, and worth promoting?
 *
 * Popularity comes from evidence the store itself (or the web) gives:
 *  1. the store's own Best Sellers list (Shopify collection or category page),
 *  2. products featured on the homepage, in order,
 *  3. review volume on the product page,
 *  4. how often each product is named in "best selling <brand> products" search results.
 * Candidates come from Shopify's public products.json, or (other platforms)
 * from those pages + the sitemap, enriched with product-page structured data.
 * Everything is scored in code; the AI only explains the top 5 from the facts.
 */

const EXCLUDE_TITLE = /gift ?card|e-?gift|sample|free gift|shipping protection|package protection|insurance|warranty|route\b|donation|replacement part/i;
const BESTSELLER_SLUGS = ["best-sellers", "bestsellers", "best-seller", "bestseller", "best-selling"];
const BESTSELLER_LINK = /best[-_ ]?sell|bestseller|top[-_ ]?sell|most[-_ ]?popular|fan[-_ ]?fav|most[-_ ]?loved|top[-_ ]?rated|customer[-_ ]?fav/i;
const PRODUCT_PATH = /\/products?\/[^/?#]+|\/p\/[^?#]+|\/dp\/[^/?#]+/i;
const ENRICH_COUNT = 14;
const TOP_COUNT = 5;

interface Candidate {
  key: string;
  id: string;
  name: string;
  url: string;
  image: string | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  available: boolean;
  productType: string | null;
  descriptionLength: number;
  imageCount: number;
  bestsellerRank: number | null;
  featuredRank: number | null;
  webMentions: number;
  rating: number | null;
  reviewCount: number | null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : Math.round((((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2) * 100) / 100;
}

function https(src: unknown): string | null {
  if (typeof src !== "string" || !src) return null;
  return src.startsWith("//") ? `https:${src}` : src.replace(/^http:/, "https:");
}

/** Same product, however it's linked: Shopify handle, else the path without locale prefix/query. */
export function productKey(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/+$/, "");
    const handle = path.match(/\/products\/([^/]+)/)?.[1];
    return handle ? `h:${handle}` : `p:${path.replace(/^\/[a-z]{2}(-[a-z]{2,4})?(?=\/)/, "")}`;
  } catch {
    return url;
  }
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  const res = await safeFetch(url, { accept: "application/json", timeoutMs: 12_000, maxBytes: 6_000_000, headers });
  if (!res.ok || !res.text) return null;
  try {
    return JSON.parse(res.text);
  } catch {
    return null;
  }
}

interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  images?: { src?: string }[];
  variants?: { price?: string; compare_at_price?: string | null; available?: boolean }[];
}

function fromShopify(p: ShopifyProduct, origin: string, currency: string | null): Candidate | null {
  if (!p.handle || !p.title) return null;
  const variants = p.variants ?? [];
  const availableVariants = variants.filter((v) => v.available !== false);
  const pool = availableVariants.length ? availableVariants : variants;
  // The typical (median) variant price — the cheapest variant is often a sample or single unit.
  const price = median(pool.map((v) => num(v.price)).filter((n): n is number => n != null && n > 0));
  const atPrice = pool.reduce<(typeof pool)[number] | undefined>((best, v) => (!best || Math.abs((num(v.price) ?? 0) - (price ?? 0)) < Math.abs((num(best.price) ?? 0) - (price ?? 0)) ? v : best), undefined);
  const compare = num(atPrice?.compare_at_price);
  return {
    key: `h:${p.handle.toLowerCase()}`,
    id: String(p.id ?? p.handle),
    name: p.title.trim(),
    url: `${origin}/products/${p.handle}`,
    image: https(p.images?.[0]?.src),
    price,
    compareAtPrice: compare != null && price != null && compare > price ? compare : null,
    currency,
    available: variants.length === 0 ? true : availableVariants.length > 0,
    productType: p.product_type?.trim() || null,
    descriptionLength: (p.body_html ?? "").replace(/<[^>]+>/g, " ").trim().length,
    imageCount: p.images?.length ?? 0,
    bestsellerRank: null,
    featuredRank: null,
    webMentions: 0,
    rating: null,
    reviewCount: null,
  };
}

const isProductLd = (o: Record<string, unknown>) => ldType(o).some((t) => t === "product" || t === "productgroup");

/** Offers of a Product, or of a ProductGroup's variants (cheapest first). */
function ldOffers(product: Record<string, unknown>): Record<string, unknown>[] {
  const own = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];
  const variants = Array.isArray(product.hasVariant) ? (product.hasVariant as Record<string, unknown>[]) : [];
  const fromVariants = variants.flatMap((v) => (Array.isArray(v.offers) ? v.offers : v.offers ? [v.offers] : []));
  return ([...own, ...fromVariants] as Record<string, unknown>[])
    .filter((o) => o && typeof o === "object")
    .sort((x, y) => (num(x.price ?? x.lowPrice) ?? Infinity) - (num(y.price ?? y.lowPrice) ?? Infinity));
}

/** Rating + review count from a product page: JSON-LD first, then common review-app markup. */
export function ratingFromHtml(html: string): { rating: number | null; reviewCount: number | null; currency: string | null } {
  for (const obj of getJsonLd(html)) {
    if (!isProductLd(obj)) continue;
    const agg = obj.aggregateRating as Record<string, unknown> | undefined;
    const offers = ldOffers(obj)[0];
    const currency = typeof offers?.priceCurrency === "string" ? offers.priceCurrency : null;
    if (agg) {
      const rating = num(agg.ratingValue);
      const count = num(agg.reviewCount) ?? num(agg.ratingCount);
      if (rating != null) return { rating, reviewCount: count != null ? Math.round(count) : null, currency };
    }
    if (currency) return { ...ratingFromMarkup(html), currency };
  }
  return { ...ratingFromMarkup(html), currency: null };
}

function ratingFromMarkup(html: string): { rating: number | null; reviewCount: number | null } {
  const patterns: [RegExp, RegExp][] = [
    // Judge.me
    [/data-average-rating=["']([\d.]+)["']/i, /data-number-of-reviews=["'](\d+)["']/i],
    // Loox
    [/class=["'][^"']*loox-rating[^"']*["'][^>]*data-rating=["']([\d.]+)["']/i, /data-raters=["'](\d+)["']/i],
    // Shopify standard review metafields rendered into theme JSON
    [/"rating"\s*:\s*\{[^}]*"value"\s*:\s*"?([\d.]+)/i, /"rating_count"\s*:\s*"?(\d+)/i],
    // Generic embedded JSON (Okendo, Stamped, Yotpo themes…)
    [/"(?:ratingValue|averageRating|average_rating|reviewAverageValue|avgRating)"\s*:\s*"?([\d.]+)/i, /"(?:reviewCount|ratingCount|reviews_count|totalReviews|numReviews)"\s*:\s*"?(\d+)/i],
  ];
  for (const [avgRe, countRe] of patterns) {
    const avg = html.match(avgRe)?.[1];
    if (avg && Number(avg) > 0 && Number(avg) <= 5) {
      const count = html.match(countRe)?.[1];
      return { rating: Number(avg), reviewCount: count ? Number(count) : null };
    }
  }
  return { rating: null, reviewCount: null };
}

/** Product links on a page, in the order they appear (deduped, same store only). */
function productLinksInOrder(html: string, pageUrl: string, domain: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const link of getLinks(html, pageUrl)) {
    if (domainOfUrl(link.href) !== domain || !PRODUCT_PATH.test(new URL(link.href).pathname)) continue;
    const key = productKey(link.href);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link.href.split("?")[0] as string);
  }
  return out;
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => (m[1] ?? "").replace(/&amp;/g, "&"));
}

async function sitemapProductUrls(origin: string): Promise<string[]> {
  const robots = await getRobots(origin);
  const roots = robots?.sitemaps.length ? robots.sitemaps.slice(0, 2) : [`${origin}/sitemap.xml`];
  const urls: string[] = [];
  for (const root of roots) {
    const res = await safeFetch(root, { accept: "application/xml,text/xml", timeoutMs: 10_000, maxBytes: 5_000_000 });
    if (!res.ok) continue;
    const entries = locs(res.text);
    const children = entries.filter((u) => /\.xml/i.test(u));
    if (children.length) {
      const productMaps = children.filter((u) => /product/i.test(u)).slice(0, 2);
      for (const child of productMaps.length ? productMaps : children.slice(0, 1)) {
        const c = await safeFetch(child, { accept: "application/xml,text/xml", timeoutMs: 10_000, maxBytes: 5_000_000 });
        if (c.ok) urls.push(...locs(c.text));
      }
    } else {
      urls.push(...entries);
    }
    if (urls.length) break;
  }
  return [...new Set(urls.filter((u) => PRODUCT_PATH.test(u)))].slice(0, 60);
}

/** Reads one product page into a candidate (or enriches an existing one). */
async function readProductPage(url: string, headers: Record<string, string>, base: Candidate | null): Promise<Candidate | null> {
  const res = await safeFetch(url, { timeoutMs: 9000, maxBytes: 3_000_000, headers });
  if (!res.ok) return base;
  const rating = ratingFromHtml(res.text);
  if (base) {
    return { ...base, rating: rating.rating, reviewCount: rating.reviewCount, currency: rating.currency ?? base.currency };
  }
  const product = getJsonLd(res.text).find(isProductLd);
  if (!product || typeof product.name !== "string") return null;
  const offerList = ldOffers(product);
  const offer = offerList[0];
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  return {
    key: productKey(url),
    id: url,
    name: product.name.trim(),
    url,
    image: https(typeof image === "string" ? image : (image as Record<string, unknown> | undefined)?.url),
    price: median(offerList.map((o) => num(o.price ?? o.lowPrice)).filter((n): n is number => n != null && n > 0)),
    compareAtPrice: null,
    currency: typeof offer?.priceCurrency === "string" ? offer.priceCurrency : null,
    available: offerList.length === 0 || offerList.some((o) => !/OutOfStock|Discontinued|SoldOut/i.test(String(o.availability ?? ""))),
    productType: typeof product.category === "string" ? product.category : null,
    descriptionLength: typeof product.description === "string" ? product.description.length : 0,
    imageCount: Array.isArray(product.image) ? product.image.length : product.image ? 1 : 0,
    bestsellerRank: null,
    featuredRank: null,
    webMentions: 0,
    rating: rating.rating,
    reviewCount: rating.reviewCount,
  };
}

/** 0–1: how well a price suits paid search (too cheap = tiny commission, very expensive = low conversion). */
export function priceFit(price: number | null): number | null {
  if (price == null) return null;
  if (price < 15) return 0.1;
  if (price < 40) return 0.1 + ((price - 15) / 25) * 0.9;
  if (price <= 300) return 1;
  if (price <= 800) return 1 - ((price - 300) / 500) * 0.5;
  return 0.4;
}

function percentile(value: number, all: number[]): number {
  if (all.length <= 1) return 0.5;
  const below = all.filter((v) => v < value).length;
  const equal = all.filter((v) => v === value).length;
  return (below + (equal - 1) / 2) / (all.length - 1);
}

export function commissionRange(price: number | null, program: ProgramResult | null): { min: number | null; max: number | null } {
  if (price == null || !program || program.commission.status !== "verified") return { min: null, max: null };
  const c = program.commission;
  if (c.type === "fixed" && c.fixedAmount != null) return { min: c.fixedAmount, max: c.fixedAmount };
  if (c.rateMin != null) {
    const max = c.rateMax ?? c.rateMin;
    return { min: Math.round(price * c.rateMin) / 100, max: Math.round(price * max) / 100 };
  }
  return { min: null, max: null };
}

/**
 * 0–1 popularity from whatever store-level signals exist. A signal only
 * counts when the store has it at all (e.g. a Best Sellers list); then a
 * product missing from that list scores 0 on it. No signals → null (unknown).
 */
export function popularityScore(c: Candidate, present: { bestseller: boolean; featured: boolean; reviews: boolean; mentions: boolean }): number | null {
  const parts: [number, number][] = [];
  if (present.bestseller) parts.push([0.35, c.bestsellerRank ? Math.max(0.45, 1 - (c.bestsellerRank - 1) * 0.06) : 0]);
  if (present.featured) parts.push([0.2, c.featuredRank ? Math.max(0.3, 1 - (c.featuredRank - 1) * 0.05) : 0]);
  // Review volume is the hardest popularity signal to fake: ~3,000+ reviews scores full marks.
  if (present.reviews) parts.push([0.3, c.reviewCount ? Math.min(1, Math.log10(c.reviewCount + 1) / 3.5) : 0]);
  if (present.mentions) parts.push([0.15, Math.min(1, c.webMentions / 3)]);
  if (!parts.length) return null;
  const w = parts.reduce((s, [weight]) => s + weight, 0);
  return parts.reduce((s, [weight, v]) => s + weight * v, 0) / w;
}

type Scored = Candidate & { score: number; confidence: number; components: ProductComponent[]; estMin: number | null; estMax: number | null };

/** Deterministic product score (0–100) and its confidence (share of weights that had data). */
export function scoreCandidates(candidates: Candidate[], program: ProgramResult | null): Scored[] {
  const prices = candidates.map((c) => c.price).filter((p): p is number => p != null);
  const present = {
    bestseller: candidates.some((c) => c.bestsellerRank != null),
    featured: candidates.some((c) => c.featuredRank != null),
    reviews: candidates.some((c) => c.reviewCount != null),
    mentions: candidates.some((c) => c.webMentions > 0),
  };
  const commissionKnown = program?.commission.status === "verified";
  return candidates.map((c) => {
    const est = commissionRange(c.price, program);
    const quality = c.rating != null ? Math.pow(Math.min(c.rating, 5) / 5, 3) * Math.min(1, Math.log10((c.reviewCount ?? 0) + 1) / 1.5) : null;
    const discount = c.price != null ? (c.compareAtPrice ? 0.5 + Math.min(0.5, (c.compareAtPrice - c.price) / c.compareAtPrice) : 0.3) : null;
    const pageQuality = Math.min(1, (Math.min(c.imageCount, 4) / 4) * 0.6 + (Math.min(c.descriptionLength, 600) / 600) * 0.4);
    const components: ProductComponent[] = [
      { key: "popularity", label: "Popularity (best-sellers, homepage, reviews, web)", value: popularityScore(c, present), weight: 0.45 },
      { key: "commission", label: commissionKnown ? "Commission per sale" : "Price (commission unknown)", value: c.price == null ? null : percentile(c.price, prices), weight: 0.2 },
      { key: "reviews", label: "Customer rating", value: quality, weight: 0.1 },
      { key: "priceFit", label: "Price suits paid search", value: priceFit(c.price), weight: 0.15 },
      { key: "discount", label: "On sale", value: discount, weight: 0.05 },
      { key: "pageQuality", label: "Product page quality", value: pageQuality, weight: 0.05 },
    ];
    const available = components.filter((x) => x.value != null);
    const totalWeight = available.reduce((s, x) => s + x.weight, 0);
    const score = totalWeight ? Math.round((available.reduce((s, x) => s + x.weight * (x.value as number), 0) / totalWeight) * 100) : 0;
    return { ...c, score, confidence: Math.round(totalWeight * 100) / 100, components, estMin: est.min, estMax: est.max };
  });
}

const VARIANT_WORDS = /\b(quarterly|monthly|annual|yearly|refills?|subscription|subscribe|one[- ]time|starter|trial|kit|pack|set of \d+|\d+[- ]?(pack|count|ct|pcs))\b/gi;

/**
 * Groups variants of one product ("Daily Longevity", "Daily Longevity – Quarterly
 * Refills") so the top 5 shows five different products. A leading "Brand – "
 * segment is skipped so it doesn't merge a whole catalogue into one family.
 */
export function productFamily(name: string, storeName: string): string {
  const store = storeName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const parts = name.split(/\s[-–—|]\s|:\s|\(/).map((p) => p.trim()).filter(Boolean);
  const meaningful = parts.filter((p) => {
    const c = p.toLowerCase().replace(/[^a-z0-9]/g, "");
    return c && !(store && (c === store || c === `the${store}` || store.includes(c))) && p.replace(VARIANT_WORDS, "").replace(/[^a-z0-9]/gi, "").length > 0;
  });
  const base = (meaningful[0] ?? parts[0] ?? name).replace(VARIANT_WORDS, " ");
  return base.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** How many search results name this product (its family name, minus the brand). */
export function countMentions(c: { name: string }, storeName: string, results: { title: string; content: string }[]): number {
  const store = compact(storeName);
  const key = productFamily(c.name, storeName).replace(store, "");
  if (key.length < 5) return 0;
  return results.filter((r) => compact(`${r.title} ${r.content}`).includes(key)).length;
}

const OVERCLAIM = /\b(guaranteed?|sure[- ]?fire|winning product|can't lose|cannot lose)\b/gi;

export async function runProductsStep(args: {
  domain: string;
  name: string;
  identity: IdentityResult | null;
  program: ProgramResult | null;
  policies: PolicyItem[] | null;
  targetCountry: string | null;
  deadline: number;
}): Promise<{ products: ProductsResult; sources: SourceRef[]; usage: StepUsage }> {
  const usage: StepUsage = { tavilyCredits: 0, llmInputTokens: 0, llmOutputTokens: 0 };
  const home = args.identity?.homepageUrl ?? `https://www.${args.domain}/`;
  const origin = new URL(home).origin;
  // Ask for one market's prices (default US/USD) so they don't follow the server's IP location.
  const market = marketHeaders(args.targetCountry);
  const now = new Date().toISOString();

  // 1. Catalogue, homepage and web popularity in parallel.
  const [shopData, homepage, web] = await Promise.all([
    fetchJson(`${origin}/products.json?limit=250`, market.headers) as Promise<{ products?: ShopifyProduct[] } | null>,
    safeFetch(home, { timeoutMs: 12_000, maxBytes: 3_000_000, headers: market.headers }),
    tavilySearch(`"${args.name}" best selling most popular products`, { maxResults: 8 }).catch(() => ({ results: [] as TavilyResult[], credits: 0 })),
  ]);
  usage.tavilyCredits += web.credits;
  const isShopify = Boolean(shopData?.products?.length);
  const homeHtml = homepage.ok ? homepage.text : "";
  const featured = homeHtml ? productLinksInOrder(homeHtml, homepage.url, args.domain).slice(0, 30) : [];

  // 2. The store's own best-seller list: a link on the homepage, else common Shopify handles.
  const bestLinks = homeHtml
    ? [...new Set(getLinks(homeHtml, homepage.url).filter((l) => domainOfUrl(l.href) === args.domain && BESTSELLER_LINK.test(`${l.href} ${l.text}`) && !/blog|article/i.test(l.href)).map((l) => l.href.split("?")[0] as string))].slice(0, 2)
    : [];
  let bestsellers: string[] = [];
  let bestsellerSource: string | null = null;
  if (isShopify) {
    const handles = [...bestLinks.map((u) => u.match(/\/collections\/([^/?#]+)/)?.[1]).filter((h): h is string => Boolean(h)), ...BESTSELLER_SLUGS];
    const lists = await Promise.all(
      [...new Set(handles)].slice(0, 6).map((h) => fetchJson(`${origin}/collections/${h}/products.json?limit=60`, market.headers) as Promise<{ products?: ShopifyProduct[] } | null>)
    );
    const idx = lists.findIndex((l) => (l?.products?.length ?? 0) > 0);
    if (idx >= 0) {
      bestsellers = (lists[idx]?.products ?? []).map((p) => `${origin}/products/${p.handle}`);
      bestsellerSource = `${origin}/collections/${[...new Set(handles)][idx]}`;
    }
  }
  if (!bestsellers.length && bestLinks[0]) {
    const page = await safeFetch(bestLinks[0], { timeoutMs: 10_000, maxBytes: 3_000_000, headers: market.headers });
    if (page.ok) {
      bestsellers = productLinksInOrder(page.text, page.url, args.domain).slice(0, 40);
      if (bestsellers.length) bestsellerSource = bestLinks[0];
    }
  }

  // 3. Candidate pool.
  const pool = new Map<string, Candidate>();
  if (isShopify) {
    for (const p of shopData?.products ?? []) {
      const c = fromShopify(p, origin, market.currency);
      if (c) pool.set(c.key, c);
    }
  }
  const rankOf = (list: string[]) => new Map(list.map((u, i) => [productKey(u), i + 1] as const));
  const bestRank = rankOf(bestsellers);
  const featuredRank = rankOf(featured);

  let candidates: Candidate[];
  if (isShopify) {
    candidates = [...pool.values()];
    for (const c of candidates) {
      c.bestsellerRank = bestRank.get(c.key) ?? null;
      c.featuredRank = featuredRank.get(c.key) ?? null;
      c.webMentions = countMentions(c, args.name, web.results);
    }
  } else {
    // Other platforms: read product pages, popular ones first, then fill from the sitemap.
    const urls = [...bestsellers, ...featured];
    if (urls.length < ENRICH_COUNT) urls.push(...(await sitemapProductUrls(origin)));
    const unique = [...new Map(urls.map((u) => [productKey(u), u])).values()].slice(0, ENRICH_COUNT + 6);
    const read = await mapLimit(unique, 6, (u) => readProductPage(u, market.headers, null));
    candidates = read.filter((c): c is Candidate => c !== null);
    for (const c of candidates) {
      c.bestsellerRank = bestRank.get(c.key) ?? null;
      c.featuredRank = featuredRank.get(c.key) ?? null;
      c.webMentions = countMentions(c, args.name, web.results);
    }
  }

  const totalFound = isShopify ? pool.size : candidates.length;
  const usable = candidates.filter((c) => c.available && c.price != null && c.price > 0 && !EXCLUDE_TITLE.test(c.name));
  if (usable.length === 0) {
    return {
      products: {
        source: isShopify ? "shopify" : candidates.length ? "sitemap" : "none",
        totalFound,
        top: [],
        note: totalFound ? "Products were found but none are in stock with a price." : "No public product catalogue could be read from this store.",
        signals: { bestsellerList: bestsellerSource, homepageFeatured: featured.length, webResults: web.results.length },
      },
      sources: [],
      usage,
    };
  }

  // 4. One entry per product family; popular products are always shortlisted for page reads.
  const families = new Set<string>();
  const preRanked = scoreCandidates(usable, args.program)
    .sort((a, b) => Number(b.bestsellerRank != null || b.featuredRank != null) - Number(a.bestsellerRank != null || a.featuredRank != null) || b.score - a.score)
    .filter((c) => {
      const family = productFamily(c.name, args.name);
      if (families.has(family)) return false;
      families.add(family);
      return true;
    });
  let shortlist: Candidate[] = preRanked.slice(0, ENRICH_COUNT);
  if (isShopify) {
    shortlist = (await mapLimit(shortlist, 6, (c) => readProductPage(c.url, market.headers, c))).filter((c): c is Candidate => c !== null);
  }
  const ranked = scoreCandidates(shortlist, args.program).sort((a, b) => b.score - a.score).slice(0, TOP_COUNT);

  const top: ProductItem[] = ranked.map((c) => ({
    id: c.id,
    name: c.name,
    url: c.url,
    image: c.image,
    price: c.price,
    compareAtPrice: c.compareAtPrice,
    currency: c.currency ?? market.currency,
    available: c.available,
    rating: c.rating,
    reviewCount: c.reviewCount,
    bestsellerRank: c.bestsellerRank,
    featuredRank: c.featuredRank,
    webMentions: c.webMentions,
    productType: c.productType,
    estCommissionMin: c.estMin,
    estCommissionMax: c.estMax,
    score: c.score,
    confidence: c.confidence,
    components: c.components,
    why: "",
    strengths: [],
    risks: [],
    adAngle: "",
    audience: "",
    keywordIdeas: [],
  }));

  let note: string | null = null;
  try {
    const rules = Object.fromEntries((args.policies ?? []).map((p) => [p.key, p.status]));
    const llm = await llmJson({
      task: "storeProducts",
      system: STORE_PRODUCTS_SYSTEM_PROMPT,
      user: storeProductsPrompt({
        store: { name: args.name, domain: args.domain },
        affiliateCommission: args.program?.commission.status === "verified" ? args.program.commission.value : "unknown",
        googleAdsRules: rules,
        products: top.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.productType,
          price: p.price,
          currency: p.currency,
          compareAtPrice: p.compareAtPrice,
          rating: p.rating,
          reviewCount: p.reviewCount,
          rankInStoreBestSellers: p.bestsellerRank,
          positionOnHomepage: p.featuredRank,
          namedInBestSellingSearchResults: p.webMentions,
          estimatedCommissionPerSale: p.estCommissionMin != null ? [p.estCommissionMin, p.estCommissionMax] : "unknown",
          score: p.score,
        })),
      }),
      schema: productExplanationSchema,
      maxOutputTokens: 1600,
      deadline: args.deadline,
    });
    usage.llmInputTokens += llm.inputTokens;
    usage.llmOutputTokens += llm.outputTokens;
    const clean = (s: string) => s.replace(OVERCLAIM, "promising");
    for (const p of top) {
      const e = llm.data.products.find((x) => x.id === p.id);
      if (!e) continue;
      p.why = clean(e.why);
      p.strengths = e.strengths.map(clean);
      p.risks = e.risks.map(clean);
      p.adAngle = clean(e.adAngle);
      p.audience = clean(e.audience);
      p.keywordIdeas = e.keywordIdeas;
    }
  } catch (err) {
    note = `Product scores are complete, but the AI notes failed: ${err instanceof Error ? err.message : "unknown error"}. Re-run this step to retry.`;
  }

  const sources: SourceRef[] = [
    { url: isShopify ? `${origin}/products.json` : `${origin}/sitemap.xml`, title: "Store product catalogue", kind: "store_site", fetchedAt: now },
  ];
  if (bestsellerSource) sources.push({ url: bestsellerSource, title: "Store best-sellers list", kind: "store_site", fetchedAt: now });
  for (const r of web.results.filter((r) => top.some((p) => countMentions(p, args.name, [r]) > 0)).slice(0, 4)) {
    sources.push({ url: r.url, title: r.title, kind: "search_result", fetchedAt: now });
  }

  return {
    products: {
      source: isShopify ? "shopify" : "sitemap",
      totalFound,
      top,
      note,
      signals: { bestsellerList: bestsellerSource, homepageFeatured: featured.length, webResults: web.results.length },
    },
    sources,
    usage,
  };
}

