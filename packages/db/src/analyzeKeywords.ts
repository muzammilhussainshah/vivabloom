import dotenv from "dotenv";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { classifyKeyword, KEYWORD_TIERS, type KeywordTier, type Lexicon } from "@monocoupon/keywords";
import { connectToDatabase } from "./connect";
import { KeywordLocale, KeywordTemplate } from "./models/index";

// Loaded relative to this file so the script works regardless of the cwd it's invoked from.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

interface Args {
  slug: string;
  file: string | null;
  negatives: boolean;
  showUnknown: number;
  showTier: number | null;
  showNoIntent: number;
  /** Overrides the brand phrases stripped before classifying, comma-separated. */
  brand: string[] | null;
  /** Classify against this language's pack instead of the built-in English one. */
  locale: string | null;
}

function parseArgs(argv: string[]): Args {
  const flag = (name: string): string | null => {
    const match = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!match) return null;
    return match.includes("=") ? match.slice(match.indexOf("=") + 1) : "";
  };

  const file = flag("file");
  const showUnknown = flag("show-unknown");
  const showTier = flag("show-tier");
  const showNoIntent = flag("show-no-intent");
  const brand = flag("brand");

  return {
    slug: flag("slug") || "tabs",
    // `--file` with no value means "use the checked-in research file".
    file: file === null ? null : file || path.join(REPO_ROOT, "keyword-research", "keywords.txt"),
    negatives: flag("negatives") !== null,
    showUnknown: showUnknown ? Number(showUnknown) : 25,
    showTier: showTier ? Number(showTier) : null,
    showNoIntent: showNoIntent === null ? 0 : Number(showNoIntent) || 30,
    brand: brand ? brand.split(",").map((b) => b.trim()).filter(Boolean) : null,
    locale: flag("locale") || null,
  };
}

function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function pct(part: number, total: number): string {
  return total === 0 ? "0.0%" : `${((part / total) * 100).toFixed(1)}%`;
}

function bar(part: number, total: number, width = 24): string {
  const filled = total === 0 ? 0 : Math.round((part / total) * width);
  return "█".repeat(filled).padEnd(width, "·");
}

interface Source {
  label: string;
  name: string;
  brandName: string;
  brandDescriptor: string;
  keywords: string[];
}

