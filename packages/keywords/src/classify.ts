import { CATEGORY_TIER, type Classification, type KeywordFeatures, type KeywordMatch, type KeywordTier, type Lexicon, type LexiconCategory } from "./types";
import { EN_LEXICON } from "./locales/en";

/** Strips Google Ads match-type syntax: [exact] and "phrase". */
export function stripMatchType(keyword: string): string {
  return keyword.replace(/^\[|\]$/g, "").replace(/^"|"$/g, "").trim();
}

/** Google counts words the way a human would; it rejects keywords over 10. */
export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lowercases and reduces punctuation to spaces, keeping `$` and `.` so money
 * amounts ("$50") and sale-day names ("11.11") survive as single tokens.
 *
 * Accents are folded and non-ASCII letters preserved, which matters far more
 * than it looks: an `[a-z]` class turns "geprüfter" into "gepr" + "fter" and
 * "código" into "c" + "digo", so every non-English pack would read as unknown
 * vocabulary. Folding also means a searcher typing "codigo" matches the
 * lexicon's "código", since both sides run through here.
 */
/** The combining accents NFD splits off, as a range: U+0300–U+036F. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function normalize(text: string): string {
  return stripMatchType(text)
    .toLowerCase()
    .normalize("NFD")
    // Strip the combining marks NFD just split off ("ü" → "u" + ¨ → "u").
    // Letters that are not decomposable (ß, ł) are kept whole by \p{L} below.
    .replace(COMBINING_MARKS, "")
    .replace(/['’]/gu, "")
    .replace(/[^\p{L}\p{N}$.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .split(" ")
    // Keep the dot only where it separates digits ("11.11"); anywhere else it
    // is sentence punctuation that would break an otherwise known word.
    .map((token) => (/^\d+\.\d+$/.test(token) ? token : token.replace(/\./g, "")))
    .filter(Boolean);
}

interface PhraseEntry {
  category: LexiconCategory;
  rank: number;
}

interface PhraseIndex {
  phrases: Map<string, PhraseEntry>;
  maxWords: number;
  intentRank: Map<string, number>;
}

/**
 * Categories are indexed in this order and the first insert wins, so a phrase
 * listed twice keeps its most valuable reading. Longer phrases always beat
 * shorter ones at match time regardless of category, which is what resolves
 * "free shipping" against "free" and "new york" against "new".
 */
const INDEX_ORDER: { category: LexiconCategory; key: keyof Lexicon }[] = [
  { category: "intent", key: "intentTerms" },
  { category: "offer", key: "offerModifiers" },
  { category: "qualifier", key: "qualifierModifiers" },
  { category: "urgency", key: "urgencyModifiers" },
  { category: "seasonal", key: "seasonalModifiers" },
  { category: "amount", key: "amountModifiers" },
  { category: "vertical", key: "verticals" },
  { category: "geo", key: "geoModifiers" },
  { category: "filler", key: "fillerModifiers" },
  { category: "payment", key: "paymentModifiers" },
  { category: "informational", key: "informationalModifiers" },
  { category: "connector", key: "connectors" },
];

const indexCache = new WeakMap<Lexicon, PhraseIndex>();

function getIndex(lexicon: Lexicon): PhraseIndex {
  const cached = indexCache.get(lexicon);
  if (cached) return cached;

  const phrases = new Map<string, PhraseEntry>();
  const intentRank = new Map<string, number>();
  let maxWords = 1;

  const add = (phrase: string, category: LexiconCategory, rank: number) => {
    const normalized = normalize(phrase);
    if (!normalized || phrases.has(normalized)) return;
    phrases.set(normalized, { category, rank });
    maxWords = Math.max(maxWords, wordCount(normalized));
  };

  for (const { category, key } of INDEX_ORDER) {
    const list = lexicon[key];
    if (!Array.isArray(list)) continue;
    list.forEach((phrase, rank) => {
      add(phrase, category, rank);
      if (category === "intent") intentRank.set(normalize(phrase), rank);
    });
  }

  // Months carry no rank of their own — every month is equally dated.
  for (const spellings of Object.values(lexicon.months)) {
    for (const spelling of spellings) add(spelling, "month", 0);
  }

  const index: PhraseIndex = { phrases, maxWords, intentRank };
  indexCache.set(lexicon, index);
  return index;
}

const YEAR = /^(19|20)\d{2}$/;
const NUMBER = /^\$?\d+$/;

