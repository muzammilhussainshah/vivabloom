import { marketHeaders, safeFetch } from "./safeFetch";
import { fetchTraffic } from "./traffic";
import { tavilyExtract } from "./tavily";
import {
  detectCurrency,
  detectShopify,
  getJsonLd,
  getLinks,
  getMailtoAndTel,
  getMeta,
  getTitle,
  htmlToText,
  ldType,
  type PageLink,
} from "./html";
import { domainOfUrl, nameFromDomain, networkForUrl } from "./domain";
import type { IdentityResult, SourceRef, StepUsage } from "./types";

/**
 * Step 1 — who is this store? Homepage signals (name, logo, policy pages,
 * contact details, socials, links to affiliate networks), domain
 * registration date from RDAP, and first archive date from the Wayback
 * Machine. Costs no web-search credits unless the site refuses our fetcher.
 */

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

const PAGE_PATTERNS: { key: keyof Omit<IdentityResult["pages"], "affiliate">; re: RegExp }[] = [
  { key: "privacy", re: /privacy/i },
  { key: "refund", re: /refund|return/i },
  { key: "shipping", re: /shipping|delivery/i },
  { key: "terms", re: /terms|conditions|\btos\b/i },
  { key: "contact", re: /contact/i },
  { key: "about", re: /about|our-story|our story/i },
];
const AFFILIATE_RE = /affiliat|ambassador|partner(s|ship)?(-program)?\b|creator|influencer|collab/i;
const NOT_AFFILIATE_RE = /refer-?a-?friend|referral|wholesale|retailer|stockist|career|jobs|press/i;
const SOCIALS: { platform: string; re: RegExp }[] = [
  { platform: "Instagram", re: /instagram\.com\/(?!p\/|reel)/i },
  { platform: "Facebook", re: /facebook\.com\/(?!sharer)/i },
  { platform: "TikTok", re: /tiktok\.com\/@/i },
  { platform: "YouTube", re: /youtube\.com\/(@|c\/|channel|user)/i },
  { platform: "X", re: /(twitter|x)\.com\/(?!intent|share)/i },
  { platform: "LinkedIn", re: /linkedin\.com\/company/i },
  { platform: "Pinterest", re: /pinterest\.[a-z.]+\/(?!pin\/)/i },
];

function classifyLinks(links: PageLink[], domain: string): Pick<IdentityResult, "pages" | "socials" | "affiliateLinks"> {
  const pages: IdentityResult["pages"] = { privacy: null, terms: null, refund: null, shipping: null, contact: null, about: null, affiliate: [] };
  const socials: IdentityResult["socials"] = [];
  const affiliateLinks: IdentityResult["affiliateLinks"] = [];

  for (const link of links) {
    const onSite = domainOfUrl(link.href) === domain;
    const haystack = `${link.href} ${link.text}`;
    if (onSite) {
      for (const { key, re } of PAGE_PATTERNS) {
        if (!pages[key] && re.test(haystack)) {
          pages[key] = link.href;
          break;
        }
      }
      if (AFFILIATE_RE.test(haystack) && !NOT_AFFILIATE_RE.test(haystack) && pages.affiliate.length < 4 && !pages.affiliate.includes(link.href)) {
        pages.affiliate.push(link.href);
      }
      continue;
    }
    const network = networkForUrl(link.href);
    if (network && affiliateLinks.length < 4) {
      affiliateLinks.push({ url: link.href, network });
      continue;
    }
    const social = SOCIALS.find((s) => s.re.test(link.href));
    if (social && !socials.some((s) => s.platform === social.platform)) socials.push({ platform: social.platform, url: link.href });
  }
  return { pages, socials, affiliateLinks };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function addressText(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object") {
    const a = v as Record<string, unknown>;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
      .map((p) => (typeof p === "object" && p ? str((p as Record<string, unknown>).name) : str(p)))
      .filter(Boolean);
    return parts.length >= 2 ? parts.join(", ") : null;
  }
  return null;
}

function logoFrom(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") return str((v as Record<string, unknown>).url);
  return null;
}

