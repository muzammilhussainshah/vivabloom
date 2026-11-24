/**
 * Regex-level HTML readers for the Store Checker — enough for <head> meta,
 * JSON-LD, links and readable text, without a DOM dependency (same approach
 * as lib/urlFetch.ts).
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#039": "'" };

export function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#0?39);/g, (_, e: string) => ENTITIES[e] ?? "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

export function getTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m?.[1] ? decodeEntities(m[1].replace(/\s+/g, " ").trim()) : "";
  return t || null;
}

/** <meta name|property="key" content="…"> in either attribute order. */
export function getMeta(html: string, key: string): string | null {
  const k = key.replace(/[.:]/g, (c) => `\\${c}`);
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${k}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]?.trim()) return decodeEntities(m[1].trim());
  }
  return null;
}

/** Every JSON-LD object on the page, with @graph arrays flattened. Malformed blocks are skipped. */
export function getJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const parsed: unknown = JSON.parse((m[1] ?? "").trim());
      const push = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(push);
        else if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>;
          if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(push);
          out.push(obj);
        }
      };
      push(parsed);
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return out;
}

export function ldType(obj: Record<string, unknown>): string[] {
  const t = obj["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string").map((x) => x.toLowerCase());
}

export interface PageLink {
  href: string;
  text: string;
}

/** Absolute http(s) links with their visible text. */
export function getLinks(html: string, baseUrl: string): PageLink[] {
  const links: PageLink[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = decodeEntities(m[1] ?? "");
    if (/^(mailto|tel|javascript):/i.test(rawHref)) continue;
    let href: string;
    try {
      href = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    links.push({ href, text: decodeEntities((m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 120) });
  }
  return links;
}

export function getMailtoAndTel(html: string): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) if (m[1]) emails.add(decodeEntities(m[1]).trim().toLowerCase());
  for (const m of html.matchAll(/href=["']tel:([^"']+)/gi)) if (m[1]) phones.add(decodeEntities(m[1]).replace(/\s+/g, " ").trim());
  return { emails: [...emails].slice(0, 5), phones: [...phones].slice(0, 5) };
}

/** Readable text: scripts/styles dropped, block tags become line breaks. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function detectShopify(html: string): boolean {
  return /cdn\.shopify\.com|Shopify\.theme|myshopify\.com|shopify-section/i.test(html);
}

export function detectCurrency(html: string): string | null {
  const patterns = [
    /Shopify\.currency\s*=\s*\{\s*"active"\s*:\s*"([A-Z]{3})"/,
    /"priceCurrency"\s*:\s*"([A-Z]{3})"/,
    /<meta[^>]+(?:og:price:currency|product:price:currency)["'][^>]*content=["']([A-Z]{3})["']/i,
    /"currency"\s*:\s*"([A-Z]{3})"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return null;
}
