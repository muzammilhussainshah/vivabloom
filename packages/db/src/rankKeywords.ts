import dotenv from "dotenv";
import path from "node:path";
import {
  KEYWORD_TIERS,
  batchKeywords,
  generateNegativeKeywordRecords,
  generateStoreKeywordRecords,
  generateStoreKeywords,
  orderKeywords,
  summarizeRanking,
} from "@monocoupon/keywords";
import { connectToDatabase } from "./connect";
import { KeywordTemplate } from "./models/index";

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
  const slug = flag("slug") || "tabs";
  const storeName = flag("store") || "Tabs";
  const descriptors = list("descriptors");
  const variants = list("variants");
  const showTop = Number(flag("show-top") || 40);
  const campaignLimit = Number(flag("campaign-limit") || 20_000);
  const chunkSize = Number(flag("chunk-size") || 10_000);
  const keepAllMonths = flag("all-months") !== null;

  await connectToDatabase();
  const template = await KeywordTemplate.findOne({ slug }).lean();
  if (!template) throw new Error(`No keyword template with slug "${slug}"`);

  const brandName = template.brandName || "tabs";
  const options = {
    brandDescriptor: template.brandDescriptor ?? "",
    descriptors,
    campaignMonth: keepAllMonths ? "" : CURRENT_MONTH,
  };
  const targetNames = [storeName, ...variants];

  console.log(`\nTemplate:    ${template.name} (${template.keywords?.length ?? 0} source keywords)`);
  console.log(`Store:       ${targetNames.join(" | ")}`);
  console.log(`Descriptors: ${descriptors.length > 0 ? descriptors.join(" | ") : "(none — descriptor word removed)"}`);
  console.log(`Month:       ${keepAllMonths ? "all months kept" : CURRENT_MONTH}`);

  const startGenerate = Date.now();
  const baseRecords = generateStoreKeywordRecords(template.keywords ?? [], brandName, targetNames, options);
  const generateMs = Date.now() - startGenerate;

  // The refactor must not change what the old plain-text path produced.
  const legacy = generateStoreKeywords(template.keywords ?? [], brandName, targetNames, options);
  const identical =
    legacy.length === baseRecords.length && legacy.every((k, i) => k === baseRecords[i].keyword);

  // Locale packs don't exist yet, so this re-tags the same records under extra
  // language codes. The text is nonsense as German, but the interleave being
  // proven here is language-agnostic — it is the mechanism the locale work will
  // depend on, so it is worth failing fast now rather than in Step 4.
  const simulated = list("simulate-locales");
  const records =
    simulated.length > 0
      ? simulated.flatMap((locale) => baseRecords.map((r) => ({ ...r, locale })))
      : baseRecords;
  if (simulated.length > 0) {
    console.log(`\nSimulating locales: ${simulated.join(", ")} (record text is English; interleave only)`);
  }

  const startRank = Date.now();
  const ranked = orderKeywords(records);
  const rankMs = Date.now() - startRank;

  // Negatives: no ranking, no cap, no month filter — but they do get shortened
  // rather than dropped when a long store name runs them past 10 words.
  const negatives = generateNegativeKeywordRecords(template.negativeKeywords ?? [], brandName, targetNames, {
    brandDescriptor: template.brandDescriptor ?? "",
    descriptors,
  });
  // The old behaviour, for comparison: negatives went through the positive
  // path, so an over-long substitution was thrown away instead of shortened.
  const negativesOldWay = generateStoreKeywordRecords(template.negativeKeywords ?? [], brandName, targetNames, {
    brandDescriptor: template.brandDescriptor ?? "",
    descriptors,
  });

  // A source line is only genuinely lost if none of the text it would produce
  // survives anywhere in the final list. Counting unique sourceIndexes instead
  // would score a line as lost whenever dedupe merged it onto an earlier one,
  // which is a merge, not a loss.
  const negLines = template.negativeKeywords ?? [];
  const negOptions = { brandDescriptor: template.brandDescriptor ?? "", descriptors };
  const lostAgainst = (final: Set<string>, shorten: boolean) =>
    negLines.filter((line) => {
      const solo = shorten
        ? generateNegativeKeywordRecords([line], brandName, targetNames, negOptions).records
        : generateStoreKeywordRecords([line], brandName, targetNames, negOptions);
      return solo.length === 0 || !solo.some((r) => final.has(r.keyword.toLowerCase()));
    }).length;

  const lostNow = lostAgainst(new Set(negatives.records.map((r) => r.keyword.toLowerCase())), true);
  const lostBefore = lostAgainst(new Set(negativesOldWay.map((r) => r.keyword.toLowerCase())), false);

  console.log(`\nNegatives:   ${negatives.records.length.toLocaleString()} generated from ${negLines.length} source lines`);
  console.log(`  source lines with no protection left:  ${lostBefore} before  →  ${lostNow} now`);
  console.log(`  shortened and kept: ${negatives.shortened}`);
  const examples = negatives.records.filter((r) => r.shortened).slice(0, 3);
  for (const example of examples) {
    console.log(`  shortened (${example.shortened} dropped): ${example.keyword}`);
  }

  const summary = summarizeRanking(ranked);

  console.log(`\nGenerated:   ${records.length.toLocaleString()} keywords in ${generateMs}ms`);
  console.log(`Ranked:      ${ranked.length.toLocaleString()} keywords in ${rankMs}ms`);
  console.log(`Parity:      ${identical ? "OK — same output as the pre-refactor generator" : "MISMATCH"}`);
  if (ranked.length !== records.length) console.log(`  WARNING: ranking changed the count (${records.length} → ${ranked.length})`);

  console.log("\nTier order");
  for (const tier of summary.tiers) {
    console.log(
      `  ${tier.tier}  ${tier.label.padEnd(18)} ${String(tier.count).padStart(6)}  ${pct(tier.count, summary.total).padStart(6)}` +
        `   first at #${tier.firstPosition || "-"}`
    );
  }

  console.log("\nGroups (locale | name variant | descriptor)");
  for (const group of summary.groups) {
    console.log(
      `  ${group.locale.padEnd(4)} ${group.nameVariant.padEnd(16)} ${(group.descriptor || "(none)").padEnd(16)} ${String(group.count).padStart(6)}`
    );
  }

  // The point of the whole exercise: what the first campaign would have held
  // under the old file-order output versus what it holds now. Anything the
  // "before" column loses is a keyword that silently fell off the end.
  if (ranked.length > campaignLimit) {
    const tierOf = new Map(ranked.map((r) => [r.keyword, r.tier]));
    const beforeCounts = new Map<number, number>();
    for (const record of records.slice(0, campaignLimit)) {
      const tier = tierOf.get(record.keyword) ?? 8;
      beforeCounts.set(tier, (beforeCounts.get(tier) ?? 0) + 1);
    }

    console.log(`\nWhat lands in campaign 1 (first ${campaignLimit.toLocaleString()})`);
    console.log(`  tier                     before    after     kept`);
    for (const { tier, label } of KEYWORD_TIERS) {
      const before = beforeCounts.get(tier) ?? 0;
      const after = ranked.slice(0, campaignLimit).filter((r) => r.tier === tier).length;
      const total = summary.tiers.find((t) => t.tier === tier)?.count ?? 0;
      console.log(
        `  ${tier} ${label.padEnd(18)} ${String(before).padStart(8)} ${String(after).padStart(8)}` +
          `   ${pct(after, total).padStart(6)} of all ${total.toLocaleString()}`
      );
    }
  }

  const campaigns = batchKeywords(ranked, { campaignLimit, chunkSize });
  console.log(`\nCampaigns of ${campaignLimit.toLocaleString()}, copy chunks of ${chunkSize.toLocaleString()}`);
  for (const campaign of campaigns) {
    const chunkLabel = campaign.chunks.map((c) => `${c.from}–${c.to}`).join(", ");
    console.log(`  Campaign ${campaign.index}: ${campaign.from}–${campaign.to}   chunks: ${chunkLabel}`);
  }

  // Chunk integrity: every keyword exactly once, in order, no gaps.
  const flat = campaigns.flatMap((c) => c.chunks.flatMap((chunk) => chunk.keywords));
  const contiguous = flat.length === ranked.length && flat.every((k, i) => k === ranked[i].keyword);
  console.log(`  Coverage: ${contiguous ? "OK — chunks reassemble the full ordered list exactly" : "BROKEN"}`);

  if (showTop > 0) {
    console.log(`\nFirst ${showTop} keywords`);
    for (const record of ranked.slice(0, showTop)) {
      console.log(
        `  ${String(record.position).padStart(4)}  T${record.tier}  ${record.locale}  ${record.keyword}`
      );
    }
  }

  // Where does each group's tier-1 block land? If a group's first keyword sits
  // thousands of positions deep, the interleave is not doing its job.
  console.log("\nFirst position per group");
  for (const group of summary.groups) {
    const first = ranked.find((r) => r.groupKey === group.groupKey);
    const firstTier1 = ranked.find((r) => r.groupKey === group.groupKey && r.tier === 1);
    console.log(
      `  ${group.locale} | ${group.nameVariant} | ${group.descriptor || "(none)"}` +
        `   first #${first?.position ?? "-"}   first tier-1 #${firstTier1?.position ?? "-"}`
    );
  }

  const tierNames = new Map(KEYWORD_TIERS.map((t) => [t.tier, t.label]));
  const lastTier = ranked[ranked.length - 1];
  console.log(`\nLast keyword: #${lastTier?.position} T${lastTier?.tier} (${tierNames.get(lastTier?.tier ?? 8)})  ${lastTier?.keyword}\n`);

  process.exit(0);
}

run().catch((err) => {
  console.error("\nRanking failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