/** A street-address-looking line from page text (US ZIP / UK postcode / EU postcode next to a street word). */
function findAddressInText(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 10 && l.length < 200);
  // Case-sensitive on purpose: "123 Main Street", "London EC3V 0HR", "Austin, TX 78701" — not ordinary sentences.
  const street = /\b\d{1,5}\s+(?:[A-Z][\w'.-]*\s){1,4}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Way|Place|Pl\.?|Court|Ct\.?|Parkway|Pkwy|Highway|Hwy|Straße|Strasse)\b/;
  const ukPostcode = /\b[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}\b/;
  const usZip = /,\s?[A-Z]{2}\s\d{5}(?:-\d{4})?\b/;
  return lines.find((l) => l.length < 140 && (street.test(l) || ukPostcode.test(l) || usZip.test(l))) ?? null;
}

async function rdap(domain: string): Promise<{ createdAt: string | null; registrar: string | null }> {
  const res = await safeFetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    checkRobots: false,
    timeoutMs: 9000,
    maxBytes: 400_000,
    accept: "application/rdap+json, application/json",
  });
  if (!res.ok) return { createdAt: null, registrar: null };
  try {
    const data = JSON.parse(res.text) as { events?: { eventAction?: string; eventDate?: string }[]; entities?: { roles?: string[]; vcardArray?: unknown[] }[] };
    const createdAt = data.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;
    const registrarEntity = data.entities?.find((e) => e.roles?.includes("registrar"));
    const vcard = Array.isArray(registrarEntity?.vcardArray?.[1]) ? (registrarEntity?.vcardArray?.[1] as unknown[][]) : [];
    const fn = vcard.find((row) => Array.isArray(row) && row[0] === "fn");
    return { createdAt, registrar: fn && typeof fn[3] === "string" ? fn[3] : null };
  } catch {
    return { createdAt: null, registrar: null };
  }
}

async function waybackFirstSeen(domain: string): Promise<string | null> {
  const res = await safeFetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&limit=1&fl=timestamp`, {
    checkRobots: false,
    timeoutMs: 12_000,
    maxBytes: 50_000,
    accept: "application/json",
  });
  if (!res.ok) return null;
  try {
    const rows = JSON.parse(res.text) as string[][];
    const ts = rows[1]?.[0];
    if (!ts || ts.length < 8) return null;
    return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T00:00:00.000Z`;
  } catch {
    return null;
  }
}

function yearsSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round(((Date.now() - t) / YEAR_MS) * 10) / 10) : null;
}

