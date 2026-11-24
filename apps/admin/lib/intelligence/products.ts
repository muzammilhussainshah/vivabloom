import { productExplanationSchema } from "@monocoupon/validation";
import { STORE_PRODUCTS_SYSTEM_PROMPT, storeProductsPrompt } from "@/lib/ai/prompts";
import { llmJson } from "./llm";
import { getRobots, mapLimit, marketHeaders, safeFetch } from "./safeFetch";
import { getJsonLd, ldType } from "./html";
import type { IdentityResult, PolicyItem, ProductComponent, ProductItem, ProductsResult, ProgramResult, SourceRef, StepUsage } from "./types";

/**
 * Step 4 — which products look most promising to promote? Reads the store's
 * own public catalogue (Shopify's public products.json, or the sitemap +
 * product-page structured data), enriches the best candidates with their
 * ratings, scores them in code, and asks the AI only to explain the top 5
 * from those facts. No web-search credits are used.
 */

const EXCLUDE_TITLE = /gift ?card|e-?gift|sample|free gift|shipping protection|package protection|insurance|warranty|route\b|donation|replacement part/i;
const BESTSELLER_SLUGS = ["best-sellers", "bestsellers", "best-seller", "bestseller", "best-selling"];
const ENRICH_COUNT = 12;
const TOP_COUNT = 5;

