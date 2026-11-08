import dotenv from "dotenv";
import path from "node:path";
import {
  classifyKeyword,
  compoundSplits,
  expandPack,
  generateLocaleKeywordRecords,
  generateLocaleNegativeRecords,
  generateStoreKeywordRecords,
  orderKeywords,
  stripMatchType,
  summarizeRanking,
  wordCount,
  type Lexicon,
  type LocalePack,
  type MatchType,
} from "@monocoupon/keywords";
import { connectToDatabase } from "./connect";
import { KeywordLocale, KeywordTemplate } from "./models/index";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

const CURRENT_MONTH = new Date().toLocaleString("en-US", { month: "long" }).toLowerCase();

function flag(name: string): string | null {
  const argv = process.argv.slice(2);
  const match = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!match) return null;
  return match.includes("=") ? match.slice(match.indexOf("=") + 1) : "";
}

function list(name: string): string[] {
  const value = flag(name);
  return value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
}

function pct(part: number, total: number): string {
  return total === 0 ? "0.0%" : `${((part / total) * 100).toFixed(1)}%`;
}

async function run() {
  const codes = list("locales");
  if (codes.length === 0) throw new Error('Pass --locales=de or --locales=de,fr');

  const storeName = flag("store") || "Tabs";
  const variants = list("variants");
  const descriptors = list("descriptors");
  const showTop = Number(flag("show-top") || 30);
  const matchType = (flag("match") || "exact") as MatchType;
  const keepAllMonths = flag("all-months") !== null;

  const targetNames = [storeName, ...variants];

  await connectToDatabase();
  const packs: LocalePack[] = [];
  for (const code of codes) {
    const found = await KeywordLocale.findOne({ code: code.toLowerCase() }).lean();
    if (!found) throw new Error(`No locale pack "${code}" — run pnpm db:import-locales`);
    packs.push(found as unknown as LocalePack);
  }

  console.log(`\nStore:       ${targetNames.join(" | ")}`);
  console.log(`Descriptors: ${descriptors.length > 0 ? descriptors.join(" | ") : "(none)"}`);
  console.log(`Locales:     ${packs.map((p) => `${p.language} (${p.code})`).join(", ")}`);
  console.log(`Month:       ${keepAllMonths ? "no month slot" : CURRENT_MONTH}`);
  console.log(`Match type:  ${matchType}`);

  const allRecords = [];
  const lexicons: Record<string, Lexicon> = {};

  for (const pack of packs) {
    // Classify against the expanded pack, so compound splits the generator
    // emits ("aktions code") are vocabulary the lexicon knows.
    const lexicon = expandPack(pack);
    lexicons[pack.code] = lexicon;

    const start = Date.now();
    const records = generateLocaleKeywordRecords(pack, targetNames, {
      descriptors,
      campaignMonth: keepAllMonths ? "" : CURRENT_MONTH,
      matchType,
    });
    const ms = Date.now() - start;
    allRecords.push(...records);

    // Accent twins double whatever they touch, so their cost should be visible.
    const withoutAccents = generateLocaleKeywordRecords(pack, targetNames, {
      descriptors,
      campaignMonth: keepAllMonths ? "" : CURRENT_MONTH,
      matchType,
      accentVariants: false,
    });

    const negatives = generateLocaleNegativeRecords(pack, targetNames, { matchType });
    const splits = pack.compoundForms ? compoundSplits(pack.intentTerms) : [];

    const accentTwins = records.length - withoutAccents.length;

    console.log(`\n── ${pack.language} (${pack.code}) ──`);
    console.log(`  keywords:  ${records.length.toLocaleString()} in ${ms}ms`);
    console.log(`  negatives: ${negatives.length.toLocaleString()}`);
    if (accentTwins > 0) {
      console.log(
        `  accent twins: ${accentTwins.toLocaleString()} (${pct(accentTwins, records.length)}) — set stripAccents:false to drop`
      );
    }
    if (splits.length > 0) console.log(`  compound splits: ${splits.slice(0, 8).join(", ")}${splits.length > 8 ? ` … +${splits.length - 8}` : ""}`);

    // Google rejects >10 words, and duplicates waste the campaign ceiling.
    const overLong = records.filter((r) => wordCount(stripMatchType(r.keyword)) > 10);
    const keys = records.map((r) => r.keyword.toLowerCase());
    const duplicates = keys.length - new Set(keys).size;
    const empty = records.filter((r) => !stripMatchType(r.keyword).trim());
    console.log(`  over 10 words: ${overLong.length}   duplicates: ${duplicates}   empty: ${empty.length}`);

    // Anything the pack's own lexicon cannot read is a vocabulary gap.
    const unknown = records.filter(
      (r) => classifyKeyword(r.keyword, { lexicon, brandTokens: targetNames, descriptorTokens: descriptors })
        .features.unknownTokens.length > 0
    );
    console.log(`  unrecognised by its own lexicon: ${unknown.length} (${pct(unknown.length, records.length)})`);
    for (const record of unknown.slice(0, 3)) console.log(`    ${record.keyword}`);
  }

  // Mirrors what a "Germany: German + English" region does in the admin: the
  // English template and the locale packs feed one ranking pass, each keyword
  // classified against its own language's lexicon.
  const withEnglish = flag("with-english");
  const localeOrder = [...codes];
  if (withEnglish !== null) {
    const slug = withEnglish || "tabs";
    const template = await KeywordTemplate.findOne({ slug }).lean();
    if (!template) throw new Error(`No keyword template "${slug}"`);
    const english = generateStoreKeywordRecords(
      template.keywords ?? [],
      template.brandName || "tabs",
      targetNames,
      {
        brandDescriptor: template.brandDescriptor ?? "",
        descriptors,
        campaignMonth: keepAllMonths ? "" : CURRENT_MONTH,
        locale: "en",
      }
    );
    allRecords.push(...english);
    localeOrder.push("en");
    console.log(`\n── English (en) via template "${slug}" ──`);
    console.log(`  keywords:  ${english.length.toLocaleString()}`);
  }

  const ranked = orderKeywords(allRecords, { localeOrder, lexicons });
  const summary = summarizeRanking(ranked);

  console.log(`\nRanked ${ranked.length.toLocaleString()} keywords across ${summary.groups.length} group(s)`);
  console.log("\nTier order");
  for (const tier of summary.tiers) {
    console.log(
      `  ${tier.tier}  ${tier.label.padEnd(18)} ${String(tier.count).padStart(6)}  ${pct(tier.count, summary.total).padStart(6)}` +
        `   first at #${tier.firstPosition || "-"}`
    );
  }

  if (showTop > 0) {
    console.log(`\nFirst ${showTop}`);
    for (const record of ranked.slice(0, showTop)) {
      console.log(`  ${String(record.position).padStart(4)}  T${record.tier}  ${record.locale}  ${record.keyword}`);
    }
  }

  // Evenly spaced across the whole ranked list, so one read covers every tier
  // rather than fifty phrasings of the top term.
  const sample = Number(flag("sample") || 0);
  if (sample > 0) {
    console.log(`\nSample of ${sample} spread across all ${ranked.length.toLocaleString()} keywords`);
    const step = Math.max(1, Math.floor(ranked.length / sample));
    for (let i = 0; i < ranked.length && i / step < sample; i += step) {
      const record = ranked[i];
      console.log(`  ${String(record.position).padStart(6)}  T${record.tier}  ${record.locale}  ${record.keyword}`);
    }
  }

  console.log("\nFirst position per locale");
  for (const code of codes) {
    const first = ranked.find((r) => r.locale === code);
    const count = ranked.filter((r) => r.locale === code).length;
    console.log(`  ${code}: first #${first?.position ?? "-"}   total ${count.toLocaleString()}`);
  }

  console.log("");
  process.exit(0);
}

run().catch((err) => {
  console.error(`\nLocale generation failed: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
