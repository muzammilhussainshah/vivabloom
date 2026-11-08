import { classifyKeyword } from "./classify";
import type { KeywordRecord } from "./generate";
import { EN_LEXICON } from "./locales/en";
import { KEYWORD_TIERS, type KeywordFeatures, type KeywordTier, type Lexicon } from "./types";

export interface RankedKeyword extends KeywordRecord {
  tier: KeywordTier;
  /** Sort key within a tier; lower is better. */
  subScore: number;
  features: KeywordFeatures;
  /** Identifies the (locale, name variant, descriptor) bucket this came from. */
  groupKey: string;
  /** 1-based position in the final ordering. */
  position: number;
}

export interface RankOptions {
  /**
   * Language order, most important first. Groups interleave in this order, so
   * the first locale listed takes the first slot of every round. Locales not
   * listed keep their first-seen order behind those that are.
   */
  localeOrder?: string[];
  /** Per-locale vocabulary. Anything missing falls back to English. */
  lexicons?: Record<string, Lexicon>;
}

function groupKeyOf(record: KeywordRecord): string {
  return `${record.locale}|${record.nameVariantIndex}|${record.descriptorIndex}`;
}

/**
 * Classifies every record and returns them in campaign order.
 *
 * Two rules do the work:
 *
 *  1. **Tier before everything.** Every group's tier-1 keywords are emitted
 *     before any group's tier-2, and so on down to the long tail. Truncating
 *     the result at any length therefore cuts the least valuable keywords
 *     first, whatever dimension they came from.
 *
 *  2. **Round-robin inside a tier.** Within a tier the groups take turns —
 *     German core, English core, French core, German core #2, … — so a budget
 *     that runs out mid-tier still spent itself evenly across every language,
 *     name variant and descriptor rather than exhausting one and starving the
 *     rest. This is what stops "[Store Gutscheincode]" being lost because
 *     English filled the campaign first.
 *
 * Negative keywords must NOT go through here: they are protective, never
 * rationed, and keep their source order.
 */
export function orderKeywords(records: KeywordRecord[], options: RankOptions = {}): RankedKeyword[] {
  const { localeOrder = [], lexicons = {} } = options;

  const localeRank = new Map<string, number>();
  localeOrder.forEach((locale, index) => localeRank.set(locale, index));
  // Locales the caller didn't rank queue up behind the ones it did.
  for (const record of records) {
    if (!localeRank.has(record.locale)) localeRank.set(record.locale, localeRank.size + localeOrder.length);
  }

  const classified: RankedKeyword[] = records.map((record) => {
    const lexicon = lexicons[record.locale] ?? EN_LEXICON;
    // Both name forms are passed so a store whose name contains its own
    // descriptor ("Tabs Chocolate" + "chocolate") still has the whole name
    // stripped before the remaining words are read as vocabulary.
    const nameWithoutDescriptor = record.descriptor
      ? record.nameVariant.replace(new RegExp(`\\b${record.descriptor}\\b`, "gi"), "").replace(/\s+/g, " ").trim()
      : "";
    const { tier, subScore, features } = classifyKeyword(record.keyword, {
      lexicon,
      brandTokens: [record.nameVariant, nameWithoutDescriptor].filter(Boolean),
      descriptorTokens: record.descriptor ? [record.descriptor] : [],
    });
    return { ...record, tier, subScore, features, groupKey: groupKeyOf(record), position: 0 };
  });

  const ordered: RankedKeyword[] = [];

  for (const { tier } of KEYWORD_TIERS) {
    const inTier = classified.filter((r) => r.tier === tier);
    if (inTier.length === 0) continue;

    const groups = new Map<string, RankedKeyword[]>();
    for (const record of inTier) {
      const bucket = groups.get(record.groupKey);
      if (bucket) bucket.push(record);
      else groups.set(record.groupKey, [record]);
    }

    const lanes = [...groups.values()].sort((a, b) => {
      const [x, y] = [a[0], b[0]];
      return (
        (localeRank.get(x.locale) ?? 0) - (localeRank.get(y.locale) ?? 0) ||
        x.nameVariantIndex - y.nameVariantIndex ||
        x.descriptorIndex - y.descriptorIndex
      );
    });

    // Best-first inside each lane, then deal one card from each lane per round.
    for (const lane of lanes) {
      lane.sort((a, b) => a.subScore - b.subScore || a.sourceIndex - b.sourceIndex);
    }

    const deepest = Math.max(...lanes.map((lane) => lane.length));
    for (let depth = 0; depth < deepest; depth += 1) {
      for (const lane of lanes) {
        if (depth < lane.length) ordered.push(lane[depth]);
      }
    }
  }

  ordered.forEach((record, index) => {
    record.position = index + 1;
  });

  return ordered;
}