export interface ClassifyContext {
  /**
   * Brand phrases to remove before classifying, so the store's own name never
   * reads as vocabulary. Pass the bare brand word ("tabs") rather than every
   * brand token — leaving "co" in makes "[Store co coupon code]" classify as
   * the filler variant it becomes once the name is swapped.
   */
  brandTokens?: string[];
  /** The store descriptor ("pet care"), which promotes a keyword into tier 2. */
  descriptorTokens?: string[];
  lexicon?: Lexicon;
}

/** Removes a phrase wherever it appears as whole words. */
function removePhrase(text: string, phrase: string): { text: string; found: boolean } {
  const normalized = normalize(phrase);
  if (!normalized) return { text, found: false };
  const stripped = text
    .replace(new RegExp(`(^|\\s)${escapeRegExp(normalized)}(?=\\s|$)`, "g"), " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text: stripped, found: stripped !== text };
}

/**
 * Works out what a keyword actually is: which coupon term it uses, which
 * modifiers sit around it, and therefore which tier it belongs to.
 *
 * The tier is the *highest* number among the categories present — a keyword is
 * only as broad as its narrowest qualifier. `unknownTokens` is the honest
 * signal about lexicon coverage: anything listed there is vocabulary the
 * lexicon does not yet know, and it drags the keyword into the long tail.
 */
export function classifyKeyword(keyword: string, context: ClassifyContext = {}): Classification {
  const lexicon = context.lexicon ?? EN_LEXICON;
  const index = getIndex(lexicon);

  const bare = stripMatchType(keyword);
  const words = wordCount(bare);

  let residual = normalize(bare);
  // Longest brand phrase first, so "tabs co" is consumed before "tabs" can
  // strand a bare "co".
  for (const token of [...(context.brandTokens ?? [])].sort((a, b) => b.length - a.length)) {
    residual = removePhrase(residual, token).text;
  }

  let hasDescriptor = false;
  for (const token of [...(context.descriptorTokens ?? [])].sort((a, b) => b.length - a.length)) {
    const result = removePhrase(residual, token);
    residual = result.text;
    hasDescriptor ||= result.found;
  }

  const tokens = tokenize(residual);
  const matches: KeywordMatch[] = [];
  const unknownTokens: string[] = [];

  for (let i = 0; i < tokens.length; ) {
    const window = Math.min(index.maxWords, tokens.length - i);
    let matched = false;

    for (let size = window; size >= 1; size -= 1) {
      const phrase = tokens.slice(i, i + size).join(" ");
      const entry = index.phrases.get(phrase);
      if (!entry) continue;
      matches.push({ phrase, category: entry.category, rank: entry.rank });
      i += size;
      matched = true;
      break;
    }
    if (matched) continue;

    const token = tokens[i];
    if (YEAR.test(token)) matches.push({ phrase: token, category: "year", rank: 0 });
    else if (NUMBER.test(token)) matches.push({ phrase: token, category: "amount", rank: 0 });
    else unknownTokens.push(token);
    i += 1;
  }

  const categories: LexiconCategory[] = [];
  for (const match of matches) if (!categories.includes(match.category)) categories.push(match.category);
  if (hasDescriptor) categories.unshift("descriptor");
  if (unknownTokens.length > 0) categories.push("unknown");

  const intentMatch = matches
    .filter((m) => m.category === "intent")
    .sort((a, b) => a.rank - b.rank)[0];

  // Connectors are grammar, not a search dimension, so they never set the tier.
  const tier = categories.reduce<KeywordTier>(
    (highest, category) => (CATEGORY_TIER[category] > highest ? CATEGORY_TIER[category] : highest),
    1
  );

  const modifierRanks = matches
    .filter((m) => m.category !== "intent" && m.category !== "connector")
    .map((m) => m.rank);
  const modifierRank = modifierRanks.length > 0 ? Math.min(...modifierRanks) : 0;
  const intentRank = intentMatch ? intentMatch.rank : 99;
  const fillerCount = matches.filter((m) => m.category === "filler").length;

  const features: KeywordFeatures = {
    residual,
    words,
    intent: intentMatch?.phrase ?? null,
    intentRank,
    hasDescriptor,
    hasMonth: matches.some((m) => m.category === "month"),
    hasYear: matches.some((m) => m.category === "year"),
    matches,
    categories,
    unknownTokens,
  };

  return {
    tier,
    // Intent dominates, then how highly the lexicon ranks the modifier, then
    // brevity. Unknown words and filler break ties downward.
    subScore:
      intentRank * 10_000 + modifierRank * 100 + words * 10 + unknownTokens.length * 5 + fillerCount * 2,
    features,
  };
}
