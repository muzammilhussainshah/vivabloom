import type { TrafficResult } from "./types";

/**
 * Cheap, deterministic signals for a store found by "Find stores", computed
 * from text we already fetched (no AI, no credits). They are an EARLY filter to
 * decide which stores deserve a full check — never a replacement for it.
 */

export interface EarlyWarning {
  /** "ban": the store's own affiliate page restricts coupon sites / paid search / brand terms. "friendly": it welcomes coupon/deal sites. "mention": it talks about them (could be either way, or only limits how commissions are paid). */
  level: "ban" | "friendly" | "mention";
  text: string;
  url: string;
}

const TOPIC_RE = /\b(coupon sites?|coupon partners?|voucher sites?|deal sites?|discount sites?|cash ?back|loyalty sites?|coupons?|vouchers?|ppc|paid search|paid media|paid advertising|google ads|adwords|search engine marketing|brand bidding|bidding on|trademark(?:ed)? (?:terms?|keywords?|bidding)|brand (?:name|terms?|keywords?))\b/i;
const NEGATIVE_RE = /\b(not (?:be )?(?:allowed|permitted|eligible|accepted|approved|used)|no\b|prohibit\w*|forbidden|may not|must not|cannot|can't|do not|don't|never|won['’]t be (?:allowed|permitted)|will not be (?:allowed|permitted)|not allowed|banned?|disallow\w*|restricted|exclud\w+|unauthori[sz]ed|violation)\b/i;

/** Sentences about WHEN commissions are paid, or about stacking codes, are rules about orders — not a ban on promoting. */
const ORDER_RULE_RE = /commissions?\b[^.]{0,60}\b(?:not|never)\b[^.]{0,30}\b(?:paid|earned|awarded|payable)|no commissions?|stack|same post|combined with|reorders?/i;
const WELCOME_RE = /\b(?:welcome|we work with|work with all types|types of partners|partners? (?:including|such as)|including:?|accept\w*|encourage\w*|love|open to|ideal for|perfect for|join us)\b/i;
const COUPON_TOPIC_RE = /(?:(?:coupon|voucher|deal|discount|loyalty|cash ?back) (?:sites?|websites?|partners?|publishers?)|cash ?back)/i;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\s[•·|]\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 400);
}

/** Looks for sentences about coupon sites / paid search / brand keywords on a store's own affiliate page. */
export function scanAdRules(text: string, url: string): EarlyWarning | null {
  let mention: EarlyWarning | null = null;
  let friendly: EarlyWarning | null = null;
  for (const s of sentences(text)) {
    if (!TOPIC_RE.test(s)) continue;
    const text = s.slice(0, 220);
    if (ORDER_RULE_RE.test(s)) {
      mention ??= { level: "mention", text, url };
      continue;
    }
    if (NEGATIVE_RE.test(s)) return { level: "ban", text, url };
    if (WELCOME_RE.test(s) && COUPON_TOPIC_RE.test(s)) friendly ??= { level: "friendly", text, url };
    else mention ??= { level: "mention", text, url };
  }
  return friendly ?? mention;
}

/** "10% commission", "up to 8% per sale", "5–12%" → numbers (percent), or null when no percentage is stated. */
export function parseCommission(text: string | null | undefined): { min: number; max: number } | null {
  if (!text) return null;
  const range = text.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*%/i);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
    return { min: a, max: b };
  }
  const single = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return null;
}

export interface LeadInput {
  hasSiteEvidence: boolean;
  commissionMax: number | null;
  network: string | null;
  tier: TrafficResult["tier"] | null;
  warning: EarlyWarning | null;
  checkVerdict: "good" | "caution" | "risky" | "insufficient" | null;
  lostMoneyBefore: boolean;
}

export type LeadBand = "strong" | "promising" | "weak" | "avoid";

/**
 * Opportunity score 0–100 for ranking found stores before spending credits:
 * a real program on the store's site, a good commission, a known network and
 * real popularity push it up; terms that ban your ads, a risky check result or
 * money you lost there push it down hard.
 */
export function leadScore(i: LeadInput): { score: number; band: LeadBand } {
  let s = 45;
  if (i.hasSiteEvidence) s += 10;
  if (i.commissionMax != null) s += i.commissionMax >= 15 ? 14 : i.commissionMax >= 8 ? 10 : i.commissionMax >= 4 ? 5 : 0;
  if (i.network) s += 4;
  s += i.tier === "very_high" ? 14 : i.tier === "high" ? 10 : i.tier === "medium" ? 4 : i.tier === "low" ? 0 : 0;
  if (i.warning?.level === "ban") s -= 45;
  if (i.warning?.level === "friendly") s += 10;
  if (i.checkVerdict === "good") s += 15;
  if (i.checkVerdict === "risky") s -= 40;
  if (i.lostMoneyBefore) s -= 40;
  const score = Math.max(0, Math.min(100, s));
  const avoid = i.warning?.level === "ban" || i.checkVerdict === "risky" || i.lostMoneyBefore;
  return { score, band: avoid ? "avoid" : score >= 70 ? "strong" : score >= 52 ? "promising" : "weak" };
}
