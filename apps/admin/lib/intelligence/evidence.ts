import type { EvidenceField } from "./types";

/**
 * The anti-hallucination layer: an AI claim only counts as "verified" when
 * the verbatim quote it cites is actually present in the source text we
 * gave it. Normalisation is deliberately forgiving about formatting
 * (case, whitespace, curly quotes, markdown symbols) but not about words.
 */

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    // Markdown/link punctuation differs between how a page is extracted and how the AI quotes it.
    .replace(/[*_#>`|\\[\]()"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_QUOTE_CHARS = 12;

/**
 * True when `quote` appears in `text`. A quote may use "…"/"..." to skip
 * words; then every fragment (≥ 4 chars) must appear, in order.
 */
export function quoteInText(quote: string | null | undefined, text: string): boolean {
  if (!quote) return false;
  const q = normalizeForMatch(quote).replace(/^["']|["']$/g, "");
  if (q.length < MIN_QUOTE_CHARS) return false;
  const haystack = normalizeForMatch(text);
  const parts = q
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);
  if (parts.length === 0) return false;
  let from = 0;
  for (const part of parts) {
    const at = haystack.indexOf(part, from);
    if (at === -1) return false;
    from = at + part.length;
  }
  return true;
}

export interface SourceText {
  url: string;
  text: string;
}

/**
 * Finds which source a quote came from: the one the AI cited first, then any
 * other. Returns the matching source or null.
 */
export function locateQuote(quote: string | null | undefined, sources: SourceText[], citedIndex: number | null | undefined): SourceText | null {
  if (!quote) return null;
  const cited = citedIndex != null ? sources[citedIndex] : undefined;
  if (cited && quoteInText(quote, cited.text)) return cited;
  return sources.find((s) => quoteInText(quote, s.text)) ?? null;
}

/** Turns one AI-extracted value + quote into an EvidenceField with an honest status. */
export function toEvidenceField<T>(
  value: T | null | undefined,
  quote: string | null | undefined,
  citedIndex: number | null | undefined,
  sources: SourceText[]
): EvidenceField<T> {
  const empty = value == null || (typeof value === "string" && !value.trim());
  if (empty) return { value: null, status: "unknown", quote: null, sourceUrl: null };
  const found = locateQuote(quote, sources, citedIndex);
  if (found) return { value: value as T, status: "verified", quote: quote ?? null, sourceUrl: found.url };
  return { value: value as T, status: "unverified", quote: quote ?? null, sourceUrl: citedIndex != null ? (sources[citedIndex]?.url ?? null) : null };
}

/**
 * Cuts a long page down to the parts that matter for `keywords`, keeping each
 * matching line plus one line of context either side, so the AI gets the
 * relevant terms paragraphs instead of the whole site chrome.
 */
export function windowText(text: string, keywords: RegExp, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const keep = new Set<number>();
  lines.forEach((line, i) => {
    if (keywords.test(line)) {
      keep.add(i - 1);
      keep.add(i);
      keep.add(i + 1);
    }
  });
  let out = "";
  let last = -2;
  for (const i of [...keep].filter((i) => i >= 0 && i < lines.length).sort((a, b) => a - b)) {
    const piece = (i === last + 1 ? "\n" : "\n…\n") + lines[i];
    if (out.length + piece.length > maxChars) break;
    out += piece;
    last = i;
  }
  return out.trim() || text.slice(0, maxChars);
}

/**
 * Line priorities for affiliate terms. Tier 1 is what decides the report:
 * advertising rules and the money terms. Tier 2 words also appear all over
 * normal store pages ("UP TO 60% OFF", "promo"), so they rank lower or a
 * sale banner could crowd the real terms out.
 */
const TIER1_LINES =
  /ppc|pay[- ]per[- ]click|paid (search|ads?|advertis|traffic)|search (ads?|engine marketing)|\bsem\b|adwords|google ads|bing ads|\bbid(s|ding)?\b|keyword|trademark|\btm\+?\b|brand(ed)? (name|term|keyword|search)|coupon (site|website|code)s?|voucher (site|website)s?|cash-?back|deal (site|website)s?|price comparison|direct[- ]link|prohibit|not (allowed|permitted)|may not|must not|will not|forbidden|commission|cookie|payout|paid (monthly|weekly|out)|threshold|minimum (payout|balance|payment)|over \$\d+|net[ -]?\d+|paypal|bank transfer|lock(ing)? period|validation period|reversal|chargeback/i;
const TIER2_LINES = /coupon|voucher|promo|discount code|google|bing|landing page|payment|per sale|approv|validat|terminat|revers|refund|return|\d+\s*%/i;

/**
 * Like windowText, but for affiliate terms: ranks lines (advertising rules,
 * then money terms, then anything mentioning the program), takes the
 * highest-ranked lines with one line of context, and returns them in page
 * order. A long terms page can't crowd its PPC/coupon rules out of the budget.
 */
export function focusTermsText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const scored = lines
    .map((line, i) => ({
      i,
      // Short all-caps banners ("BLACK FRIDAY SALE UP TO 60% OFF") are site chrome, not terms.
      score: /^[^a-z]{0,80}$/.test(line) && line.length < 80 ? 0.2 : TIER1_LINES.test(line) ? 3 : TIER2_LINES.test(line) ? 1.5 : /affiliat|ambassador|partner|program/i.test(line) ? 0.5 : 0,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);

  const keep = new Set<number>();
  let used = 0;
  for (const { i } of scored) {
    for (const j of [i, i - 1, i + 1]) {
      if (j < 0 || j >= lines.length || keep.has(j)) continue;
      const cost = (lines[j] as string).length + 3;
      if (used + cost > maxChars) continue;
      keep.add(j);
      used += cost;
    }
    if (used >= maxChars - 40) break;
  }
  let out = "";
  let last = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    out += (i === last + 1 ? "\n" : "\n…\n") + lines[i];
    last = i;
  }
  return out.trim() || text.slice(0, maxChars);
}

export const TERMS_KEYWORDS =
  /affiliat|commission|cookie|payout|pay(ment|s)? |paid|threshold|net[ -]?\d|ppc|pay[- ]per[- ]click|paid search|search engine|sem\b|adwords|google ads|bing ads|bid|trademark|brand(ed)? (name|term|keyword)|keyword|coupon|voucher|promo|discount code|deal site|direct link|landing page|approval|approve|terminat|revers|refund|return|lock|valid|partner|ambassador|creator|influencer|join|apply|sign ?up|%/i;
