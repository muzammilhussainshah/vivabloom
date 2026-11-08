import dotenv from "dotenv";
import path from "node:path";
import { connectToDatabase } from "./connect";
import { Bundle, Product } from "./models/index";

// Loaded relative to this file so the script works regardless of the cwd it's invoked from.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * One-time backfill for the new required-unique Bundle.slug field. Unlike
 * backfillProductSlugs, this also dedupes against every existing *Product*
 * slug — bundles and products now share the /products/[slug] URL namespace
 * on the web app (a bundle is presented as "just another product" there),
 * so a bundle's backfilled slug must be unique across both collections.
 */
async function run() {
  await connectToDatabase();

  const bundles = await Bundle.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] })
    .select("_id name")
    .lean();

  if (bundles.length === 0) {
    console.log("No bundles need a slug backfill.");
    process.exit(0);
  }

  const [existingBundleSlugs, existingProductSlugs] = await Promise.all([
    Bundle.find({ slug: { $nin: [null, ""] } }).select("slug").lean(),
    Product.find({ slug: { $nin: [null, ""] } }).select("slug").lean(),
  ]);
  const existingSlugs = new Set([
    ...existingBundleSlugs.map((b) => b.slug as string),
    ...existingProductSlugs.map((p) => p.slug as string),
  ]);

  for (const bundle of bundles) {
    const base = slugify(bundle.name) || "bundle";
    let slug = base;
    let suffix = 2;
    while (existingSlugs.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    existingSlugs.add(slug);
    await Bundle.updateOne({ _id: bundle._id }, { slug });
    console.log(`  ${bundle.name} -> ${slug}`);
  }

  console.log(`Backfilled ${bundles.length} bundle slug(s).`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
