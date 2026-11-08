/**
 * Keyword tiers, ordered most valuable first.
 *
 * A keyword is only as broad as its narrowest qualifier, so a line carrying
 * several dimensions ("Store Arizona black friday coupon code") takes the
 * *highest* tier number among them — geo here, not seasonal. That rule is what
 * keeps the 20k budget from being eaten by a city × holiday cross-product
 * before every store's plain "[Store coupon code]" has landed.
 */
export const KEYWORD_TIERS = [
  {
    tier: 1,
    key: "core",
    label: "Core intent",
    description: "Brand plus a bare coupon term — nothing else. The keywords that must never be cut.",
  },
  {
    tier: 2,
    key: "descriptor",
    label: "Core + descriptor",
    description: "Brand, what the store sells, and a coupon term (e.g. \"[Store pet care coupon code]\").",
  },
  {
    tier: 3,
    key: "offer",
    label: "Offer angle",
    description: "Evergreen angles: free shipping, first order, sitewide, student, app, referral, membership.",
  },
  {
    tier: 4,
    key: "qualifier",
    label: "Qualifier",
    description: "Trust, urgency and discount-value words: verified, working, latest, today, $10 off, 20 percent off.",
  },
  {
    tier: 5,
    key: "seasonal",
    label: "Seasonal / dated",
    description: "Holidays and sale events, or any keyword naming a month or year.",
  },
  {
    tier: 6,
    key: "vertical",
    label: "Product vertical",
    description: "Category nouns: clothing, beauty, electronics, laptop, groceries.",
  },
  {
    tier: 7,
    key: "geo",
    label: "Geography",
    description: "City, state or country terms. Usually better handled by location targeting than by keyword.",
  },
  {
    tier: 8,
    key: "longtail",
    label: "Long tail",
    description:
      "Filler restatements of the brand (company, official website), payment methods, how-to phrasings, and anything unrecognised.",
  },
] as const;

export type KeywordTier = (typeof KEYWORD_TIERS)[number]["tier"];
export type KeywordTierKey = (typeof KEYWORD_TIERS)[number]["key"];

export const TIER_BY_NUMBER = new Map(KEYWORD_TIERS.map((t) => [t.tier, t]));

/**
 * Every bucket a lexicon sorts vocabulary into. `intent` is the coupon word
 * itself; the rest are modifiers that sit around it. `descriptor`, `month`,
 * `year`, `amount` and `unknown` are not lists — they are detected from the
 * generation context or the token shape — but they still carry a tier.
 */
export type LexiconCategory =
  | "intent"
  | "descriptor"
  | "offer"
  | "qualifier"
  | "urgency"
  | "amount"
  | "seasonal"
  | "month"
  | "year"
  | "vertical"
  | "geo"
  | "filler"
  | "payment"
  | "informational"
  | "connector"
  | "unknown";

/** Which tier a keyword lands in when it carries a phrase from this category. */
export const CATEGORY_TIER: Record<LexiconCategory, KeywordTier> = {
  intent: 1,
  connector: 1,
  descriptor: 2,
  offer: 3,
  qualifier: 4,
  urgency: 4,
  amount: 4,
  seasonal: 5,
  month: 5,
  year: 5,
  vertical: 6,
  geo: 7,
  filler: 8,
  payment: 8,
  informational: 8,
  unknown: 8,
};

/**
 * The vocabulary of one language. Order inside every list is meaningful — it is
 * the rank used to sort keywords within a tier, so put the terms you most want
 * to keep first.
 *
 * Phrases may be multi-word; matching is longest-first, so listing both
 * "free shipping" and "free" resolves the way you would expect.
 */
export interface Lexicon {
  /** BCP-47-ish language code, e.g. "en", "de". */
  code: string;
  /** Human label for the admin UI. */
  language: string;
  /** The coupon term itself, ranked by commercial value. */
  intentTerms: string[];
  /**
   * Month → every spelling that appears in keyword lists. Keys are always the
   * English month name so one `campaignMonth` setting resolves across every
   * language; the values carry the local spellings ("august" → ["august"],
   * "march" → ["märz", "maerz"]).
   */
  months: Record<string, string[]>;
  /** Evergreen offer angles. */
  offerModifiers?: string[];
  /** Trust and validity words. */
  qualifierModifiers?: string[];
  /** Time-pressure words. */
  urgencyModifiers?: string[];
  /** Discount-value words; bare numbers are detected automatically. */
  amountModifiers?: string[];
  /** Holidays and named sale events. */
  seasonalModifiers?: string[];
  /** Product categories. */
  verticals?: string[];
  /** Cities, states, regions, countries. */
  geoModifiers?: string[];
  /** Words that only restate the brand and add no new search. */
  fillerModifiers?: string[];
  /** Payment rails and banks. */
  paymentModifiers?: string[];
  /** Research phrasings ("how to get"). */
  informationalModifiers?: string[];
  /** Grammatical glue, ignored when scoring. */
  connectors?: string[];
}

/**
 * A language's full campaign vocabulary: the classification lexicon plus the
 * things generation and targeting need — where the language is spoken, how its
 * keywords are ordered, and what it must never bid on.
 */
export interface LocalePack extends Lexicon {
  /** ISO 3166-1 alpha-2 countries where this language is worth targeting. */
  countries: string[];
  /**
   * Negatives in this language. Never ranked or capped — English negatives do
   * not protect a German campaign, so each language carries its own.
   */
  negativeKeywords: string[];
  /**
   * Word-order templates, most natural first. Placeholders: `{brand}`,
   * `{descriptor}`, `{intent}`, `{modifier}`. Languages differ here — "code
   * promo Tabs" is the natural French order, "Tabs Gutscheincode" the German.
   */
  patterns: string[];
  /**
   * Emit an accent-stripped twin of every keyword ("código" → "codigo").
   * Searchers frequently type without accents.
   */
  stripAccents?: boolean;
  /**
   * Emit split and joined forms of compound intent terms
   * ("Gutscheincode" ↔ "Gutschein Code"). German, Dutch and Danish compound;
   * Romance languages do not.
   */
  compoundForms?: boolean;
}

export interface KeywordMatch {
  phrase: string;
  category: LexiconCategory;
  /** Index within its lexicon list; 0 is the most valuable. */
  rank: number;
}

export interface KeywordFeatures {
  /** The keyword with match-type syntax, brand and descriptor removed. */
  residual: string;
  /** Word count of the full keyword, as Google counts it. */
  words: number;
  /** Highest-ranked intent term found, if any. */
  intent: string | null;
  /** Index of that term in `intentTerms`; 99 when the keyword has no intent word. */
  intentRank: number;
  hasDescriptor: boolean;
  hasMonth: boolean;
  hasYear: boolean;
  matches: KeywordMatch[];
  categories: LexiconCategory[];
  /** Words no list in the lexicon recognised. Non-empty means the lexicon has a gap. */
  unknownTokens: string[];
}

export interface Classification {
  tier: KeywordTier;
  /** Sort key within a tier; lower is better. */
  subScore: number;
  features: KeywordFeatures;
}