async function loadSource(args: Args): Promise<Source> {
  if (args.file) {
    const file = args.negatives
      ? path.join(REPO_ROOT, "keyword-research", "negative-keywords.txt")
      : args.file;
    const text = await readFile(file, "utf8");
    return {
      label: `file ${path.relative(REPO_ROOT, file)}`,
      name: path.basename(file),
      // The checked-in research files are the Tabs list; these are the values
      // `pnpm db:import-keywords` defaults to.
      brandName: "tabs",
      brandDescriptor: "chocolate",
      keywords: linesOf(text),
    };
  }

  await connectToDatabase();
  const template = await KeywordTemplate.findOne({ slug: args.slug }).lean();
  if (!template) {
    const available = await KeywordTemplate.find({}).select("slug name").lean();
    throw new Error(
      `No keyword template with slug "${args.slug}". Available: ${
        available.map((t) => t.slug).join(", ") || "(none — run pnpm db:import-keywords)"
      }`
    );
  }

  const brandTokens = template.brandTokens ?? [];
  const shortestToken = brandTokens.reduce((a, b) => (b.length < a.length ? b : a), brandTokens[0] ?? "");

  return {
    label: `database template "${template.slug}"`,
    name: template.name,
    brandName: template.brandName || shortestToken,
    brandDescriptor: template.brandDescriptor ?? "",
    keywords: (args.negatives ? template.negativeKeywords : template.keywords) ?? [],
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const source = await loadSource(args);
  const listLabel = args.negatives ? "negative keywords" : "keywords";

  console.log(`\nSource:     ${source.label}`);
  console.log(`Template:   ${source.name}`);
  console.log(`Brand word: "${source.brandName}"${source.brandDescriptor ? `, descriptor "${source.brandDescriptor}"` : ""}`);
  console.log(`${listLabel[0].toUpperCase()}${listLabel.slice(1)}: ${source.keywords.length.toLocaleString()}\n`);

  if (source.keywords.length === 0) {
    console.log("Nothing to analyze.");
    process.exit(0);
  }

  const brandTokens = args.brand ?? (source.brandName ? [source.brandName] : []);
  if (args.brand) console.log(`Brand override: ${brandTokens.join(", ")}\n`);

  let lexicon: Lexicon | undefined;
  if (args.locale) {
    await connectToDatabase();
    const pack = await KeywordLocale.findOne({ code: args.locale.toLowerCase() }).lean();
    if (!pack) {
      const available = await KeywordLocale.find({}).select("code").lean();
      throw new Error(
        `No locale pack "${args.locale}". Available: ${
          available.map((p) => p.code).join(", ") || "(none — run pnpm db:import-locales)"
        }`
      );
    }
    lexicon = pack as unknown as Lexicon;
    console.log(`Lexicon:    ${pack.language} (${pack.code})\n`);
  }

  const context = {
    brandTokens,
    descriptorTokens: source.brandDescriptor ? [source.brandDescriptor] : [],
    lexicon,
  };

  const byTier = new Map<KeywordTier, string[]>();
  const unknownLines: { keyword: string; tokens: string[] }[] = [];
  const unknownTokenCounts = new Map<string, number>();
  const noIntent: string[] = [];
  let overLongCount = 0;

  for (const keyword of source.keywords) {
    const { tier, features } = classifyKeyword(keyword, context);
    const bucket = byTier.get(tier);
    if (bucket) bucket.push(keyword);
    else byTier.set(tier, [keyword]);

    if (features.unknownTokens.length > 0) {
      unknownLines.push({ keyword, tokens: features.unknownTokens });
      for (const token of features.unknownTokens) {
        unknownTokenCounts.set(token, (unknownTokenCounts.get(token) ?? 0) + 1);
      }
    }
    if (features.intent === null) noIntent.push(keyword);
    if (features.words > 10) overLongCount += 1;
  }

  const total = source.keywords.length;

  console.log("Tier histogram");
  for (const tier of KEYWORD_TIERS) {
    const count = byTier.get(tier.tier)?.length ?? 0;
    console.log(
      `  ${tier.tier}  ${tier.label.padEnd(18)} ${String(count).padStart(6)}  ${pct(count, total).padStart(6)}  ${bar(count, total)}`
    );
  }

  const recognised = total - unknownLines.length;
  console.log("\nLexicon coverage");
  console.log(`  fully recognised    ${String(recognised).padStart(6)}  ${pct(recognised, total).padStart(6)}`);
  console.log(`  has unknown words   ${String(unknownLines.length).padStart(6)}  ${pct(unknownLines.length, total).padStart(6)}`);
  console.log(`  no intent term      ${String(noIntent.length).padStart(6)}  ${pct(noIntent.length, total).padStart(6)}`);
  console.log(`  over 10 words       ${String(overLongCount).padStart(6)}  ${pct(overLongCount, total).padStart(6)}   (Google rejects these)`);

  if (unknownTokenCounts.size > 0) {
    // On the negative list "unknown" is the expected result: negatives are made
    // of the vocabulary the lexicon deliberately does not carry (jobs, wiki,
    // ceo). Read this section there as the checklist of words each new locale's
    // negative list has to cover.
    console.log(
      args.negatives
        ? `\nNegative vocabulary (${unknownTokenCounts.size} distinct) — expected to be unknown to the coupon lexicon; this is the list each locale's negatives must translate`
        : `\nUnknown tokens (${unknownTokenCounts.size} distinct) — add these to the lexicon or confirm they are noise`
    );
    const ranked = [...unknownTokenCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [token, count] of ranked.slice(0, 40)) {
      console.log(`  ${String(count).padStart(6)}  ${token}`);
    }
    if (ranked.length > 40) console.log(`  … and ${ranked.length - 40} more`);
  }

  if (unknownLines.length > 0 && args.showUnknown > 0) {
    console.log(`\nUnrecognised lines (first ${Math.min(args.showUnknown, unknownLines.length)} of ${unknownLines.length})`);
    for (const { keyword, tokens } of unknownLines.slice(0, args.showUnknown)) {
      console.log(`  ${keyword}   → ${tokens.join(", ")}`);
    }
  }

  if (noIntent.length > 0 && args.showNoIntent > 0) {
    console.log(`\nLines with no coupon term (first ${Math.min(args.showNoIntent, noIntent.length)} of ${noIntent.length})`);
    for (const line of noIntent.slice(0, args.showNoIntent)) console.log(`  ${line}`);
  }

  if (args.showTier !== null) {
    const lines = byTier.get(args.showTier as KeywordTier) ?? [];
    const tierInfo = KEYWORD_TIERS.find((t) => t.tier === args.showTier);
    console.log(`\nTier ${args.showTier} — ${tierInfo?.label ?? "unknown"} (${lines.length} lines, showing first 60)`);
    console.log(`  ${tierInfo?.description ?? ""}`);
    for (const line of lines.slice(0, 60)) console.log(`  ${line}`);
  }

  console.log("");
  process.exit(0);
}

run().catch((err) => {
  console.error("\nAnalysis failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