interface Candidate {
  id: string;
  name: string;
  url: string;
  image: string | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  available: boolean;
  productType: string | null;
  tags: string[];
  descriptionLength: number;
  imageCount: number;
  bestsellerRank: number | null;
  rating: number | null;
  reviewCount: number | null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function https(src: unknown): string | null {
  if (typeof src !== "string" || !src) return null;
  return src.startsWith("//") ? `https:${src}` : src.replace(/^http:/, "https:");
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
  const prices = pool.map((v) => num(v.price)).filter((n): n is number => n != null && n > 0);
  const price = prices.length ? Math.min(...prices) : null;
  const cheapest = pool.find((v) => num(v.price) === price);
  const compare = num(cheapest?.compare_at_price);
  const tags = Array.isArray(p.tags) ? p.tags : typeof p.tags === "string" ? p.tags.split(",").map((t) => t.trim()) : [];
  return {
    id: String(p.id ?? p.handle),
    name: p.title.trim(),
    url: `${origin}/products/${p.handle}`,
    image: https(p.images?.[0]?.src),
    price,
    compareAtPrice: compare != null && price != null && compare > price ? compare : null,
    currency,
    available: variants.length === 0 ? true : availableVariants.length > 0,
    productType: p.product_type?.trim() || null,
    tags,
    descriptionLength: (p.body_html ?? "").replace(/<[^>]+>/g, " ").trim().length,
    imageCount: p.images?.length ?? 0,
    bestsellerRank: tags.some((t) => /best.?sell/i.test(t)) ? 999 : null,
    rating: null,
    reviewCount: null,
  };
}

/** Rating + review count from a product page: JSON-LD first, then common review-app markup (Judge.me, generic embedded JSON). */
export function ratingFromHtml(html: string): { rating: number | null; reviewCount: number | null; currency: string | null } {
  for (const obj of getJsonLd(html)) {
    if (!ldType(obj).includes("product")) continue;
    const agg = obj.aggregateRating as Record<string, unknown> | undefined;
    const offers = (Array.isArray(obj.offers) ? obj.offers[0] : obj.offers) as Record<string, unknown> | undefined;
    const currency = typeof offers?.priceCurrency === "string" ? offers.priceCurrency : null;
    if (agg) {
      const rating = num(agg.ratingValue);
      const count = num(agg.reviewCount) ?? num(agg.ratingCount);
      if (rating != null) return { rating, reviewCount: count != null ? Math.round(count) : null, currency };
    }
    if (currency) return { rating: null, reviewCount: null, currency };
  }
  const judgeAvg = html.match(/data-average-rating=["']([\d.]+)["']/i);
  const judgeCount = html.match(/data-number-of-reviews=["'](\d+)["']/i);
  if (judgeAvg?.[1] && Number(judgeAvg[1]) > 0) {
    return { rating: Number(judgeAvg[1]), reviewCount: judgeCount?.[1] ? Number(judgeCount[1]) : null, currency: null };
  }
  const genericAvg = html.match(/"(?:ratingValue|averageRating|average_rating|reviewAverageValue)"\s*:\s*"?([\d.]+)/i);
  const genericCount = html.match(/"(?:reviewCount|ratingCount|reviews_count|totalReviews)"\s*:\s*"?(\d+)/i);
  if (genericAvg?.[1] && Number(genericAvg[1]) > 0 && Number(genericAvg[1]) <= 5) {
    return { rating: Number(genericAvg[1]), reviewCount: genericCount?.[1] ? Number(genericCount[1]) : null, currency: null };
  }
  return { rating: null, reviewCount: null, currency: null };
}

async function shopifyCatalogue(origin: string, currency: string | null, headers: Record<string, string>): Promise<{ candidates: Candidate[]; ok: boolean }> {
  const data = (await fetchJson(`${origin}/products.json?limit=250`, headers)) as { products?: ShopifyProduct[] } | null;
  if (!data?.products?.length) return { candidates: [], ok: false };
  const candidates = data.products.map((p) => fromShopify(p, origin, currency)).filter((c): c is Candidate => Boolean(c));

  const collections = await Promise.all(
    BESTSELLER_SLUGS.map((slug) => fetchJson(`${origin}/collections/${slug}/products.json?limit=60`, headers) as Promise<{ products?: ShopifyProduct[] } | null>)
  );
  const best = collections.find((c) => (c?.products?.length ?? 0) > 0);
  best?.products?.forEach((p, i) => {
    const match = candidates.find((c) => c.url.endsWith(`/products/${p.handle}`));
    if (match) match.bestsellerRank = Math.min(match.bestsellerRank ?? 999, i + 1);
  });
  return { candidates, ok: true };
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => (m[1] ?? "").replace(/&amp;/g, "&"));
}

async function sitemapCatalogue(origin: string, currency: string | null, headers: Record<string, string>): Promise<Candidate[]> {
  const robots = await getRobots(origin);
  const roots = robots?.sitemaps.length ? robots.sitemaps.slice(0, 2) : [`${origin}/sitemap.xml`];
  let productUrls: string[] = [];
  for (const root of roots) {
    const res = await safeFetch(root, { accept: "application/xml,text/xml", timeoutMs: 10_000, maxBytes: 5_000_000 });
    if (!res.ok) continue;
    const entries = locs(res.text);
    const children = entries.filter((u) => /\.xml/i.test(u));
    if (children.length) {
      const productMaps = children.filter((u) => /product/i.test(u)).slice(0, 2);
      for (const child of productMaps.length ? productMaps : children.slice(0, 1)) {
        const c = await safeFetch(child, { accept: "application/xml,text/xml", timeoutMs: 10_000, maxBytes: 5_000_000 });
        if (c.ok) productUrls.push(...locs(c.text));
      }
    } else {
      productUrls.push(...entries);
    }
    if (productUrls.length) break;
  }
  productUrls = [...new Set(productUrls.filter((u) => /\/products?\//i.test(u) || /\/p\//.test(u)))].slice(0, 18);

  const pages = await mapLimit(productUrls, 6, async (url): Promise<Candidate | null> => {
    const res = await safeFetch(url, { timeoutMs: 9000, maxBytes: 2_500_000, headers });
    if (!res.ok) return null;
    const product = getJsonLd(res.text).find((o) => ldType(o).includes("product"));
    if (!product || typeof product.name !== "string") return null;
    const offers = (Array.isArray(product.offers) ? product.offers[0] : product.offers) as Record<string, unknown> | undefined;
    const rating = ratingFromHtml(res.text);
    const image = Array.isArray(product.image) ? product.image[0] : product.image;
    return {
      id: url,
      name: product.name,
      url,
      image: https(typeof image === "string" ? image : (image as Record<string, unknown> | undefined)?.url),
      price: num(offers?.price ?? offers?.lowPrice),
      compareAtPrice: null,
      currency: (typeof offers?.priceCurrency === "string" ? offers.priceCurrency : null) ?? currency,
      available: !/OutOfStock|Discontinued|SoldOut/i.test(String(offers?.availability ?? "")),
      productType: typeof product.category === "string" ? product.category : null,
      tags: [],
      descriptionLength: typeof product.description === "string" ? product.description.length : 0,
      imageCount: Array.isArray(product.image) ? product.image.length : product.image ? 1 : 0,
      bestsellerRank: null,
      rating: rating.rating,
      reviewCount: rating.reviewCount,
    };
  });
  return pages.filter((p): p is Candidate => p !== null);
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

/** Deterministic product score (0–100) and its confidence (share of weights that had data). */
export function scoreCandidates(candidates: Candidate[], program: ProgramResult | null): (Candidate & { score: number; confidence: number; components: ProductComponent[]; estMin: number | null; estMax: number | null })[] {
  const prices = candidates.map((c) => c.price).filter((p): p is number => p != null);
  const hasBestsellerData = candidates.some((c) => c.bestsellerRank != null);
  return candidates.map((c) => {
    const est = commissionRange(c.price, program);
    const commissionValue = c.price == null ? null : percentile(c.price, prices); // commission scales with price at a flat rate
    const reviews =
      c.rating != null ? Math.pow(Math.min(c.rating, 5) / 5, 2) * Math.min(1, Math.log10((c.reviewCount ?? 0) + 1) / 3) : null;
    const bestseller = hasBestsellerData ? (c.bestsellerRank == null ? 0 : c.bestsellerRank >= 999 ? 0.7 : Math.max(0.6, 1 - (c.bestsellerRank - 1) * 0.04)) : null;
    const discount = c.price != null ? (c.compareAtPrice ? 0.5 + Math.min(0.5, (c.compareAtPrice - c.price) / c.compareAtPrice) : 0.3) : null;
    const pageQuality = Math.min(1, (Math.min(c.imageCount, 4) / 4) * 0.6 + (Math.min(c.descriptionLength, 600) / 600) * 0.4);

    const components: ProductComponent[] = [
      { key: "commission", label: program?.commission.status === "verified" ? "Commission per sale" : "Price (commission unknown)", value: commissionValue, weight: 0.3 },
      { key: "reviews", label: "Rating & reviews", value: reviews, weight: 0.25 },
      { key: "bestseller", label: "Store's best-seller list", value: bestseller, weight: 0.2 },
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
  const parts = name.split(/\s[-–—|:]\s|\(/).map((p) => p.trim()).filter(Boolean);
  const meaningful = parts.filter((p) => {
    const c = p.toLowerCase().replace(/[^a-z0-9]/g, "");
    return c && !(store && (c === store || c === `the${store}` || store.includes(c))) && p.replace(VARIANT_WORDS, "").replace(/[^a-z0-9]/gi, "").length > 0;
  });
  const base = (meaningful[0] ?? parts[0] ?? name).replace(VARIANT_WORDS, " ");
  return base.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const OVERCLAIM =/\b(guaranteed?|sure[- ]?fire|winning product|can't lose|cannot lose)\b/gi;

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
  const origin = new URL(args.identity?.homepageUrl ?? `https://www.${args.domain}/`).origin;
  // Ask for one market's prices (default US/USD) so they don't follow the server's IP location.
  const market = marketHeaders(args.targetCountry);
  const currency = market.currency;

  let source: ProductsResult["source"] = "none";
  let candidates: Candidate[] = [];
  const shop = await shopifyCatalogue(origin, currency, market.headers);
  if (shop.ok) {
    source = "shopify";
    candidates = shop.candidates;
  } else {
    candidates = await sitemapCatalogue(origin, currency, market.headers);
    if (candidates.length) source = "sitemap";
  }

  const totalFound = candidates.length;
  const usable = candidates.filter((c) => c.available && c.price != null && c.price > 0 && !EXCLUDE_TITLE.test(c.name));
  if (usable.length === 0) {
    return {
      products: { source, totalFound, top: [], note: totalFound ? "Products were found but none are in stock with a price." : "No public product catalogue could be read from this store." },
      sources: [],
      usage,
    };
  }

  // Pre-rank everything cheaply, then fetch product pages (for ratings) only for the best candidates.
  // One entry per product family (its best-scoring variant).
  const families = new Set<string>();
  const preRanked = scoreCandidates(usable, args.program)
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const family = productFamily(c.name, args.name);
      if (families.has(family)) return false;
      families.add(family);
      return true;
    });
  const shortlist: Candidate[] = preRanked.slice(0, ENRICH_COUNT);
  if (source === "shopify") {
    await mapLimit(shortlist, 6, async (c) => {
      const res = await safeFetch(c.url, { timeoutMs: 9000, maxBytes: 2_500_000, headers: market.headers });
      if (!res.ok) return;
      const r = ratingFromHtml(res.text);
      c.rating = r.rating;
      c.reviewCount = r.reviewCount;
      // The page states the currency it actually priced in (a store may not sell in the requested market's currency).
      if (r.currency) c.currency = r.currency;
    });
  }
  const ranked = scoreCandidates(shortlist, args.program).sort((a, b) => b.score - a.score).slice(0, TOP_COUNT);

  const top: ProductItem[] = ranked.map((c) => ({
    id: c.id,
    name: c.name,
    url: c.url,
    image: c.image,
    price: c.price,
    compareAtPrice: c.compareAtPrice,
    currency: c.currency,
    available: c.available,
    rating: c.rating,
    reviewCount: c.reviewCount,
    bestsellerRank: c.bestsellerRank != null && c.bestsellerRank < 999 ? c.bestsellerRank : null,
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
        store: { name: args.name, domain: args.domain, currency: currency ?? "unknown" },
        affiliateCommission: args.program?.commission.status === "verified" ? args.program.commission.value : "unknown",
        googleAdsRules: rules,
        products: top.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.productType,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          rating: p.rating,
          reviewCount: p.reviewCount,
          bestsellerRank: p.bestsellerRank,
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

  const now = new Date().toISOString();
  const sources: SourceRef[] = [
    { url: source === "shopify" ? `${origin}/products.json` : `${origin}/sitemap.xml`, title: "Store product catalogue", kind: "store_site", fetchedAt: now },
  ];
  return { products: { source, totalFound, top, note }, sources, usage };
}
