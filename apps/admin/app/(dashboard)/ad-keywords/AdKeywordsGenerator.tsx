"use client";

import { useMemo, useState } from "react";
import {
  batchKeywords,
  broadenSingleWordNegatives,
  chunkKeywords,
  EN_LEXICON,
  expandPack,
  generateLocaleKeywordRecords,
  generateLocaleNegativeRecords,
  generateNegativeKeywordRecords,
  generateOffIntentNegativeRecords,
  generateStoreKeywordRecords,
  generateStoreKeywords,
  KEYWORD_TIERS,
  orderKeywords,
  pickSampleKeywords,
  stripMatchType,
  type KeywordCampaign,
  type KeywordChunk,
  type KeywordRecord,
  type KeywordTier,
  type Lexicon,
  type LocalePack,
  type TierSummary,
} from "@/lib/keywordGenerator";

/** English is always available alongside a country's own languages. */
const ENGLISH = "en";

/**
 * Countries with no locale pack of their own but worth targeting in English.
 * Everything else is derived from the packs' `countries` lists.
 */
const ENGLISH_ONLY_COUNTRIES = ["US", "GB", "IE", "CA", "AU"];

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function countryLabel(code: string): string {
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Google Ads' working limits — editable because they differ per account setup. */
const DEFAULT_CAMPAIGN_LIMIT = 20_000;
const DEFAULT_CHUNK_SIZE = 10_000;

/** How many lines each panel shows in its collapsible preview. */
const PREVIEW_LINES = 200;

/**
 * Floor on the campaign size. Nothing stops a stray keystroke turning "20000"
 * into "2", and one panel per two keywords is tens of thousands of panels —
 * enough to lock the tab. No real campaign is this small.
 */
const MIN_CAMPAIGN_LIMIT = 500;

/** Current month as a full lowercase name (e.g. "july") — the default campaign month. */
const CURRENT_MONTH = new Date().toLocaleString("en-US", { month: "long" }).toLowerCase();

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface Template {
  id: string;
  name: string;
  brandTokens: string[];
  brandName: string;
  brandDescriptor: string;
  keywords: string[];
  negativeKeywords: string[];
}

interface StoreOption {
  id: string;
  name: string;
  slug: string;
}

/**
 * One clipboard-sized batch per button, in order. Google Ads accepts only so
 * many keywords per paste, and with tens of thousands of lines it is very easy
 * to lose your place — so a copied button stays marked until the list is
 * regenerated, and the next one to press is the highlighted one.
 */
function ChunkButtons({
  idPrefix,
  chunks,
  copied,
  onCopy,
}: {
  idPrefix: string;
  chunks: KeywordChunk[];
  copied: Set<string>;
  onCopy: (id: string, text: string) => void;
}) {
  const ids = chunks.map((chunk) => `${idPrefix}:${chunk.from}`);
  const nextId = ids.find((id) => !copied.has(id));

  return (
    <div className="flex flex-wrap gap-2">
      {chunks.map((chunk, index) => {
        const id = ids[index];
        const isCopied = copied.has(id);
        const isNext = id === nextId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onCopy(id, chunk.keywords.join("\n"))}
            className={`rounded-base border px-3 py-1.5 text-xs font-medium transition-colors ${
              isCopied
                ? "border-border bg-surface-muted text-text-muted"
                : isNext
                  ? "border-brand-primary bg-brand-primary text-white hover:bg-brand-primary-hover"
                  : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            {isCopied ? "✓ Copied " : "Copy "}
            {chunk.from.toLocaleString()}–{chunk.to.toLocaleString()}
            <span className={isCopied ? "" : "opacity-70"}> ({chunk.keywords.length.toLocaleString()})</span>
          </button>
        );
      })}
    </div>
  );
}

/** What a campaign is made of, tier by tier. */
function TierPills({ tiers }: { tiers: TierSummary[] }) {
  const present = tiers.filter((tier) => tier.count > 0);
  if (present.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {present.map((tier) => (
        <span key={tier.tier} className="rounded-base bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
          T{tier.tier} {tier.label} <strong className="text-text">{tier.count.toLocaleString()}</strong>
        </span>
      ))}
    </div>
  );
}

/**
 * A read-only sample rather than the whole list: pushing tens of thousands of
 * lines into a textarea locks the tab, and the list is meant to be pasted into
 * Google Ads, not read here.
 */
function Preview({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-text-muted hover:text-text">
        Preview first {Math.min(PREVIEW_LINES, lines.length)} of {lines.length.toLocaleString()}
      </summary>
      <textarea
        readOnly
        value={lines.slice(0, PREVIEW_LINES).join("\n")}
        rows={12}
        className="mt-2 w-full rounded-base border border-border bg-surface-muted px-3 py-2 font-mono text-xs focus:outline-none"
      />
    </details>
  );
}

/**
 * One campaign is what actually gets run per region per store, so the first
 * batch is the deliverable and everything after it is the part that did not
 * fit. Numbering them all "Campaign N of M" reads as an instruction to build M
 * campaigns, which is not the workflow.
 */
function CampaignPanel({
  campaign,
  role,
  total,
  idPrefix,
  copied,
  onCopy,
}: {
  campaign: KeywordCampaign;
  role: "primary" | "overflow";
  total: number;
  /** Scopes copy marks to one region, so Germany's chunk 1 is not France's. */
  idPrefix: string;
  copied: Set<string>;
  onCopy: (id: string, text: string) => void;
}) {
  const lines = useMemo(() => campaign.chunks.flatMap((chunk) => chunk.keywords), [campaign]);
  const size = campaign.to - campaign.from + 1;

  return (
    <div
      className={`flex flex-col gap-3 rounded-base border p-4 ${
        role === "primary" ? "border-brand-primary bg-surface" : "border-border bg-surface-muted"
      }`}
    >
      <div>
        <h3 className="text-sm font-semibold">
          {role === "primary" ? (
            <>
              Paste this into your campaign{" "}
              <span className="font-normal text-text-muted">
                · best {size.toLocaleString()}
                {size < total ? ` of ${total.toLocaleString()}` : ""}
              </span>
            </>
          ) : (
            <>
              Overflow batch {campaign.index - 1}{" "}
              <span className="font-normal text-text-muted">
                · keywords {campaign.from.toLocaleString()}–{campaign.to.toLocaleString()} ({size.toLocaleString()})
              </span>
            </>
          )}
        </h3>
        {role === "primary" && (
          <p className="text-xs text-text-muted">Copy the batches below in order, left to right.</p>
        )}
      </div>
      <TierPills tiers={campaign.tiers} />
      <ChunkButtons
        idPrefix={`${idPrefix}-campaign-${campaign.index}`}
        chunks={campaign.chunks}
        copied={copied}
        onCopy={onCopy}
      />
      <Preview lines={lines} />
    </div>
  );
}

function NegativePanel({
  keywords,
  chunks,
  shortened,
  dropped,
  idPrefix,
  copied,
  onCopy,
}: {
  keywords: string[];
  chunks: KeywordChunk[];
  shortened: number;
  dropped: number;
  idPrefix: string;
  copied: Set<string>;
  onCopy: (id: string, text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">
        Negative keywords <span className="font-normal text-text-muted">({keywords.length.toLocaleString()})</span>
      </h3>
      <p className="text-xs text-text-muted">
        Never ranked and never capped — negatives only cost you the paste, so the whole list goes into every campaign.
      </p>
      {shortened > 0 && (
        <p className="text-xs text-text-muted">
          {shortened.toLocaleString()} were shortened to fit Google&apos;s 10-word limit. A negative matches against the
          search query, so the shorter form blocks at least as much.
        </p>
      )}
      {dropped > 0 && (
        <p className="text-sm text-brand-secondary">
          {dropped.toLocaleString()} could not be shortened enough and were dropped — this store name is long enough to
          be losing protection.
        </p>
      )}
      <ChunkButtons idPrefix={`${idPrefix}-negatives`} chunks={chunks} copied={copied} onCopy={onCopy} />
      <Preview lines={keywords} />
    </div>
  );
}

/**
 * One campaign: the countries it targets and the languages it buys in.
 *
 * Countries are a list rather than a single value because a Google Ads campaign
 * can target several at once, and often should — Germany, Austria and
 * Switzerland are one German campaign, not three. Only the language set drives
 * generation; the countries decide which languages are on offer and what the
 * block is called.
 */
interface RegionConfig {
  id: string;
  countries: string[];
  languages: string[];
}

function regionLabel(countries: string[]): string {
  if (countries.length === 0) return "No country";
  const names = countries.map(countryLabel);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

interface RegionResult extends RegionConfig {
  label: string;
  keywords: string[];
  /**
   * The English slice only. Ad-copy generation writes English headlines, so
   * feeding it the mixed-language list would put German terms in an English ad.
   */
  englishKeywords: string[];
  campaigns: KeywordCampaign[];
  /** Keywords ranked below the campaign limit — shown, but not part of the paste. */
  overflowCount: number;
  /** Keywords dropped by the tier checkboxes before batching. */
  trimmedByTier: number;
  /** Every kept keyword, grouped by locale code — feeds ad/sitelink copy for non-English languages. */
  keywordsByLocale: Record<string, string[]>;
  negatives: string[];
  negativeChunks: KeywordChunk[];
  negativesShortened: number;
  negativesDropped: number;
}

function RegionPicker({
  regions,
  languagesByCountry,
  localeNames,
  onChange,
}: {
  regions: RegionConfig[];
  languagesByCountry: Map<string, string[]>;
  localeNames: Map<string, string>;
  onChange: (regions: RegionConfig[]) => void;
}) {
  // A country belongs to at most one campaign, so the pickers only ever offer
  // what is still unclaimed.
  const used = new Set(regions.flatMap((r) => r.countries));
  const available = [...languagesByCountry.keys()]
    .filter((c) => !used.has(c))
    .sort((a, b) => countryLabel(a).localeCompare(countryLabel(b)));

  const languagesFor = (countries: string[]) => [
    ...new Set([...countries.flatMap((c) => languagesByCountry.get(c) ?? []), ENGLISH]),
  ];

  function addRegion(country: string) {
    // Default to the country's own languages plus English — the mix the
    // Keyword Planner data says actually gets searched in Europe.
    onChange([
      ...regions,
      { id: `${country}-${Date.now()}`, countries: [country], languages: languagesFor([country]) },
    ]);
  }

  function update(id: string, change: (region: RegionConfig) => RegionConfig) {
    onChange(regions.map((region) => (region.id === id ? change(region) : region)));
  }

  function addCountry(id: string, country: string) {
    update(id, (region) => {
      const countries = [...region.countries, country];
      // A newly added country's languages come switched on; unchecking is one
      // click, whereas noticing a missing language is not.
      return { ...region, countries, languages: languagesFor(countries) };
    });
  }

  function removeCountry(id: string, country: string) {
    update(id, (region) => {
      const countries = region.countries.filter((c) => c !== country);
      const stillOffered = new Set(languagesFor(countries));
      return { ...region, countries, languages: region.languages.filter((l) => stillOffered.has(l)) };
    });
  }

  function toggleLanguage(id: string, language: string) {
    update(id, (region) => ({
      ...region,
      languages: region.languages.includes(language)
        ? region.languages.filter((l) => l !== language)
        : [...region.languages, language],
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="addRegion" className="text-sm font-medium">
          Campaigns <span className="text-text-muted">(one keyword list per campaign)</span>
        </label>
        <select
          id="addRegion"
          value=""
          onChange={(e) => e.target.value && addRegion(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="">Add a campaign…</option>
          {available.map((country) => (
            <option key={country} value={country}>
              {countryLabel(country)}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-muted">
          Add more than one country to a campaign when they share a market — Germany, Austria and Switzerland are one
          German campaign, not three. Languages default to the local ones plus English, since Keyword Planner shows
          European shoppers searching both.
        </p>
      </div>

      {regions.map((region) => (
        <div key={region.id} className="flex flex-col gap-2 rounded-base border border-border bg-surface-muted p-3">
          <div className="flex flex-wrap items-center gap-2">
            {region.countries.map((country) => (
              <span
                key={country}
                className="flex items-center gap-1.5 rounded-base bg-surface px-2 py-1 text-xs font-medium"
              >
                {countryLabel(country)}
                {region.countries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCountry(region.id, country)}
                    aria-label={`Remove ${countryLabel(country)}`}
                    className="text-text-muted hover:text-brand-secondary"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            <select
              value=""
              onChange={(e) => e.target.value && addCountry(region.id, e.target.value)}
              disabled={available.length === 0}
              className="rounded-base border border-border bg-surface px-2 py-1 text-xs focus:border-brand-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">+ country</option>
              {available.map((country) => (
                <option key={country} value={country}>
                  {countryLabel(country)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(regions.filter((r) => r.id !== region.id))}
              className="ml-auto text-xs font-medium text-text-muted hover:text-brand-secondary"
            >
              Remove campaign
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {languagesFor(region.countries).map((language) => (
              <label key={language} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={region.languages.includes(language)}
                  onChange={() => toggleLanguage(region.id, language)}
                  className="h-3.5 w-3.5 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                {localeNames.get(language) ?? language.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdKeywordsGenerator({
  templates,
  stores,
  locales,
}: {
  templates: Template[];
  stores: StoreOption[];
  locales: LocalePack[];
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [storeId, setStoreId] = useState("");
  const [customName, setCustomName] = useState("");
  const [extraVariants, setExtraVariants] = useState("");
  const [descriptors, setDescriptors] = useState("");
  const [removeOtherMonths, setRemoveOtherMonths] = useState(true);
  const [campaignLimit, setCampaignLimit] = useState(DEFAULT_CAMPAIGN_LIMIT);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [enabledTiers, setEnabledTiers] = useState<Set<KeywordTier>>(
    () => new Set(KEYWORD_TIERS.map((t) => t.tier))
  );
  const [accentVariants, setAccentVariants] = useState(true);
  const [regions, setRegions] = useState<RegionConfig[]>([]);
  const [copied, setCopied] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<RegionResult[] | null>(null);

  function toggleTier(tier: KeywordTier) {
    setEnabledTiers((previous) => {
      const next = new Set(previous);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  const localeByCode = useMemo(() => new Map(locales.map((l) => [l.code, l])), [locales]);
  const localeNames = useMemo(
    () => new Map<string, string>([[ENGLISH, "English"], ...locales.map((l) => [l.code, l.language] as const)]),
    [locales]
  );

  // Invert each pack's `countries` list: Belgium offers Dutch and French,
  // Switzerland German, French and Italian.
  const languagesByCountry = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const country of ENGLISH_ONLY_COUNTRIES) map.set(country, []);
    for (const pack of locales) {
      for (const country of pack.countries ?? []) {
        map.set(country, [...(map.get(country) ?? []), pack.code]);
      }
    }
    return map;
  }, [locales]);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const selectedStore = stores.find((s) => s.id === storeId) ?? null;

  const primaryName = selectedStore?.name ?? customName.trim();

  const targetNames = useMemo(() => {
    const extras = extraVariants
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return [primaryName, ...extras].filter(Boolean);
  }, [primaryName, extraVariants]);

  const descriptorList = useMemo(
    () =>
      descriptors
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    [descriptors]
  );

  /** Builds one region's campaign from every language it targets. */
  function buildRegion(region: RegionConfig, activeTemplate: Template): RegionResult {
    const campaignMonth = removeOtherMonths ? CURRENT_MONTH : "";
    const records: KeywordRecord[] = [];
    const negatives: string[] = [];
    const lexicons: Record<string, Lexicon> = {};
    let negativesShortened = 0;
    let negativesDropped = 0;

    for (const language of region.languages) {
      if (language === ENGLISH) {
        const options = {
          brandDescriptor: activeTemplate.brandDescriptor,
          descriptors: descriptorList,
          campaignMonth,
        };
        records.push(
          ...generateStoreKeywordRecords(activeTemplate.keywords, activeTemplate.brandName, targetNames, options)
        );
        const negative = generateNegativeKeywordRecords(
          activeTemplate.negativeKeywords,
          activeTemplate.brandName,
          targetNames,
          { brandDescriptor: activeTemplate.brandDescriptor, descriptors: descriptorList }
        );
        negatives.push(...negative.records.map((r) => r.keyword));
        negativesShortened += negative.shortened;
        negativesDropped += negative.dropped;
        // Generic risk words (price, buy, cheap, …) already in the base
        // negative list, broadened so they block any query containing the
        // word, not just an exact match on that word alone.
        negatives.push(...broadenSingleWordNegatives(activeTemplate.negativeKeywords, EN_LEXICON));
        continue;
      }

      const pack = localeByCode.get(language);
      if (!pack) continue;
      // Classify against the expanded pack so compound splits the generator
      // emits are vocabulary the lexicon can read.
      lexicons[language] = expandPack(pack);
      records.push(
        ...generateLocaleKeywordRecords(pack, targetNames, { descriptors: descriptorList, campaignMonth, accentVariants })
      );
      negatives.push(...generateLocaleNegativeRecords(pack, targetNames).map((r) => r.keyword));
      negatives.push(...broadenSingleWordNegatives(pack.negativeKeywords, pack));
    }

    // Off-intent guard: bare "{brand}", "{brand} {descriptor}" and
    // "{descriptor}" alone, with no coupon/discount word at all. Every
    // positive keyword this tool generates always pairs the brand with an
    // intent term, so a search that's just these words is pure product
    // research, not discount-seeking — exact match blocks it without
    // touching any real positive (which always has that extra intent word).
    // Language-agnostic, so it runs once per region rather than per pass.
    negatives.push(...generateOffIntentNegativeRecords(targetNames, descriptorList).map((r) => r.keyword));

    // Ranked so a cap cuts the least valuable first, taking turns between every
    // language, name variant and descriptor.
    const ranked = orderKeywords(records, { localeOrder: region.languages, lexicons });
    const kept = ranked.filter((r) => enabledTiers.has(r.tier));
    kept.forEach((record, index) => {
      record.position = index + 1;
    });

    const seenNegatives = new Set<string>();
    const uniqueNegatives = negatives.filter((keyword) => {
      const key = keyword.toLowerCase();
      if (seenNegatives.has(key)) return false;
      seenNegatives.add(key);
      return true;
    });

    const keywordsByLocale: Record<string, string[]> = {};
    for (const record of kept) {
      (keywordsByLocale[record.locale] ??= []).push(record.keyword);
    }

    return {
      ...region,
      label: regionLabel(region.countries),
      keywords: kept.map((record) => record.keyword),
      englishKeywords: kept.filter((r) => r.locale === ENGLISH).map((r) => r.keyword),
      campaigns: batchKeywords(kept, { campaignLimit, chunkSize }),
      overflowCount: Math.max(0, kept.length - campaignLimit),
      trimmedByTier: ranked.length - kept.length,
      keywordsByLocale,
      negatives: uniqueNegatives,
      negativeChunks: chunkKeywords(uniqueNegatives, chunkSize),
      negativesShortened,
      negativesDropped,
    };
  }

  // Every generated language's keywords, merged across regions — lets the ad
  // copy and sitelink panels write in whichever language was actually generated,
  // not just English.
  const keywordsByLanguage = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const region of result ?? []) {
      for (const [locale, keywords] of Object.entries(region.keywordsByLocale)) {
        map[locale] = [...(map[locale] ?? []), ...keywords];
      }
    }
    return map;
  }, [result]);

  function handleGenerate() {
    if (!template || targetNames.length === 0) return;
    // With no region chosen, fall back to the original behaviour: one
    // English-only list, which is what the page did before regions existed.
    const targets: RegionConfig[] =
      regions.length > 0 ? regions : [{ id: "default", countries: ["US"], languages: [ENGLISH] }];

    // Chunk numbering restarts, so any copy marks from a previous run are stale.
    setCopied(new Set());
    setResult(targets.map((region) => buildRegion(region, template)));
  }

  async function handleCopy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied((previous) => new Set(previous).add(id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-base border border-border bg-surface p-4">
        {templates.length === 0 ? (
          <p className="text-sm text-text-muted">
            No keyword templates yet. Import one with <code>pnpm db:import-keywords</code>.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="template" className="text-sm font-medium">
                  Base keyword list
                </label>
                <select
                  id="template"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.keywords.length} keywords, {t.negativeKeywords.length} negatives)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="store" className="text-sm font-medium">
                  Store
                </label>
                <select
                  id="store"
                  value={storeId}
                  onChange={(e) => {
                    setStoreId(e.target.value);
                    if (e.target.value) setCustomName("");
                  }}
                  className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                >
                  <option value="">Custom name…</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!storeId && (
              <div className="flex flex-col gap-1">
                <label htmlFor="customName" className="text-sm font-medium">
                  Store name
                </label>
                <input
                  id="customName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Furlife"
                  className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="extraVariants" className="text-sm font-medium">
                Extra name variants <span className="text-text-muted">(optional, comma-separated)</span>
              </label>
              <input
                id="extraVariants"
                value={extraVariants}
                onChange={(e) => setExtraVariants(e.target.value)}
                placeholder="e.g. Fur life, Fur-life"
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
              <p className="text-xs text-text-muted">
                Each variant generates its own set of lines, merged into one deduplicated list below.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="descriptors" className="text-sm font-medium">
                Descriptors <span className="text-text-muted">(optional, comma-separated — what the store sells)</span>
              </label>
              <input
                id="descriptors"
                value={descriptors}
                onChange={(e) => setDescriptors(e.target.value)}
                placeholder="e.g. pet care, pets item"
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
              <p className="text-xs text-text-muted">
                Swaps the template&apos;s descriptor word
                {template?.brandDescriptor ? ` ("${template.brandDescriptor}")` : ""} for yours, e.g.
                &quot;[Tabs chocolate coupon code]&quot; → &quot;[FurLife pet care coupon code]&quot;.{" "}
                <strong>Leave empty to remove that word entirely.</strong> For {template?.name ?? "the source store"} itself,
                type &quot;{template?.brandDescriptor || "the descriptor"}&quot; here to keep it.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="removeOtherMonths" className="flex items-center gap-2 text-sm font-medium">
                <input
                  id="removeOtherMonths"
                  type="checkbox"
                  checked={removeOtherMonths}
                  onChange={(e) => setRemoveOtherMonths(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                Remove other-month keywords (keep {titleCase(CURRENT_MONTH)} only)
              </label>
              <p className="text-xs text-text-muted">
                Drops keywords naming a different month (e.g. an August term in a {titleCase(CURRENT_MONTH)} campaign).
                Uncheck to keep every keyword, all months included.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="campaignLimit" className="text-sm font-medium">
                  Keywords per campaign
                </label>
                <input
                  id="campaignLimit"
                  type="number"
                  min={MIN_CAMPAIGN_LIMIT}
                  value={campaignLimit}
                  onChange={(e) =>
                    setCampaignLimit(Math.max(MIN_CAMPAIGN_LIMIT, Number(e.target.value) || MIN_CAMPAIGN_LIMIT))
                  }
                  className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                />
                <p className="text-xs text-text-muted">
                  The list is split into campaigns of this size, best keywords first.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="chunkSize" className="text-sm font-medium">
                  Keywords per copy
                </label>
                <input
                  id="chunkSize"
                  type="number"
                  min={1}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value) || 1))}
                  className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                />
                <p className="text-xs text-text-muted">
                  How many lines each copy button puts on the clipboard.
                </p>
              </div>
            </div>

            <RegionPicker
              regions={regions}
              languagesByCountry={languagesByCountry}
              localeNames={localeNames}
              onChange={setRegions}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Include keyword tiers</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEnabledTiers(new Set(KEYWORD_TIERS.map((t) => t.tier)))}
                    className="text-xs font-medium text-brand-primary hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnabledTiers(new Set())}
                    className="text-xs font-medium text-brand-primary hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {KEYWORD_TIERS.map((tier) => {
                  const checked = enabledTiers.has(tier.tier);
                  return (
                    <label
                      key={tier.tier}
                      title={tier.description}
                      className={`flex items-center gap-1.5 rounded-base border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? "border-brand-primary bg-brand-primary/10"
                          : "border-border bg-surface hover:bg-surface-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTier(tier.tier)}
                        className="h-3.5 w-3.5 rounded border-border text-brand-primary focus:ring-brand-primary"
                      />
                      T{tier.tier} {tier.label}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-text-muted">
                Pick exactly the tiers you want instead of a single cutoff — e.g. keep long tail while dropping
                geography. Hover a tier for what it covers. Small brands never get impressions on geography or
                long-tail terms; for a store with only a few hundred brand searches a month, keeping just T1–T4
                gives a far cleaner list.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="accentVariants" className="flex items-center gap-2 text-sm font-medium">
                <input
                  id="accentVariants"
                  type="checkbox"
                  checked={accentVariants}
                  onChange={(e) => setAccentVariants(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                Accent-free twins
              </label>
              <p className="text-xs text-text-muted">
                Adds &quot;codigo&quot; beside &quot;código&quot;. Catches searchers who skip accents, but it is a
                third of the French list — turn off and compare if Google reports them as duplicates.
              </p>
            </div>

            {template && (
              <p className="text-xs text-text-muted">
                Base brand word replaced: &quot;{template.brandName}&quot;
                {template.brandDescriptor && (
                  <> · descriptor word swapped when set: &quot;{template.brandDescriptor}&quot;</>
                )}
              </p>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!template || targetNames.length === 0}
              className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              Generate
            </button>
          </>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {result.length} campaign{result.length === 1 ? "" : "s"}
              <span className="font-normal text-text-muted">
                {" "}
                · {result.reduce((sum, r) => sum + r.keywords.length, 0).toLocaleString()} keywords in total
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setCopied(new Set())}
              disabled={copied.size === 0}
              className="rounded-base border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
            >
              Reset copy progress
            </button>
          </div>

          {result.map((region) => (
            <div key={region.id} className="flex flex-col gap-3">
              <div className="border-b border-border pb-2">
                <h3 className="text-base font-semibold">
                  {region.label}{" "}
                  <span className="font-normal text-text-muted">
                    · {region.languages.map((l) => localeNames.get(l) ?? l).join(" + ")} ·{" "}
                    {region.keywords.length.toLocaleString()} keywords
                    {region.overflowCount > 0 && `, ${region.overflowCount.toLocaleString()} over the cap`}
                    {region.trimmedByTier > 0 &&
                      `, ${region.trimmedByTier.toLocaleString()} excluded by tier filter`}
                  </span>
                </h3>
              </div>

              {region.campaigns.slice(0, 1).map((campaign) => (
                <CampaignPanel
                  key={campaign.index}
                  campaign={campaign}
                  role="primary"
                  total={region.keywords.length}
                  idPrefix={region.id}
                  copied={copied}
                  onCopy={handleCopy}
                />
              ))}

              {region.campaigns.length > 1 && (
                <details className="flex flex-col gap-3">
                  <summary className="cursor-pointer text-sm font-medium text-text-muted hover:text-text">
                    Overflow · {region.overflowCount.toLocaleString()} keywords that did not fit
                  </summary>
                  <p className="mt-2 mb-3 text-xs text-text-muted">
                    Ranked below everything above — mostly geography and long tail. You run one campaign per region,
                    so these show what you are leaving out rather than being extra campaigns to paste.
                  </p>
                  <div className="flex flex-col gap-3">
                    {region.campaigns.slice(1).map((campaign) => (
                      <CampaignPanel
                        key={campaign.index}
                        campaign={campaign}
                        role="overflow"
                        total={region.keywords.length}
                        idPrefix={region.id}
                        copied={copied}
                        onCopy={handleCopy}
                      />
                    ))}
                  </div>
                </details>
              )}

              <NegativePanel
                keywords={region.negatives}
                chunks={region.negativeChunks}
                shortened={region.negativesShortened}
                dropped={region.negativesDropped}
                idPrefix={region.id}
                copied={copied}
                onCopy={handleCopy}
              />
            </div>
          ))}
        </div>
      )}

      {result && primaryName && (
        <AdCopyPanel
          storeName={primaryName}
          storeSlug={selectedStore?.slug}
          descriptors={descriptorList}
          keywords={result.find((r) => r.englishKeywords.length > 0)?.englishKeywords ?? []}
          brandName={template?.brandName ?? ""}
          brandDescriptor={template?.brandDescriptor ?? ""}
          keywordsByLanguage={keywordsByLanguage}
          localeNames={localeNames}
        />
      )}
    </div>
  );
}

function AdLineList({ label, lines, maxChars }: { label: string; lines: string[]; maxChars: number }) {
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [trackedLines, setTrackedLines] = useState(lines);

  // Adjust state during render (React's recommended alternative to an effect
  // here) so the "Copied!" marker clears the moment the list itself changes.
  if (lines !== trackedLines) {
    setTrackedLines(lines);
    setCopiedIndex(null);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyLine(line: string, index: number) {
    await navigator.clipboard.writeText(line);
    setCopiedIndex(index);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {label} <span className="text-text-muted">({lines.length})</span>
        </h3>
        <button
          type="button"
          onClick={handleCopy}
          disabled={lines.length === 0}
          className="rounded-base bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {copied ? "Copied!" : "Copy all"}
        </button>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-base border border-border bg-surface">
        {lines.map((line, index) => (
          <li key={line} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-sm">{line}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`font-mono text-xs ${line.length > maxChars ? "text-brand-secondary" : "text-text-muted"}`}
              >
                {line.length}/{maxChars}
              </span>
              <button
                type="button"
                onClick={() => handleCopyLine(line, index)}
                className="rounded-base border border-border px-2 py-1 text-xs font-medium hover:bg-surface-muted"
              >
                {copiedIndex === index ? "Copied!" : "Copy"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KEYWORD_STOPWORDS = new Set(["a", "an", "the", "for", "of", "in", "on", "at", "to", "with", "and"]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True if ≥60% of a keyword's significant words already appear somewhere in the given text. */
function isKeywordCovered(keyword: string, haystack: Set<string>): boolean {
  const words = normalizeWords(keyword).filter((w) => !KEYWORD_STOPWORDS.has(w));
  if (words.length === 0) return true;
  const matched = words.filter((w) => haystack.has(w)).length;
  return matched / words.length >= 0.6;
}

function AdCopyPanel({
  storeName,
  storeSlug,
  descriptors,
  keywords,
  brandName,
  brandDescriptor,
  keywordsByLanguage,
  localeNames,
}: {
  storeName: string;
  storeSlug?: string;
  descriptors: string[];
  keywords: string[];
  brandName: string;
  brandDescriptor: string;
  /** Generated keywords grouped by locale code — lets sitelink copy match a non-English language. */
  keywordsByLanguage: Record<string, string[]>;
  localeNames: Map<string, string>;
}) {
  const [bestOffer, setBestOffer] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [popularKeywordsText, setPopularKeywordsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adCopy, setAdCopy] = useState<{ headlines: string[]; descriptions: string[] } | null>(null);

  // A varied sample of the generated list. Taking the first N instead would
  // send one idea spelled fifteen ways — the list opens with "coupon code",
  // "coupon codes", "coupon", "coupons", … before it reaches a second concept.
  const topKeywords = useMemo(() => pickSampleKeywords(keywords, 15, storeName), [keywords, storeName]);

  // Google Ads' "popular keywords from this ad group" list, pasted by the user.
  // These usually arrive in the base template's brand form (e.g. "tabs …"), so
  // we map them onto the selected store before sending, then strip match syntax.
  const popularKeywords = useMemo(() => {
    const lines = popularKeywordsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    return generateStoreKeywords(lines, brandName, [storeName], { brandDescriptor, descriptors })
      .map(stripMatchType)
      .filter(Boolean)
      // .slice(0, 30);
  }, [popularKeywordsText, brandName, brandDescriptor, descriptors, storeName]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName, descriptors, topKeywords, popularKeywords, bestOffer, extraNotes }),
      });
      const data = (await res.json()) as { headlines?: string[]; descriptions?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Ad copy generation failed.");
      setAdCopy({ headlines: data.headlines ?? [], descriptions: data.descriptions ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ad copy generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-base border border-border bg-surface p-4">
      <div>
        <h2 className="text-lg font-semibold">Ad copy for {storeName}</h2>
        <p className="text-sm text-text-muted">
          AI-generated Google Ads headlines (max 30 chars) and descriptions (max 90 chars), built for Excellent Ad
          Strength. Paste Google&apos;s popular keywords below to prioritize them, or leave empty to use the top
          keywords generated above.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="bestOffer" className="text-sm font-medium">
            Best current offer <span className="text-text-muted">(optional but recommended)</span>
          </label>
          <input
            id="bestOffer"
            value={bestOffer}
            onChange={(e) => setBestOffer(e.target.value)}
            placeholder="e.g. 50% off, Free shipping over $40"
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
          <p className="text-xs text-text-muted">
            Used as the concrete discount in offer-led headlines. Left empty, the copy stays offer-neutral.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="extraNotes" className="text-sm font-medium">
            Extra instructions <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="extraNotes"
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="e.g. emphasize free shipping, avoid the word cheap"
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="popularKeywords" className="text-sm font-medium">
          Popular keywords from Google Ads <span className="text-text-muted">(optional, one per line)</span>
        </label>
        <textarea
          id="popularKeywords"
          value={popularKeywordsText}
          onChange={(e) => setPopularKeywordsText(e.target.value)}
          rows={5}
          placeholder={"Paste Google's “Headlines that include top keywords” list, e.g.\n[tabs promo code]\n[tabs chocolate discount code]\n[tabs deals san francisco]"}
          className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-xs focus:border-brand-primary focus:outline-none"
        />
        <p className="text-xs text-text-muted">
          {popularKeywords.length > 0
            ? `${popularKeywords.length} popular keyword${popularKeywords.length === 1 ? "" : "s"} will be prioritized (mapped to ${storeName}).`
            : `Google shows these under "Improve Ad Strength" in your ad group. When empty, the top keywords generated above are used instead.`}
        </p>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {loading ? "Generating…" : adCopy ? "Regenerate ad copy" : "Generate ad copy"}
      </button>

      {error && <p className="text-sm text-brand-secondary">{error}</p>}

      {adCopy && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdLineList label="Headlines" lines={adCopy.headlines} maxChars={30} />
          <AdLineList label="Descriptions" lines={adCopy.descriptions} maxChars={90} />
        </div>
      )}

      {adCopy && storeSlug && (
        <SiteLinkPanel
          storeName={storeName}
          storeSlug={storeSlug}
          bestOffer={bestOffer}
          keywordPool={[...topKeywords, ...popularKeywords]}
          adCopy={adCopy}
          keywordsByLanguage={keywordsByLanguage}
          localeNames={localeNames}
        />
      )}
    </div>
  );
}

const SITE_LINK_PAGES: { key: string; label: string }[] = [
  { key: "todays-deals", label: "Today's Best Deals" },
  { key: "free-shipping-codes", label: "Free Shipping Codes" },
  { key: "secret-codes", label: "Secret Codes" },
  { key: "exclusive-deals", label: "Exclusive Deals" },
  { key: "never-pay-full", label: "Never Pay Full Price" },
  { key: "exclusive-offers", label: "Exclusive Offers" },
];

function SiteLinkPanel({
  storeName,
  storeSlug,
  bestOffer,
  keywordPool,
  adCopy,
  keywordsByLanguage,
  localeNames,
}: {
  storeName: string;
  storeSlug: string;
  bestOffer: string;
  keywordPool: string[];
  adCopy: { headlines: string[]; descriptions: string[] };
  /** Generated keywords grouped by locale code, so sitelinks can be written in that language. */
  keywordsByLanguage: Record<string, string[]>;
  localeNames: Map<string, string>;
}) {
  const [extraNotes, setExtraNotes] = useState("");
  const [language, setLanguage] = useState(ENGLISH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteLinks, setSiteLinks] = useState<Record<
    string,
    { text: string; description1: string; description2: string }
  > | null>(null);

  // Every language actually generated for this store, English first.
  const languageOptions = useMemo(() => {
    const codes = Object.keys(keywordsByLanguage).filter((code) => keywordsByLanguage[code]?.length > 0);
    return [ENGLISH, ...codes.filter((code) => code !== ENGLISH)];
  }, [keywordsByLanguage]);

  const isEnglish = language === ENGLISH;

  // Prefer keywords the main ad's headlines/descriptions didn't already cover,
  // so the sitelinks pick up different search terms instead of repeating them.
  // The main ad copy is always written in English, so that comparison only
  // makes sense when generating the English sitelinks too — for any other
  // language, use that language's own keyword pool untouched.
  const { preferredKeywords, alreadyUsedKeywords } = useMemo(() => {
    if (!isEnglish) {
      const pool = [...new Set(keywordsByLanguage[language] ?? [])].slice(0, 20);
      return { preferredKeywords: pool, alreadyUsedKeywords: [] as string[] };
    }
    const pool = [...new Set(keywordPool)];
    const haystack = new Set(normalizeWords([...adCopy.headlines, ...adCopy.descriptions].join(" ")));
    const unused: string[] = [];
    const used: string[] = [];
    for (const k of pool) (isKeywordCovered(k, haystack) ? used : unused).push(k);
    return {
      preferredKeywords: unused.length > 0 ? unused : pool,
      alreadyUsedKeywords: used,
    };
  }, [keywordPool, adCopy, isEnglish, keywordsByLanguage, language]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-site-link-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          preferredKeywords,
          alreadyUsedKeywords,
          bestOffer,
          extraNotes,
          language: isEnglish ? undefined : localeNames.get(language) ?? language,
        }),
      });
      const data = (await res.json()) as Record<string, { text: string; description1: string; description2: string }> & {
        error?: string;
      };
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Sitelink copy generation failed.");
      setSiteLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sitelink copy generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-base border border-border bg-surface p-4">
      <div>
        <h2 className="text-lg font-semibold">Sitelink copy for {storeName}</h2>
        <p className="text-sm text-text-muted">
          Text (≤25 chars) and two description lines (≤35 chars each) for each of the 6 fixed sitelink pages, using{" "}
          {isEnglish && preferredKeywords.length > 0
            ? "keywords the main ad didn't already cover"
            : isEnglish
              ? "the same keyword pool as the main ad"
              : `the ${localeNames.get(language) ?? language} keywords generated above`}
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="siteLinkLanguage" className="text-sm font-medium">
            Language
          </label>
          <select
            id="siteLinkLanguage"
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setSiteLinks(null);
            }}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            {languageOptions.map((code) => (
              <option key={code} value={code}>
                {code === ENGLISH ? "English" : (localeNames.get(code) ?? code.toUpperCase())}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-muted">
            Writes the sitelink text and descriptions in this language. Only languages generated above are offered.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="siteLinkExtraNotes" className="text-sm font-medium">
            Extra instructions <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="siteLinkExtraNotes"
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="e.g. emphasize free shipping, avoid the word cheap"
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {loading ? "Generating…" : siteLinks ? "Regenerate sitelink copy" : "Generate sitelink copy"}
      </button>

      {error && <p className="text-sm text-brand-secondary">{error}</p>}

      {siteLinks && (
        <div className="grid gap-4 sm:grid-cols-2">
          {SITE_LINK_PAGES.map((page) => {
            const link = siteLinks[page.key];
            if (!link) return null;
            const url = `https://monocoupon.com/${page.key}/${storeSlug}`;
            const block = `${link.text}\n${link.description1}\n${link.description2}\n${url}`;
            return <SiteLinkCard key={page.key} label={page.label} link={link} url={url} block={block} />;
          })}
        </div>
      )}
    </div>
  );
}

function SiteLinkCard({
  label,
  link,
  url,
  block,
}: {
  label: string;
  link: { text: string; description1: string; description2: string };
  url: string;
  block: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopyAll() {
    await navigator.clipboard.writeText(block);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-base border border-border bg-surface-muted p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{label}</h4>
        <button
          type="button"
          onClick={handleCopyAll}
          className="rounded-base border border-border px-2 py-1 text-xs font-medium hover:bg-surface"
        >
          {copied ? "Copied!" : "Copy all 4 lines"}
        </button>
      </div>
      <SiteLinkField value={link.text} maxChars={25} />
      <SiteLinkField value={link.description1} maxChars={35} />
      <SiteLinkField value={link.description2} maxChars={35} />
      <SiteLinkUrlField url={url} />
    </div>
  );
}

function SiteLinkUrlField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-base bg-surface px-2 py-1.5">
      <span className="truncate text-xs text-text-muted" title={url}>
        {url}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 text-xs font-medium text-brand-primary hover:underline"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function SiteLinkField({ value, maxChars }: { value: string; maxChars: number }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-base bg-surface px-2 py-1.5">
      <span className="text-sm">{value}</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`font-mono text-xs ${value.length > maxChars ? "text-brand-secondary" : "text-text-muted"}`}>
          {value.length}/{maxChars}
        </span>
        <button type="button" onClick={handleCopy} className="text-xs font-medium text-brand-primary hover:underline">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
