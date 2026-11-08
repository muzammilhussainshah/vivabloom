import { stripMatchType, wordCount } from "./classify";
import type { Lexicon } from "./types";

/**
 * Categories that indicate a word carries real discount-intent, in whichever
 * language. A single-word negative is only safe to broad-match when it never
 * appears in any of these — otherwise it would shadow a legitimate positive
 * (broad-matching "subscription" would also block "{brand} subscription
 * discount code", since a query's negative match wins over its positive one).
 */
const POSITIVE_SIGNAL_FIELDS = [
  "intentTerms",
  "offerModifiers",
  "qualifierModifiers",
  "urgencyModifiers",
  "amountModifiers",
  "seasonalModifiers",
] as const;

function positiveSignalWords(lexicon: Lexicon): Set<string> {
  const words = new Set<string>();
  for (const field of POSITIVE_SIGNAL_FIELDS) {
    for (const phrase of lexicon[field] ?? []) words.add(phrase.trim().toLowerCase());
  }
  return words;
}

/**
 * Broad-match twins of the generic single-word negatives already in a
 * template/pack's list (e.g. "price", "buy", "cheap" — off-topic research
 * words, not store vocabulary). An exact-match `[price]` only blocks the
 * literal query "price"; it does nothing for "im8 supplement price" or "cost
 * of im8". Broad match blocks any query containing the word, which is what
 * those research queries actually need.
 *
 * Deliberately restricted to single bare words already present in the
 * caller's own negative list, cross-checked against that language's own
 * lexicon: multi-word phrases are left exact (broad-matching a phrase blocks
 * any query containing all its words in any order, which is a much bigger
 * over-blocking risk), and any word — even a single one — that also appears as
 * real intent/offer/qualifier/urgency/amount/seasonal vocabulary is skipped, so
 * this can never widen into blocking a legitimate positive.
 */
export function broadenSingleWordNegatives(negativeKeywords: string[], lexicon: Lexicon): string[] {
  const positive = positiveSignalWords(lexicon);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of negativeKeywords) {
    const bare = stripMatchType(raw).trim();
    if (!bare || wordCount(bare) !== 1) continue;
    const lower = bare.toLowerCase();
    if (positive.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    out.push(bare);
  }

  return out;
}
