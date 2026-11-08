import dotenv from "dotenv";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { connectToDatabase } from "./connect";
import { KeywordTemplate } from "./models/index";

// Loaded relative to this file so the script works regardless of the cwd it's invoked from.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

const NAME = process.argv[2] ?? "Tabs";
const SLUG = (process.argv[3] ?? NAME).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const BRAND_TOKENS = (process.argv[4] ?? "tabs.co,tabs company,tabs chocolate,tabs co,tabs")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);
const KEYWORDS_FILE = process.argv[5] ?? path.join(REPO_ROOT, "keyword-research", "keywords.txt");
const NEGATIVE_FILE = process.argv[6] ?? path.join(REPO_ROOT, "keyword-research", "negative-keywords.txt");
// The base brand word swapped for the target store name. Defaults to the
// shortest brand token (e.g. "tabs"), which is the bare store name.
const BRAND_NAME = (process.argv[7] ?? BRAND_TOKENS[BRAND_TOKENS.length - 1] ?? "").trim().toLowerCase();
// The template's own descriptor word (e.g. "chocolate") swapped for a store
// descriptor at generation time. Optional — leave empty if the list has none.
const BRAND_DESCRIPTOR = (process.argv[8] ?? "").trim().toLowerCase();

function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function run() {
  const [keywordsText, negativeText] = await Promise.all([
    readFile(KEYWORDS_FILE, "utf8"),
    readFile(NEGATIVE_FILE, "utf8"),
  ]);

  const keywords = linesOf(keywordsText);
  const negativeKeywords = linesOf(negativeText);

  await connectToDatabase();

  const template = await KeywordTemplate.findOneAndUpdate(
    { slug: SLUG },
    {
      name: NAME,
      slug: SLUG,
      brandTokens: BRAND_TOKENS,
      brandName: BRAND_NAME,
      brandDescriptor: BRAND_DESCRIPTOR,
      keywords,
      negativeKeywords,
    },
    { upsert: true, new: true }
  );

  console.log(`Imported keyword template "${template.name}" (${template.slug})`);
  console.log(`  Brand tokens: ${BRAND_TOKENS.join(", ")}`);
  console.log(`  Brand name: ${BRAND_NAME}${BRAND_DESCRIPTOR ? `, descriptor: ${BRAND_DESCRIPTOR}` : ""}`);
  console.log(`  Keywords: ${keywords.length}, Negative keywords: ${negativeKeywords.length}`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
