import { stripMatchType, wordCount } from "./classify";
import type { KeywordRecord } from "./generate";
import type { LocalePack } from "./types";

/** Google Ads rejects any keyword text longer than 10 words. */
const MAX_KEYWORD_WORDS = 10;

/**
 * Categories that can fill a pattern's `{modifier}` slot.
 *
 * `connectors` are grammar, and `informationalModifiers` are sentence openings
 * ("wie bekomme ich") that read as nonsense dropped into a modifier slot —
 * both exist for classification only. A pack that wants question-shaped
 * keywords should spell them out as patterns.
 *
 * `amountModifiers` are excluded for the same reason: they are the words that
 * frame a number ("ab", "Prozent Rabatt", "percent off"), and no pattern
 * supplies one, so on their own they produce "[Store ab Aktionscode]".
 */
const MODIFIER_FIELDS = [
  "offerModifiers",
  "qualifierModifiers",
  "urgencyModifiers",
  "seasonalModifiers",
  "verticals",
  "geoModifiers",
  "fillerModifiers",
  "paymentModifiers",
] as const;

export type MatchType = "exact" | "phrase" | "broad";

export interface LocaleGenerateOptions {
  /** What the store sells, in this language. One full pass per descriptor. */
  descriptors?: string[];
  /** English month name; fills `{month}` with that month's local spellings. */
  campaignMonth?: string;
  /** Fills `{year}`. Defaults to the current year. */
  year?: number;
  /** Overrides the pack's `stripAccents`. */
  accentVariants?: boolean;
  /** Overrides the pack's `compoundForms`. */
  compoundVariants?: boolean;
  /** Match-type wrapper. Defaults to exact, matching the English template. */
  matchType?: MatchType;
}

