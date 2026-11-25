/**
 * Minimal Google Ads API client (REST) for Keyword Planner data: monthly
 * Google searches for a keyword in a country or a single city, plus the
 * top-of-page bid range. Uses the admin's own Google Ads account, so no
 * third-party data broker is involved. Credentials come from env (see
 * .env.example → GOOGLE_ADS_*). Never throws a raw HTTP error at the UI —
 * errors are translated into a sentence the admin can act on.
 */

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v26";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

export interface AdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string | null;
}

const digits = (v: string | undefined) => (v ?? "").replace(/\D/g, "");

export function googleAdsConfig(): AdsConfig | null {
  const c = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    clientId: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
    customerId: digits(process.env.GOOGLE_ADS_CUSTOMER_ID),
    loginCustomerId: digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) || null,
  };
  return c.developerToken && c.clientId && c.clientSecret && c.refreshToken && c.customerId ? c : null;
}

/** Which GOOGLE_ADS_* settings are still missing (for the setup card). */
export function missingGoogleAdsSettings(): string[] {
  const need = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"];
  return need.filter((k) => !process.env[k]);
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(c: AdsConfig): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
  if (!res.ok || !json?.access_token) {
    throw new Error(`Google sign-in failed (${json?.error_description ?? json?.error ?? res.status}). Check GOOGLE_ADS_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN.`);
  }
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3000) * 1000 };
  return token.value;
}

/** Turns a Google Ads API error body into one actionable sentence. */
export function explainAdsError(status: number, body: unknown): string {
  const text = JSON.stringify(body ?? "");
  if (/DEVELOPER_TOKEN_NOT_APPROVED|only approved for use with test accounts/i.test(text)) {
    return "Your developer token only has test access. Apply for Basic access in Google Ads → Tools → API Center, then try again.";
  }
  if (/DEVELOPER_TOKEN_PROHIBITED|DEVELOPER_TOKEN_INVALID|developer token/i.test(text) && status === 401) return "Google rejected the developer token. Copy it again from Google Ads → Tools → API Center.";
  if (/USER_PERMISSION_DENIED|CUSTOMER_NOT_FOUND|login-customer-id/i.test(text)) {
    return "This Google account can't use that Ads account. Check GOOGLE_ADS_CUSTOMER_ID, and set GOOGLE_ADS_LOGIN_CUSTOMER_ID to your manager (MCC) id if you use one.";
  }
  if (/RESOURCE_EXHAUSTED|RATE_EXCEEDED|quota/i.test(text) || status === 429) return "Google Ads API daily limit reached. Try again tomorrow.";
  if (status === 404) return `Google Ads API version ${API_VERSION} isn't available. Set GOOGLE_ADS_API_VERSION to the current version (see the API release notes).`;
  const msg = (body as { error?: { message?: string } } | null)?.error?.message;
  return `Google Ads API error (${status})${msg ? `: ${msg.slice(0, 200)}` : ""}`;
}

