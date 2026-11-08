import { stripMatchType, wordCount } from "./classify";
import { EN_LEXICON } from "./locales/en";

/** Google Ads rejects any keyword text longer than 10 words. */
const MAX_KEYWORD_WORDS = 10;

/** Month name → all spellings (full + abbreviations) that appear in the keyword lists. */
const MONTH_TOKENS = EN_LEXICON.months;

export const MONTH_NAMES = Object.keys(MONTH_TOKENS);

const ALL_MONTH_TOKENS = Object.values(MONTH_TOKENS).flat();
const MONTH_REGEX = new RegExp(`\\b(${ALL_MONTH_TOKENS.join("|")})\\b`, "gi");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces a whole word (case-insensitive) with a replacement in a single line. */
function swapWord(line: string, word: string, replacement: string): string {
  if (!word) return line;
  return line.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), replacement);
}

/** True if the line contains `word` as a whole word (case-insensitive). */
function hasWord(line: string, word: string): boolean {
  if (!word) return false;
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(line);
}

/** Collapses the double spaces / stray bracket gaps left after removing a word. */
function tidy(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .replace(/\s+"/g, '"')
    .replace(/"\s+/g, '"')
    .trim();
}

/** True if the line names a month other than the campaign month (so it should be dropped). */
function hasOtherMonth(line: string, allowed: Set<string>): boolean {
  const matches = line.toLowerCase().match(MONTH_REGEX);
  if (!matches) return false;
  return matches.some((token) => !allowed.has(token));
}

export interface GenerateOptions {
  /** The template's own descriptor word (e.g. "chocolate") swapped out / removed. */
  brandDescriptor?: string;
  /** Store descriptors that replace the descriptor word — one full pass per descriptor. Empty => remove it. */
  descriptors?: string[];
  /** Full month name (e.g. "july"). When set, keywords naming any other month are dropped. */
  campaignMonth?: string;
  /** Language this pass produces, recorded on every result. Defaults to "en". */
  locale?: string;
  /**
   * What to do when substitution pushes a line past Google's 10-word ceiling.
   *
   * "drop" (default) is right for positive keywords — Google would reject the
   * line anyway, and a truncated form would target something you didn't choose.
   *
   * "shorten" is right for negatives: Google matches a negative against the
   * search query, so `[work from home job]` blocks everything
   * `[Long Store Name premium pet care work from home job]` would have, and
   * more. Dropping it instead silently removes protection and costs real spend.
   */
  overflow?: "drop" | "shorten";
}

/** Which part had to be sacrificed to fit the 10-word limit, if any. */
export type KeywordShortening = "descriptor" | "brand" | null;

/**
 * Where a generated keyword came from. Ranking needs all four axes: the tier
 * sort runs *within* each (locale, name variant, descriptor) group and then
 * interleaves the groups, so no single group's long tail can consume the
 * campaign budget before another group's core terms have landed.
 */
export interface KeywordRecord {
  /** The final keyword text, match-type syntax included. */
  keyword: string;
  /** Position of the source line in the template list. */
  sourceIndex: number;
  locale: string;
  nameVariant: string;
  nameVariantIndex: number;
  /** The descriptor used on this pass; "" means the descriptor word was removed. */
  descriptor: string;
  descriptorIndex: number;
  /** Set when the line had to be shortened to fit the 10-word limit. */
  shortened?: KeywordShortening;
}

/**
 * Re-targets a base keyword list onto a store by swapping the template's base
 * brand word (e.g. "tabs") for the store name, keeping every other word intact,
 * so the store keeps the full list instead of a deduplicated fraction.
 *
 * Descriptor handling (when the template has a `brandDescriptor`, e.g. "chocolate"):
 *  - a descriptor is supplied ("pet care") => the word is replaced with it,
 *  - no descriptor is supplied            => the word is removed entirely.
 *  So to KEEP the original word (e.g. generating for Tabs itself), pass it as
 *  the descriptor ("chocolate").
 *  When the store name already contains the descriptor ("Tabs Chocolate"), the
 *  name is substituted without it on lines that carry their own descriptor, so
 *  "[tabs co chocolate coupon code]" yields "[Tabs co chocolate coupon code]"
 *  rather than repeating the word.
 *
 * When `campaignMonth` is set, keywords that name a different month (full name
 * or abbreviation) are dropped — a July campaign keeps July/no-month keywords
 * and drops August, September, … terms.
 *
 * `targetNames` is the store name plus any spelling variants; each name runs a
 * full pass. Results are de-duplicated (exact, case-insensitive) preserving
 * first-seen order.
 */
export function generateStoreKeywordRecords(
  lines: string[],
  brandName: string,
  targetNames: string[],
  options: GenerateOptions = {}
): KeywordRecord[] {
  return generate(lines, brandName, targetNames, options).records;
}

interface GenerationResult {
  records: KeywordRecord[];
  /** Results that had to lose their descriptor or brand to fit 10 words. */
  shortened: number;
  /**
   * Source lines that produced nothing anywhere because every substitution ran
   * past 10 words. For negatives this is lost protection and must be surfaced.
   */
  dropped: number;
}

function generate(
  lines: string[],
  brandName: string,
  targetNames: string[],
  options: GenerateOptions = {}
): GenerationResult {
  const { brandDescriptor = "", descriptors = [], campaignMonth = "", locale = "en", overflow = "drop" } = options;
  const seen = new Set<string>();
  const output: KeywordRecord[] = [];
  // Source lines that lost at least one pass to the word limit. Only those that
  // also never produced output anywhere count as genuinely dropped.
  const lengthDropped = new Set<number>();

  const allowedMonthTokens = campaignMonth
    ? new Set(MONTH_TOKENS[campaignMonth.toLowerCase()] ?? [])
    : null;

  // No descriptor => a single pass whose empty descriptor removes the word.
  const descriptorPasses = descriptors.length > 0 ? descriptors : [""];

  targetNames.forEach((targetName, nameVariantIndex) => {
    descriptorPasses.forEach((descriptor, descriptorIndex) => {
      // A store name can already carry the descriptor ("Tabs Chocolate" + "chocolate").
      // Dropping it in whole would then say the descriptor twice on any template line
      // that has its own descriptor slot, so keep a shortened name for those lines.
      const withoutDescriptor = descriptor ? tidy(swapWord(targetName, descriptor, "")) : "";
      const shortName = withoutDescriptor && withoutDescriptor !== targetName ? withoutDescriptor : "";

      lines.forEach((line, sourceIndex) => {
        // Drop keywords for other months before doing any work.
        if (allowedMonthTokens && hasOtherMonth(line, allowedMonthTokens)) return;

        // "[tabs co chocolate coupon code]" already supplies the descriptor itself, so
        // it takes "Tabs" and stays "[Tabs co chocolate coupon code]"; a line without
        // one ("[tabs coupon code]") still gets the full "[Tabs Chocolate coupon code]".
        const name = shortName && hasWord(line, brandDescriptor) ? shortName : targetName;

        const build = (useName: string, useDescriptor: string) => {
          let text = swapWord(line, brandName, useName);
          if (brandDescriptor) {
            // descriptor may be "" here, which removes the word; tidy the gap.
            text = tidy(swapWord(text, brandDescriptor, useDescriptor));
          }
          return text;
        };

        let generated = build(name, descriptor);
        let shortened: KeywordShortening = null;

        // Google Ads rejects keyword text over 10 words — a long store name or
        // descriptor substituted into a template line can push it over that.
        if (wordCount(generated) > MAX_KEYWORD_WORDS) {
          if (overflow === "drop") {
            lengthDropped.add(sourceIndex);
            return;
          }
          // Shed the least load-bearing part first. A negative keeps working
          // without its descriptor, and works more broadly without the brand.
          generated = tidy(build(name, ""));
          shortened = "descriptor";
          if (wordCount(generated) > MAX_KEYWORD_WORDS) {
            generated = tidy(build("", ""));
            shortened = "brand";
          }
          // Nothing meaningful left to match on, or still too long.
          if (wordCount(generated) > MAX_KEYWORD_WORDS || !stripMatchType(generated)) {
            lengthDropped.add(sourceIndex);
            return;
          }
        }

        const key = generated.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        output.push({
          keyword: generated,
          sourceIndex,
          locale,
          nameVariant: targetName,
          nameVariantIndex,
          descriptor,
          descriptorIndex,
          shortened,
        });
      });
    });
  });

  const produced = new Set(output.map((r) => r.sourceIndex));
  return {
    records: output,
    shortened: output.filter((r) => r.shortened).length,
    dropped: [...lengthDropped].filter((index) => !produced.has(index)).length,
  };
}

/**
 * Negative keywords, which follow different rules from positives: they are
 * shortened rather than dropped when substitution runs long, and the caller
 * gets back how much had to give so the UI can say so out loud.
 *
 * Do not pass `campaignMonth` here — a negative is not time-bound, and a July
 * campaign still wants its August negatives.
 */
export function generateNegativeKeywordRecords(
  lines: string[],
  brandName: string,
  targetNames: string[],
  options: Omit<GenerateOptions, "overflow" | "campaignMonth"> = {}
): GenerationResult {
  return generate(lines, brandName, targetNames, { ...options, campaignMonth: "", overflow: "shorten" });
}

/** The plain-text form of {@link generateStoreKeywordRecords}, unchanged in behaviour. */
export function generateStoreKeywords(
  lines: string[],
  brandName: string,
  targetNames: string[],
  options: GenerateOptions = {}
): string[] {
  return generateStoreKeywordRecords(lines, brandName, targetNames, options).map((r) => r.keyword);
}

/**
 * Months and years are ignored when judging whether two keywords say the same
 * thing, so "voucher 2026", "voucher January" and "voucher Jan" collapse into
 * plain "voucher". Freshness reaches the ad copy through its own campaign
 * month and its own headline slots — spending sample slots on a dozen spellings
 * of the same date buys nothing.
 */
const SAMPLE_DATE_TOKENS = new Set(ALL_MONTH_TOKENS);

/** Past this, template keywords carry geography/vertical noise rather than intent. */
const MAX_SAMPLE_KEYWORD_WORDS = 6;

/** Crude singularizer so "code"/"codes" and "coupon"/"coupons" count as one term. */
function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

const SAMPLE_STOPWORDS = new Set(["the", "a", "an", "for", "of", "in", "on", "at", "to", "with", "and", "my", "best"]);

/**
 * Words that just re-name the store rather than describe a different search.
 * The template pairs each of these with every intent synonym, so left in they
 * read as fresh terms and quietly consume half the sample on "company coupon",
 * "store discount", "official promo" — none of which makes a usable headline.
 * "site" counts as filler on its own ("official site coupon"); the offer angle
 * that matters is "sitewide"/"site wide", which keeps its distinguishing word.
 */
const FILLER_MODIFIERS = new Set([
  "company", "store", "official", "website", "site", "web", "www", "com", "co", "inc", "llc", "brand", "shop", "online",
]);

/**
 * The distinct search idea in a keyword: its words minus the store name,
 * stopwords and filler modifiers, singularized. "Tabs Store Coupon Codes" and
 * "Tabs Coupon Code" both reduce to {coupon, code}.
 */
function keywordSignature(keyword: string, storeTokens: Set<string>): Set<string> {
  return new Set(
    stripMatchType(keyword)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map(singular)
      .filter(
        (w) =>
          w &&
          !SAMPLE_STOPWORDS.has(w) &&
          !FILLER_MODIFIERS.has(w) &&
          !storeTokens.has(w) &&
          !SAMPLE_DATE_TOKENS.has(w) &&
          !/^(19|20)\d{2}$/.test(w)
      )
  );
}

/**
 * Drops filler modifiers from the text that gets surfaced. Because the
 * signature ignores them, the first phrasing of an idea can be the padded one
 * ("Tabs Chocolate company sale"); the ad copy is better served by the plain
 * form. Words belonging to the store's own name are never removed, so a store
 * actually called "The Body Shop" keeps its "Shop".
 */
function cleanSurface(text: string, storeTokens: Set<string>): string {
  const cleaned = tidy(
    text
      .split(/\s+/)
      .filter((word) => {
        const token = singular(word.toLowerCase().replace(/[^a-z0-9]/g, ""));
        return !FILLER_MODIFIERS.has(token) || storeTokens.has(token);
      })
      .join(" ")
  );
  return cleaned || text;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Two keywords describe the same search when half their content words match.
 * Catches both axes the template varies along: plural/spelling variants
 * ("coupon code" / "coupon codes") and filler modifiers ("tabs company coupon
 * code" / "tabs coupon code"), which together are ~90% of the generated list.
 */
const SAMPLE_DUPLICATE_THRESHOLD = 0.5;

/**
 * Picks a small, genuinely varied sample from a generated keyword list, for
 * feeding to ad-copy generation.
 *
 * Taking the first N is useless here: the list is built as
 * modifier × intent-synonym × plural, so its opening block is one idea spelled
 * fifteen ways ("coupon code", "coupon codes", "coupon", "coupons", …). This
 * walks the list in its existing intent order — highest-commercial-intent
 * terms first — but skips anything that restates a keyword already picked, so
 * each slot spends itself on a different search.
 *
 * Long keywords are excluded: past ~6 words the template's tail is geography
 * and unrelated verticals ("tabs co chocolate groceries discount code May
 * 2026"), which make for bad headlines.
 */
export function pickSampleKeywords(keywords: string[], count: number, storeName = ""): string[] {
  const storeTokens = new Set(
    storeName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map(singular)
  );

  const chosen: string[] = [];
  const chosenSignatures: Set<string>[] = [];
  const tokenUses = new Map<string, number>();

  // No single word may dominate the sample. Without this the whole budget goes
  // to the intent-synonym family — "coupon code", "discount code", "promo
  // code", … thirteen deep — and never reaches the angles that make different
  // headlines ("free shipping", "first order", "site wide").
  const perTokenCap = Math.max(2, Math.ceil(count / 4));

  // Two passes: the first holds the token cap, the second refills any unused
  // slots without it, so a short or narrow list still returns `count` items.
  for (const capped of [true, false]) {
    for (const keyword of keywords) {
      if (chosen.length === count) break;
      const text = stripMatchType(keyword);
      if (!text || wordCount(text) > MAX_SAMPLE_KEYWORD_WORDS) continue;

      const signature = keywordSignature(keyword, storeTokens);
      if (signature.size === 0) continue;
      if (chosenSignatures.some((s) => overlap(signature, s) >= SAMPLE_DUPLICATE_THRESHOLD)) continue;
      if (capped && [...signature].some((t) => (tokenUses.get(t) ?? 0) >= perTokenCap)) continue;

      chosen.push(cleanSurface(text, storeTokens));
      chosenSignatures.push(signature);
      for (const token of signature) tokenUses.set(token, (tokenUses.get(token) ?? 0) + 1);
    }
  }

  return chosen;
}
