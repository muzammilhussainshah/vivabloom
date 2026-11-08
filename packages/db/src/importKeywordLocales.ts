import dotenv from "dotenv";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import type { LocalePack } from "@monocoupon/keywords";
import { connectToDatabase } from "./connect";
import { KeywordLocale } from "./models/index";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const LOCALES_DIR = path.join(REPO_ROOT, "keyword-research", "locales");

const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Every vocabulary list on a pack, in the order the audit prints them. */
const VOCAB_FIELDS = [
  "intentTerms",
  "offerModifiers",
  "qualifierModifiers",
  "urgencyModifiers",
  "amountModifiers",
  "seasonalModifiers",
  "verticals",
  "geoModifiers",
  "fillerModifiers",
  "paymentModifiers",
  "informationalModifiers",
  "connectors",
] as const;

/** Lists whose terms a negative keyword must never collide with. */
const POSITIVE_FIELDS = ["intentTerms", "offerModifiers", "qualifierModifiers", "seasonalModifiers"] as const;

function flag(name: string): string | null {
  const argv = process.argv.slice(2);
  const match = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!match) return null;
  return match.includes("=") ? match.slice(match.indexOf("=") + 1) : "";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

interface Issue {
  level: "error" | "warning";
  message: string;
}

/**
 * Catches the mistakes that cost money rather than the ones that look untidy.
 * The important one is the collision check: a term that is both an intent word
 * and a negative means the campaign bids on a keyword and blocks it in the same
 * breath, which is silent and expensive.
 */
function validate(pack: LocalePack, file: string): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  if (!pack.code) err("missing 'code'");
  if (!pack.language) err("missing 'language'");
  if (!Array.isArray(pack.countries) || pack.countries.length === 0) err("'countries' is empty");
  if (!Array.isArray(pack.intentTerms) || pack.intentTerms.length === 0) err("'intentTerms' is empty");
  if (!Array.isArray(pack.negativeKeywords) || pack.negativeKeywords.length === 0) err("'negativeKeywords' is empty");
  if (!Array.isArray(pack.patterns) || pack.patterns.length === 0) warn("'patterns' is empty");

  if (path.basename(file, ".json") !== pack.code) {
    err(`filename does not match code "${pack.code}"`);
  }

  const months = pack.months ?? {};
  const missingMonths = MONTH_KEYS.filter((key) => !Array.isArray(months[key]) || months[key].length === 0);
  if (missingMonths.length > 0) err(`months missing: ${missingMonths.join(", ")}`);
  const strayMonths = Object.keys(months).filter((key) => !MONTH_KEYS.includes(key));
  if (strayMonths.length > 0) {
    err(`month keys must be English names; found: ${strayMonths.join(", ")}`);
  }

  for (const field of VOCAB_FIELDS) {
    const list = pack[field];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    for (const term of list) {
      const key = normalize(term);
      if (seen.has(key)) warn(`duplicate in ${field}: "${term}"`);
      seen.add(key);
    }
  }

  const negatives = new Set((pack.negativeKeywords ?? []).map(normalize));
  const reported = new Set<string>();
  for (const field of POSITIVE_FIELDS) {
    for (const term of pack[field] ?? []) {
      const key = normalize(term);
      if (!negatives.has(key) || reported.has(key)) continue;
      reported.add(key);
      err(`"${term}" is in both ${field} and negativeKeywords — the campaign would bid on it and block it`);
    }
  }

  return issues;
}

async function run() {
  const only = flag("only");
  const show = flag("show");
  const terms = flag("terms");
  const field = (flag("field") || "intentTerms") as (typeof VOCAB_FIELDS)[number];

  const files = (await readdir(LOCALES_DIR)).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`No locale packs found in ${LOCALES_DIR}`);

  const packs: LocalePack[] = [];
  let errorCount = 0;

  for (const file of files) {
    const raw = await readFile(path.join(LOCALES_DIR, file), "utf8");
    let pack: LocalePack;
    try {
      pack = JSON.parse(raw) as LocalePack;
    } catch (err) {
      console.error(`  ${file}: invalid JSON — ${err instanceof Error ? err.message : err}`);
      errorCount += 1;
      continue;
    }

    const issues = validate(pack, file);
    for (const issue of issues) {
      console.log(`  ${issue.level === "error" ? "ERROR  " : "warning"} ${pack.code || file}: ${issue.message}`);
      if (issue.level === "error") errorCount += 1;
    }
    if (!only || only === pack.code) packs.push(pack);
  }

  if (errorCount > 0) {
    throw new Error(`${errorCount} error(s) found — nothing was imported.`);
  }

  // Bare list, one term per line, for pasting straight into Keyword Planner.
  // Ranking these lists by guesswork is the weakest part of a locale pack, so
  // making the volume check one command cheaper is worth the flag.
  if (terms) {
    const pack = packs.find((p) => p.code === terms);
    if (!pack) throw new Error(`No pack with code "${terms}"`);
    if (!VOCAB_FIELDS.includes(field)) {
      throw new Error(`Unknown field "${field}". One of: ${VOCAB_FIELDS.join(", ")}`);
    }
    for (const term of pack[field] ?? []) console.log(term);
    process.exit(0);
  }

  if (show) {
    const pack = packs.find((p) => p.code === show);
    if (!pack) throw new Error(`No pack with code "${show}"`);
    console.log(`\n${pack.language} (${pack.code}) — countries: ${pack.countries.join(", ")}`);
    console.log(`accent-stripped twins: ${pack.stripAccents ? "yes" : "no"}   compound forms: ${pack.compoundForms ? "yes" : "no"}`);
    for (const field of VOCAB_FIELDS) {
      const list = pack[field] ?? [];
      if (list.length === 0) continue;
      console.log(`\n${field} (${list.length})`);
      console.log(`  ${list.join(" · ")}`);
    }
    console.log(`\npatterns (${pack.patterns.length})`);
    for (const pattern of pack.patterns) console.log(`  ${pattern}`);
    console.log(`\nnegativeKeywords (${pack.negativeKeywords.length})`);
    console.log(`  ${pack.negativeKeywords.join(" · ")}`);
    console.log("");
    process.exit(0);
  }

  await connectToDatabase();

  for (const pack of packs) {
    await KeywordLocale.findOneAndUpdate({ code: pack.code }, pack, { upsert: true, new: true });
  }

  const width = Math.max("language".length, ...packs.map((p) => p.language.length));
  console.log(`\nImported ${packs.length} locale pack${packs.length === 1 ? "" : "s"}\n`);
  console.log(`  code  ${"language".padEnd(width)}  countries        intent  offer   geo  negatives`);
  for (const pack of packs) {
    console.log(
      `  ${pack.code.padEnd(4)}  ${pack.language.padEnd(width)}  ${pack.countries.join(",").padEnd(15)}` +
        ` ${String(pack.intentTerms.length).padStart(6)}` +
        ` ${String(pack.offerModifiers?.length ?? 0).padStart(6)}` +
        ` ${String(pack.geoModifiers?.length ?? 0).padStart(5)}` +
        ` ${String(pack.negativeKeywords.length).padStart(10)}`
    );
  }
  console.log("\nReview a pack in full with:  pnpm db:import-locales --show=de\n");

  process.exit(0);
}

run().catch((err) => {
  console.error(`\nLocale import failed: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
