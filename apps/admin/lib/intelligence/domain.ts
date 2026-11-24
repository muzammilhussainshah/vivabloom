import { getDomain } from "tldts";
import type { LinkSignals, NetworkSignal } from "./types";

/**
 * Pure helpers for turning whatever the admin pasted (an ad click URL full of
 * tracking parameters, a bare domain, or a brand name) into a store identity,
 * and for recognising affiliate networks from link parameters and domains.
 */

export type ParsedInput = { kind: "url"; url: URL; domain: string } | { kind: "name"; name: string };

/** "ekster.com/en-int?utm_source=…" → URL; "Kitty Spout" → a brand name. */
export function parseStoreInput(raw: string): ParsedInput {
  const text = raw.trim();
  const looksLikeUrl = !/\s/.test(text) && /\.[a-z]{2,}/i.test(text);
  if (looksLikeUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      const domain = registrableDomain(url.hostname);
      if (domain) return { kind: "url", url, domain };
    } catch {
      // fall through to treating it as a name
    }
  }
  return { kind: "name", name: text.replace(/\s+/g, " ") };
}

/** "shop.brand.co.uk" → "brand.co.uk" (public-suffix aware). Null for IPs/invalid hosts. */
export function registrableDomain(hostname: string): string | null {
  const domain = getDomain(hostname.toLowerCase().replace(/\.$/, ""));
  return domain || null;
}