async function adsPost<T>(c: AdsConfig, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken(c)}`,
      "developer-token": c.developerToken,
      ...(c.loginCustomerId ? { "login-customer-id": c.loginCustomerId } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(explainAdsError(res.status, json));
  return json as T;
}

export interface GeoTarget {
  id: string;
  name: string;
  resourceName: string;
}

/** Country criterion ids (Google uses 2000 + ISO numeric). */
export const COUNTRY_GEO: Record<string, string> = {
  us: "2840", gb: "2826", ca: "2124", au: "2036", de: "2276", fr: "2250", ae: "2784", sa: "2682", it: "2380", es: "2724", nl: "2528", ie: "2372", nz: "2554",
};

/** Language criterion ids for each market (omitted = all languages, used for the Gulf where shoppers search in English and Arabic). */
export const MARKET_LANGUAGE: Record<string, string | null> = {
  us: "1000", gb: "1000", ca: "1000", au: "1000", ie: "1000", nz: "1000", de: "1001", fr: "1002", es: "1003", it: "1004", nl: "1010", ae: null, sa: null,
};

/** The biggest cities per market — the ones worth targeting first. */
export const MARKET_CITIES: Record<string, string[]> = {
  us: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "Miami", "Atlanta", "Seattle"],
  gb: ["London", "Birmingham", "Manchester", "Leeds", "Glasgow", "Liverpool", "Bristol", "Edinburgh", "Sheffield", "Newcastle upon Tyne"],
  ca: ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City"],
  au: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra"],
  de: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Dusseldorf"],
  fr: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Bordeaux", "Lille"],
  ae: ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman"],
  sa: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam"],
  it: ["Rome", "Milan", "Naples", "Turin", "Palermo", "Bologna", "Florence"],
  es: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Malaga", "Bilbao"],
  nl: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
  ie: ["Dublin", "Cork", "Limerick", "Galway", "Waterford"],
  nz: ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Dunedin"],
};

const cityCache = new Map<string, GeoTarget[]>();

/** Resolves the market's city names to Google Ads city targets (cached per server instance). */
export async function cityTargets(c: AdsConfig, market: string): Promise<GeoTarget[]> {
  const cached = cityCache.get(market);
  if (cached) return cached;
  const names = MARKET_CITIES[market] ?? [];
  if (!names.length) return [];
  const json = await adsPost<{
    geoTargetConstantSuggestions?: { searchTerm?: string; geoTargetConstant?: { resourceName: string; id: string; name: string; countryCode: string; targetType: string; status?: string } }[];
  }>(c, "geoTargetConstants:suggest", { locale: "en", countryCode: market.toUpperCase(), locationNames: { names } });
  const out: GeoTarget[] = [];
  for (const name of names) {
    const hit = (json.geoTargetConstantSuggestions ?? []).find(
      (s) => s.searchTerm === name && s.geoTargetConstant?.targetType === "City" && s.geoTargetConstant.countryCode === market.toUpperCase() && s.geoTargetConstant.status !== "REMOVAL_PLANNED"
    )?.geoTargetConstant;
    if (hit && !out.some((o) => o.id === String(hit.id))) out.push({ id: String(hit.id), name: hit.name, resourceName: hit.resourceName });
  }
  cityCache.set(market, out);
  return out;
}

export interface KeywordMetric {
  /** 12-month average of monthly Google searches; null when Google has too little data. */
  searches: number | null;
  /** Top-of-page bid range in the Ads account's currency (whole units, not micros). */
  bidLow: number | null;
  bidHigh: number | null;
  competition: string | null;
}

/** Historical metrics for up to ~100 keywords in ONE location. Keys are the lower-cased keywords sent. */
export async function keywordMetrics(c: AdsConfig, keywords: string[], geoId: string, languageId: string | null): Promise<Map<string, KeywordMetric>> {
  const json = await adsPost<{
    results?: { text: string; closeVariants?: string[]; keywordMetrics?: { avgMonthlySearches?: string; competition?: string; lowTopOfPageBidMicros?: string; highTopOfPageBidMicros?: string } }[];
  }>(c, `customers/${c.customerId}:generateKeywordHistoricalMetrics`, {
    keywords,
    geoTargetConstants: [`geoTargetConstants/${geoId}`],
    ...(languageId ? { language: `languageConstants/${languageId}` } : {}),
    keywordPlanNetwork: "GOOGLE_SEARCH",
  });
  const micros = (v?: string) => (v != null && v !== "" ? Math.round(Number(v) / 10_000) / 100 : null);
  const map = new Map<string, KeywordMetric>();
  for (const r of json.results ?? []) {
    const m = r.keywordMetrics;
    const metric: KeywordMetric = {
      searches: m?.avgMonthlySearches != null ? Number(m.avgMonthlySearches) : null,
      bidLow: micros(m?.lowTopOfPageBidMicros),
      bidHigh: micros(m?.highTopOfPageBidMicros),
      competition: m?.competition ?? null,
    };
    // Google may merge close variants into one result — map every variant back to it.
    for (const k of [r.text, ...(r.closeVariants ?? [])]) map.set(k.toLowerCase(), metric);
  }
  return map;
}