export interface TierSummary {
  tier: KeywordTier;
  label: string;
  count: number;
  /** 1-based position of this tier's first keyword, or 0 when the tier is empty. */
  firstPosition: number;
}

export interface GroupSummary {
  groupKey: string;
  locale: string;
  nameVariant: string;
  descriptor: string;
  count: number;
}

export interface RankingSummary {
  total: number;
  tiers: TierSummary[];
  groups: GroupSummary[];
}

/** Per-tier and per-group counts, for the campaign panel and the CLI. */
export function summarizeRanking(ranked: RankedKeyword[]): RankingSummary {
  const tiers: TierSummary[] = KEYWORD_TIERS.map(({ tier, label }) => {
    const members = ranked.filter((r) => r.tier === tier);
    return { tier, label, count: members.length, firstPosition: members[0]?.position ?? 0 };
  });

  const groups = new Map<string, GroupSummary>();
  for (const record of ranked) {
    const existing = groups.get(record.groupKey);
    if (existing) existing.count += 1;
    else
      groups.set(record.groupKey, {
        groupKey: record.groupKey,
        locale: record.locale,
        nameVariant: record.nameVariant,
        descriptor: record.descriptor,
        count: 1,
      });
  }

  return { total: ranked.length, tiers, groups: [...groups.values()] };
}

/**
 * Splits an ordered list into campaign-sized batches, then each batch into
 * clipboard-sized chunks. Both limits are Google Ads working constraints
 * rather than anything intrinsic, so both are caller-supplied.
 */
export interface KeywordChunk {
  /** 1-based position of the first keyword, inclusive. */
  from: number;
  /** 1-based position of the last keyword, inclusive. */
  to: number;
  keywords: string[];
}

export interface KeywordCampaign {
  index: number;
  from: number;
  to: number;
  chunks: KeywordChunk[];
  tiers: TierSummary[];
}

/**
 * Splits a plain list into clipboard-sized chunks numbered from `startAt`.
 * Used directly for negative keywords, which are never ranked or capped but
 * still have to be pasted in batches.
 */
export function chunkKeywords(keywords: string[], chunkSize = 10_000, startAt = 1): KeywordChunk[] {
  const chunks: KeywordChunk[] = [];
  const size = Math.max(1, chunkSize);

  for (let offset = 0; offset < keywords.length; offset += size) {
    const part = keywords.slice(offset, offset + size);
    chunks.push({ from: startAt + offset, to: startAt + offset + part.length - 1, keywords: part });
  }

  return chunks;
}

export function batchKeywords(
  ranked: RankedKeyword[],
  { campaignLimit = 20_000, chunkSize = 10_000 }: { campaignLimit?: number; chunkSize?: number } = {}
): KeywordCampaign[] {
  const campaigns: KeywordCampaign[] = [];
  const limit = Math.max(1, campaignLimit);

  for (let start = 0; start < ranked.length; start += limit) {
    const slice = ranked.slice(start, start + limit);
    const chunks = chunkKeywords(
      slice.map((r) => r.keyword),
      chunkSize,
      start + 1
    );

    campaigns.push({
      index: campaigns.length + 1,
      from: start + 1,
      to: start + slice.length,
      chunks,
      tiers: summarizeRanking(slice).tiers,
    });
  }

  return campaigns;
}