export async function runIdentityStep(args: { domain: string; startUrl: string | null; fallbackName: string | null; targetCountry?: string | null }): Promise<{
  identity: IdentityResult;
  sources: SourceRef[];
  usage: StepUsage;
}> {
  const { domain } = args;
  const now = new Date().toISOString();
  const candidates = [args.startUrl, `https://www.${domain}/`, `https://${domain}/`].filter((u): u is string => Boolean(u));

  const [registration, firstSeen, traffic, page] = await Promise.all([
    rdap(domain),
    waybackFirstSeen(domain),
    fetchTraffic(domain).catch(() => null),
    (async () => {
      for (const url of [...new Set(candidates)]) {
        const res = await safeFetch(url, { timeoutMs: 12_000, maxBytes: 2_500_000, headers: marketHeaders(args.targetCountry).headers });
        if (res.ok && res.text && domainOfUrl(res.url) === domain) return res;
        if (res.blockedByRobots) return res;
      }
      return null;
    })(),
  ]);

  let usage: StepUsage = { tavilyCredits: 0, llmInputTokens: 0, llmOutputTokens: 0 };
  const html = page?.ok ? page.text : "";
  let fetchedVia: IdentityResult["fetchedVia"] = html ? "direct" : "none";
  let homepageUrl = page?.ok ? page.url : (candidates[0] ?? `https://${domain}/`);
  let fallbackText = "";

  // Our fetcher was refused (bot protection or robots.txt): fall back to a web extract of the homepage.
  if (!html) {
    try {
      const extract = await tavilyExtract([homepageUrl]);
      usage = { ...usage, tavilyCredits: extract.credits };
      fallbackText = extract.results[0]?.text ?? "";
      if (fallbackText) {
        fetchedVia = "extract";
        homepageUrl = extract.results[0]?.url ?? homepageUrl;
      }
    } catch {
      // stays "none"
    }
  }

  const ld = html ? getJsonLd(html) : [];
  const org = ld.find((o) => ldType(o).some((t) => t === "organization" || t === "onlinestore" || t === "store" || t.endsWith("business")));
  const site = ld.find((o) => ldType(o).includes("website"));
  const links = html ? getLinks(html, homepageUrl) : [];
  const classified = classifyLinks(links, domain);
  const { emails, phones } = html ? getMailtoAndTel(html) : { emails: [], phones: [] };
  let pageText = html ? htmlToText(html) : fallbackText;

  // Contact details usually live on the contact page, not the homepage.
  const contactUrl = classified.pages.contact;
  if (contactUrl && html && (emails.length === 0 || !org?.address)) {
    const contact = await safeFetch(contactUrl, { timeoutMs: 9000, maxBytes: 1_500_000 });
    if (contact.ok && contact.text) {
      const found = getMailtoAndTel(contact.text);
      for (const e of found.emails) if (!emails.includes(e)) emails.push(e);
      for (const p of found.phones) if (!phones.includes(p)) phones.push(p);
      pageText += `\n${htmlToText(contact.text)}`;
    }
  }

  // Emails written as plain text (not mailto) — only on the store's own domain, to skip third-party addresses.
  for (const m of pageText.matchAll(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    if (emails.length >= 5) break;
    const email = m[0].toLowerCase();
    if (m[1] && domainOfUrl(`https://${m[1]}`) === domain && !emails.includes(email)) emails.push(email);
  }
  if (org) {
    const tel = str(org.telephone);
    if (tel && !phones.includes(tel)) phones.push(tel);
    const mail = str(org.email);
    if (mail && !emails.includes(mail.toLowerCase())) emails.push(mail.toLowerCase());
  }

  const name =
    str(getMeta(html, "og:site_name")) ??
    str(org?.name) ??
    str(site?.name) ??
    args.fallbackName ??
    (getTitle(html)?.split(/\s[|–—-]\s/)[0]?.trim() || null) ??
    nameFromDomain(domain);

  // The site's own app icon is the most reliable square logo; JSON-LD logos are sometimes wrong
  // (seen: another brand's test-platform asset), and og:image is usually a sale banner.
  const linkHref = (re: RegExp) => {
    for (const tag of html.match(new RegExp(`<link[^>]+rel=["'][^"']*${re.source}[^"']*["'][^>]*>`, "gi")) ?? []) {
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      if (href && !/\.svg(\?|$)/i.test(href)) return href;
    }
    return null;
  };
  const logoCandidate = linkHref(/apple-touch-icon/) ?? linkHref(/\bicon\b/) ?? logoFrom(org?.logo);
  let logo: string | null = null;
  if (logoCandidate) {
    try {
      logo = new URL(logoCandidate, homepageUrl).toString().replace(/^http:/, "https:");
    } catch {
      logo = null;
    }
  }

  const sources: SourceRef[] = [];
  if (fetchedVia !== "none") sources.push({ url: homepageUrl, title: `${name} — homepage`, kind: "store_site", fetchedAt: now });
  if (registration.createdAt) sources.push({ url: `https://rdap.org/domain/${domain}`, title: "Domain registration (RDAP)", kind: "registry", fetchedAt: now });
  if (firstSeen) sources.push({ url: `https://web.archive.org/web/*/${domain}`, title: "Wayback Machine archive", kind: "archive", fetchedAt: now });

  const identity: IdentityResult = {
    name: name.replace(/\s+/g, " ").slice(0, 120),
    title: getTitle(html),
    description: getMeta(html, "description") ?? getMeta(html, "og:description"),
    logo,
    homepageUrl,
    reachable: fetchedVia !== "none",
    fetchedVia,
    https: homepageUrl.startsWith("https://"),
    platform: html && detectShopify(html) ? "shopify" : null,
    currency: html ? detectCurrency(html) : null,
    domainCreatedAt: registration.createdAt,
    domainAgeYears: yearsSince(registration.createdAt),
    registrar: registration.registrar,
    traffic,
    waybackFirstSeen: firstSeen,
    onlineYears: yearsSince(firstSeen),
    legalName: str(org?.legalName),
    pages: classified.pages,
    contact: { emails: emails.slice(0, 5), phones: phones.slice(0, 5), address: addressText(org?.address) ?? findAddressInText(pageText) },
    socials: classified.socials,
    affiliateLinks: classified.affiliateLinks,
  };
  return { identity, sources, usage };
}

/**
 * Free probe of a store's homepage (no search credits): is the site there,
 * what does it call itself, and does it point to an affiliate program (an
 * on-site Affiliate / Partners / Ambassador page, or a network signup link)?
 */
export async function probeStoreSite(domain: string): Promise<{ ok: boolean; siteName: string | null; program: { url: string; label: string; network?: string } | null }> {
  for (const url of [`https://www.${domain}/`, `https://${domain}/`]) {
    const res = await safeFetch(url, { timeoutMs: 7000, maxBytes: 2_000_000 });
    if (!res.ok || !res.text || domainOfUrl(res.url) !== domain) continue;
    const siteName = [getMeta(res.text, "og:site_name"), getTitle(res.text)].filter(Boolean).join(" | ") || null;
    const found = classifyLinks(getLinks(res.text, res.url), domain);
    const program = found.affiliateLinks[0]
      ? { url: found.affiliateLinks[0].url, label: `${found.affiliateLinks[0].network} program linked on the site`, network: found.affiliateLinks[0].network }
      : found.pages.affiliate[0]
        ? { url: found.pages.affiliate[0], label: "Affiliate / partner page on the site" }
        : null;
    return { ok: true, siteName, program };
  }
  return { ok: false, siteName: null, program: null };
}
