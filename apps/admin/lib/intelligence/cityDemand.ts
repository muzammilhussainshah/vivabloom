import { googleAdsConfig, cityTargets, keywordMetrics, COUNTRY_GEO, MARKET_LANGUAGE, type KeywordMetric } from "./googleAds";
import { mapLimit } from "./safeFetch";
import type { CityDemandResult, CityDemandRow, ProductItem } from "./types";

/**
 * "Where do people search for this?": monthly Google searches per city for the
 * store's brand, its brand + coupon keywords (how the admin advertises) and its
 * top products, from the admin's own Google Ads Keyword Planner. This is
 * search DEMAND, not the store's sales — no public source has a store's sales
 * by city.
 */

const SIZE_RE = /\b\d+(?:[.,]\d+)?\s?(?:lbs?|kg|g|oz|ml|l|servings?|caps(?:ules)?|tablets?|count|ct|pack|pcs?)\b/gi;

/** "Impact Whey Protein Powder - Chocolate, 1kg" + "Myprotein" → "myprotein impact whey protein powder". */
export function productKeyword(name: string, brand: string): string | null {
  let k = name.split(/\s[-–—|]\s|[(,/]/)[0] ?? name;
  k = k.replace(SIZE_RE, " ").replace(/[™®©"“”]/g, "").replace(/[^\p{L}\p{N}&' ]+/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const words = k.split(" ").filter(Boolean).slice(0, 6);
  if (words.length === 0) return null;
  const b = brand.toLowerCase().trim();
  const withBrand = k.includes(b) ? words.join(" ") : `${b} ${words.slice(0, 5).join(" ")}`;
  return withBrand.length <= 80 ? withBrand : withBrand.slice(0, 80).replace(/\s\S*$/, "");
}

export function buildCityKeywords(brand: string, products: ProductItem[]): { keyword: string; kind: CityDemandRow["kind"]; product: string | null }[] {
  const b = brand.toLowerCase().replace(/[™®©]/g, "").trim();
  const rows: { keyword: string; kind: CityDemandRow["kind"]; product: string | null }[] = [
    { keyword: b, kind: "brand", product: null },
    { keyword: `${b} coupon`, kind: "coupon", product: null },
    { keyword: `${b} promo code`, kind: "coupon", product: null },
    { keyword: `${b} discount code`, kind: "coupon", product: null },
  ];
  for (const p of products.slice(0, 8)) {
    const k = productKeyword(p.name, b);
    if (k && !rows.some((r) => r.keyword === k)) rows.push({ keyword: k, kind: "product", product: p.name });
  }
  return rows;
}

export async function fetchCityDemand(opts: { brand: string; market: string; products: ProductItem[] }): Promise<CityDemandResult> {
  const c = googleAdsConfig();
  if (!c) throw new Error("Google Ads isn't connected yet.");
  const market = COUNTRY_GEO[opts.market] ? opts.market : "us";
  const language = MARKET_LANGUAGE[market] ?? null;
  const rows = buildCityKeywords(opts.brand, opts.products);
  const keywords = rows.map((r) => r.keyword);

  const cities = await cityTargets(c, market);
  const national = await keywordMetrics(c, keywords, COUNTRY_GEO[market]!, language);
  const perCity = new Map<string, Map<string, KeywordMetric>>();
  await mapLimit(cities, 3, async (city) => {
    perCity.set(city.id, await keywordMetrics(c, keywords, city.id, language).catch(() => new Map()));
  });

  return {
    source: "google_ads_keyword_planner",
    checkedAt: new Date().toISOString(),
    market,
    cities: cities.map((x) => ({ id: x.id, name: x.name })),
    rows: rows.map((r) => {
      const n = national.get(r.keyword);
      return {
        ...r,
        national: n?.searches ?? null,
        bidLow: n?.bidLow ?? null,
        bidHigh: n?.bidHigh ?? null,
        competition: n?.competition ?? null,
        byCity: Object.fromEntries(cities.map((city) => [city.id, perCity.get(city.id)?.get(r.keyword)?.searches ?? null])),
      };
    }),
  };
}