function tidy(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function wrap(text: string, matchType: MatchType): string {
  if (matchType === "exact") return `[${text}]`;
  if (matchType === "phrase") return `"${text}"`;
  return text;
}

/** Removes accents but keeps the letters, so "código" → "codigo". */
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

/**
 * Spaced forms of compound intent terms, for the languages that glue words
 * together. "Gutscheincode" also gets searched as "Gutschein Code".
 *
 * Deliberately conservative: a split is only emitted when *both* halves are
 * themselves known intent terms, so we never invent a word boundary. German and
 * Dutch link compounds with an -s- or -n- ("Aktion-s-code",
 * "korting-s-code"), so when trimming that linker reveals a known term both the
 * literal and the trimmed spacing are emitted — searchers type both.
 */
export function compoundSplits(terms: string[]): string[] {
  const known = new Set(terms.map((t) => t.toLowerCase()));
  const out: string[] = [];

  for (const term of terms) {
    const lower = term.toLowerCase();
    if (lower.includes(" ")) continue;

    for (let cut = 3; cut <= lower.length - 3; cut += 1) {
      const head = lower.slice(0, cut);
      const tail = lower.slice(cut);
      if (!known.has(tail)) continue;

      if (known.has(head)) {
        out.push(`${head} ${tail}`);
        break;
      }
      const trimmed = head.replace(/[sn]$/, "");
      if (trimmed !== head && trimmed.length >= 3 && known.has(trimmed)) {
        out.push(`${head} ${tail}`);
        out.push(`${trimmed} ${tail}`);
        break;
      }
    }
  }

  return out;
}

/**
 * The pack with its compound splits folded into `intentTerms`.
 *
 * Without this the generator emits vocabulary its own lexicon cannot read:
 * "Aktionscode" splits to "aktions code", and because "aktions" is in no list
 * the classifier scores it as unknown and dumps it into the long tail. Pass the
 * expanded pack as the lexicon wherever these keywords get classified.
 */
export function expandPack(pack: LocalePack): LocalePack {
  const splits = pack.compoundForms ? compoundSplits(pack.intentTerms) : [];
  if (splits.length === 0) return pack;
  return { ...pack, intentTerms: [...pack.intentTerms, ...splits] };
}

/**
 * Builds a language's keyword list from its pack: every pattern crossed with
 * the vocabulary that its slots call for.
 *
 * Unlike the English path — which re-targets a fixed 19,975-line template — this
 * composes from structured vocabulary, so a language is ~200 reviewable data
 * entries rather than twenty thousand hand-written lines. Cardinality is
 * controlled by the pack's `patterns`: a pattern only iterates the slots it
 * actually names, so adding `{modifier}` to one pattern is what multiplies the
 * output, not a hidden cross-product.
 *
 * Results carry the same {@link KeywordRecord} provenance as the English
 * generator, so both feed one ranking pass and interleave by locale.
 */
export function generateLocaleKeywordRecords(
  pack: LocalePack,
  targetNames: string[],
  options: LocaleGenerateOptions = {}
): KeywordRecord[] {
  const {
    descriptors = [],
    campaignMonth = "",
    year = new Date().getFullYear(),
    matchType = "exact",
  } = options;

  const wantAccents = options.accentVariants ?? pack.stripAccents ?? false;
  const wantCompounds = options.compoundVariants ?? pack.compoundForms ?? false;

  // Must match what `expandPack` produces, so every emitted term is one the
  // classifier can read back.
  const intents = wantCompounds
    ? [...pack.intentTerms, ...compoundSplits(pack.intentTerms)]
    : [...pack.intentTerms];

  const modifiers = MODIFIER_FIELDS.flatMap((field) => pack[field] ?? []);
  const months = campaignMonth ? (pack.months?.[campaignMonth.toLowerCase()] ?? []) : [];
  const descriptorPasses = descriptors.length > 0 ? descriptors : [""];

  const seen = new Set<string>();
  const output: KeywordRecord[] = [];
  let sourceIndex = 0;

  const emit = (
    text: string,
    nameVariant: string,
    nameVariantIndex: number,
    descriptor: string,
    descriptorIndex: number
  ) => {
    const tidied = tidy(text);
    if (!tidied || wordCount(tidied) > MAX_KEYWORD_WORDS) return;

    const keyword = wrap(tidied, matchType);
    const key = keyword.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    output.push({
      keyword,
      sourceIndex: sourceIndex++,
      locale: pack.code,
      nameVariant,
      nameVariantIndex,
      descriptor,
      descriptorIndex,
    });
  };

  targetNames.forEach((targetName, nameVariantIndex) => {
    descriptorPasses.forEach((descriptor, descriptorIndex) => {
      for (const intent of intents) {
        for (const pattern of pack.patterns ?? []) {
          // A descriptor pattern without a descriptor just restates the plain
          // one, so skip it rather than emit a duplicate.
          if (pattern.includes("{descriptor}") && !descriptor) continue;

          const modifierValues = pattern.includes("{modifier}") ? modifiers : [""];
          const monthValues = pattern.includes("{month}") ? months : [""];
          if (pattern.includes("{month}") && months.length === 0) continue;

          for (const modifier of modifierValues) {
            for (const month of monthValues) {
              const text = pattern
                .replaceAll("{brand}", targetName)
                .replaceAll("{descriptor}", descriptor)
                .replaceAll("{intent}", intent)
                .replaceAll("{modifier}", modifier)
                .replaceAll("{month}", month)
                .replaceAll("{year}", String(year));

              emit(text, targetName, nameVariantIndex, descriptor, descriptorIndex);

              // The twin follows its parent immediately, so equal scores break
              // on emission order and the accented original always wins.
              if (wantAccents) {
                const folded = stripAccents(text);
                if (folded !== text) emit(folded, targetName, nameVariantIndex, descriptor, descriptorIndex);
              }
            }
          }
        }
      }
    });
  });

  return output;
}

/**
 * Negatives for one language. No patterns and no cross-product — a negative is
 * a bare concept, optionally brand-qualified. Both forms are emitted because
 * the unqualified one protects the whole campaign while the brand-qualified one
 * survives being pasted into a shared list.
 */
export function generateLocaleNegativeRecords(
  pack: LocalePack,
  targetNames: string[],
  options: { matchType?: MatchType } = {}
): KeywordRecord[] {
  const { matchType = "exact" } = options;
  const seen = new Set<string>();
  const output: KeywordRecord[] = [];
  let sourceIndex = 0;

  const emit = (text: string, nameVariant: string, nameVariantIndex: number) => {
    const tidied = tidy(text);
    if (!tidied || wordCount(tidied) > MAX_KEYWORD_WORDS) return;
    const keyword = wrap(tidied, matchType);
    const key = keyword.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push({
      keyword,
      sourceIndex: sourceIndex++,
      locale: pack.code,
      nameVariant,
      nameVariantIndex,
      descriptor: "",
      descriptorIndex: 0,
    });
  };

  for (const negative of pack.negativeKeywords ?? []) {
    emit(negative, "", 0);
    targetNames.forEach((targetName, index) => emit(`${targetName} ${negative}`, targetName, index));
  }

  return output;
}

/** Plain-text form, for callers that do not need provenance. */
export function generateLocaleKeywords(
  pack: LocalePack,
  targetNames: string[],
  options: LocaleGenerateOptions = {}
): string[] {
  return generateLocaleKeywordRecords(pack, targetNames, options).map((r) => r.keyword);
}

export { stripAccents };