export function domainOfUrl(url: string): string | null {
  try {
    return registrableDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** Query parameters that identify an affiliate network (or an ad click). Lowercased keys. */
const PARAM_NETWORKS: { param: RegExp; network: string }[] = [
  { param: /^(ranmid|raneaid|ransiteid)$/, network: "Rakuten Advertising" },
  { param: /^snowball$/, network: "Social Snowball" },
  { param: /^awc$/, network: "Awin" },
  { param: /^(irclickid|irgwc|im_ref)$/, network: "Impact" },
  { param: /^(cjevent|cjdata)$/, network: "CJ Affiliate" },
  { param: /^sscid$/, network: "ShareASale (now Awin)" },
  { param: /^sca_ref$/, network: "UpPromote" },
  { param: /^(rfsn)$/, network: "Refersion" },
  { param: /^(goaffpro|gaff)$/, network: "GoAffPro" },
  { param: /^(clickref|prf)$/, network: "Partnerize" },
  { param: /^(avad)$/, network: "AvantLink" },
  { param: /^(fobs|foid)$/, network: "FlexOffers" },
];

const TRACKING_PARAM =
  /^(utm_.+|gclid|gbraid|wbraid|gad_source|gad_campaignid|dclid|fbclid|msclkid|ttclid|twclid|li_fat_id|srsltid|_ga|mc_cid|mc_eid|tw_.+|ranmid|raneaid|ransiteid|snowball|awc|irclickid|irgwc|im_ref|cjevent|cjdata|sscid|sca_ref|rfsn|goaffpro|gaff|clickref|prf|avad|fobs|foid|ref|aff|affiliate|affid|aff_id|click_id|clickid|subid|sub_id|source|campaign)$/i;

/** Strips tracking/affiliate params and reads what they reveal about the link. */
export function analyzeLink(url: URL): LinkSignals {
  const networks: NetworkSignal[] = [];
  let fromGoogleAds = false;
  const clean = new URL(url.toString());
  for (const [key, value] of url.searchParams) {
    const k = key.toLowerCase();
    if (/^(gclid|gbraid|wbraid|gad_source|gad_campaignid)$/.test(k)) fromGoogleAds = true;
    const hit = PARAM_NETWORKS.find((p) => p.param.test(k));
    if (hit && !networks.some((n) => n.network === hit.network)) {
      networks.push({ network: hit.network, evidence: `Link parameter "${key}=${value.slice(0, 40)}"` });
    }
    if (TRACKING_PARAM.test(k)) clean.searchParams.delete(key);
  }
  const twSource = url.searchParams.get("tw_source") ?? url.searchParams.get("utm_source");
  if (twSource && /rakuten|linkshare/i.test(twSource) && !networks.some((n) => n.network === "Rakuten Advertising")) {
    networks.push({ network: "Rakuten Advertising", evidence: `Link parameter "source=${twSource}"` });
  }
  clean.hash = "";
  return { cleanUrl: clean.toString(), networks, fromGoogleAds };
}

/**
 * Domains that belong to affiliate networks / affiliate SaaS platforms —
 * a store linking to one of these from its site, or a search result on one
 * of them that names the store, tells us which network runs the program.
 */
const NETWORK_DOMAINS: { domain: string; network: string }[] = [
  { domain: "awin.com", network: "Awin" },
  { domain: "awin1.com", network: "Awin" },
  { domain: "shareasale.com", network: "ShareASale (now Awin)" },
  { domain: "rakutenadvertising.com", network: "Rakuten Advertising" },
  { domain: "linksynergy.com", network: "Rakuten Advertising" },
  { domain: "impact.com", network: "Impact" },
  { domain: "sjv.io", network: "Impact" },
  { domain: "pxf.io", network: "Impact" },
  { domain: "cj.com", network: "CJ Affiliate" },
  { domain: "anrdoezrs.net", network: "CJ Affiliate" },
  { domain: "dpbolvw.net", network: "CJ Affiliate" },
  { domain: "jdoqocy.com", network: "CJ Affiliate" },
  { domain: "kqzyfj.com", network: "CJ Affiliate" },
  { domain: "tkqlhce.com", network: "CJ Affiliate" },
  { domain: "socialsnowball.io", network: "Social Snowball" },
  { domain: "snowball.io", network: "Social Snowball" },
  { domain: "refersion.com", network: "Refersion" },
  { domain: "uppromote.com", network: "UpPromote" },
  { domain: "goaffpro.com", network: "GoAffPro" },
  { domain: "partnerize.com", network: "Partnerize" },
  { domain: "prf.hn", network: "Partnerize" },
  { domain: "flexoffers.com", network: "FlexOffers" },
  { domain: "avantlink.com", network: "AvantLink" },
  { domain: "tapfiliate.com", network: "Tapfiliate" },
  { domain: "leaddyno.com", network: "LeadDyno" },
  { domain: "getrewardful.com", network: "Rewardful" },
  { domain: "partnerstack.com", network: "PartnerStack" },
  { domain: "grin.co", network: "GRIN" },
  { domain: "aspire.io", network: "Aspire" },
  { domain: "levanta.io", network: "Levanta" },
  { domain: "webgains.com", network: "Webgains" },
  { domain: "tradedoubler.com", network: "Tradedoubler" },
];

export function networkForUrl(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "collabs.shopify.com") return "Shopify Collabs";
  const hit = NETWORK_DOMAINS.find((n) => host === n.domain || host.endsWith(`.${n.domain}`));
  return hit?.network ?? null;
}

/**
 * Sites a "find the official store" search must never pick: marketplaces,
 * social networks, review sites, publishers, and the networks themselves.
 */
const NOT_A_STORE = new Set([
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.com.au", "ebay.com", "walmart.com", "target.com", "etsy.com",
  "aliexpress.com", "temu.com", "bestbuy.com", "costco.com", "wikipedia.org", "reddit.com", "youtube.com", "facebook.com",
  "instagram.com", "tiktok.com", "x.com", "twitter.com", "linkedin.com", "pinterest.com", "trustpilot.com", "sitejabber.com",
  "bbb.org", "forbes.com", "nytimes.com", "theguardian.com", "bbc.co.uk", "cnn.com", "businessinsider.com", "buzzfeed.com",
  "medium.com", "quora.com", "crunchbase.com", "glassdoor.com", "indeed.com", "google.com", "apple.com", "shopify.com",
  "knoji.com", "retailmenot.com", "groupon.com", "honey.com", "joinhoney.com", "capitaloneshopping.com", "dealspotr.com",
  "wired.com", "cnet.com", "techradar.com", "tomsguide.com", "goodhousekeeping.com", "healthline.com",
  // search tools, affiliate directories and list publishers — never a brand's own store
  "tavily.com", "revshare.so", "skimlinks.com", "empireflippers.com", "businessofapps.com", "afluencer.com", "builtin.com",
  "mapquest.com", "yelp.com", "authorityhacker.com", "nichepursuits.com", "shopify.dev", "g2.com", "capterra.com", "similarweb.com",
]);

export function isLikelyStoreDomain(domain: string): boolean {
  if (NOT_A_STORE.has(domain)) return false;
  if (NETWORK_DOMAINS.some((n) => domain === n.domain)) return false;
  return true;
}

/** Lowercase, accents removed, everything but a–z/0–9 dropped: "Kitty Spout™" → "kittyspout". */
export function compact(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const NAME_NOISE = /\b(official( site| store| website)?|shop|store|online|inc|llc|ltd|limited|gmbh|co|company|the)\b/gi;

/**
 * The strings that prove a piece of text is about this store. Short domain
 * labels like "tabs" are too ambiguous on their own ("browser tabs"), so a
 * label under 6 letters only counts as the full domain ("tabs.co") or as the
 * full multi-word name ("tabs chocolate").
 */
export function brandMatchers(name: string, domain: string): { compactTokens: string[]; literals: string[] } {
  const cleanedName = name.replace(NAME_NOISE, " ").replace(/[™®©]/g, "").trim();
  const label = domain.split(".")[0] ?? "";
  const compactTokens = new Set<string>();
  const literals = new Set<string>(domain ? [domain.toLowerCase()] : []);
  const nameCompact = compact(cleanedName);
  if (nameCompact.length >= 6) compactTokens.add(nameCompact);
  else if (nameCompact.length >= 3) literals.add(cleanedName.toLowerCase());
  if (label.length >= 6) compactTokens.add(compact(label));
  return { compactTokens: [...compactTokens], literals: [...literals] };
}

export function mentionsBrand(text: string, matchers: ReturnType<typeof brandMatchers>): boolean {
  const lower = text.toLowerCase();
  // A domain must stand alone: "tabs.co" matches "visit tabs.co/shop" but not "note2tabs.com".
  const literalHit = (l: string) =>
    l.includes(".")
      ? new RegExp(`(^|[^a-z0-9.-])${escapeRegex(l)}(?![a-z0-9-]|\\.[a-z])`).test(lower)
      : new RegExp(`\\b${escapeRegex(l)}\\b`).test(lower);
  if (matchers.literals.some(literalHit)) return true;
  const squashed = compact(text);
  return matchers.compactTokens.some((t) => squashed.includes(t));
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "kittyspout.com" → "Kittyspout" — the last-resort display name. */
export function nameFromDomain(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * True when a domain plausibly IS this brand's website: its name (label)
 * matches the brand ("vitaminshoppe.com" for "The Vitamin Shoppe"). A page
 * merely mentioning the brand is not enough — that's how a search tool's own
 * site once got picked as a store.
 */
export function domainMatchesBrand(domain: string, name: string): boolean {
  const label = compact(domain.split(".")[0] ?? "");
  const nameKey = compact(name.replace(NAME_NOISE, " ").replace(/[™®©]/g, ""));
  if (label.length < 3 || nameKey.length < 3) return false;
  if (label === nameKey || label.includes(nameKey) || (nameKey.includes(label) && label.length >= Math.min(5, nameKey.length))) return true;
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5);
  return words.some((w) => label.includes(w));
}
