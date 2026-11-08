import dotenv from "dotenv";
import path from "node:path";
import { connectToDatabase } from "./connect";
import { Product } from "./models/index";

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
 * One-time backfill for the new required-unique Product.slug field: every
 * product that predates this field gets one derived from its name, with a
 * numeric suffix appended if that base slug is already taken by another
 * product (checked against everything already known to be in use, so two
 * products backfilled in the same run can't collide with each other either).
 */
async function run() {
  await connectToDatabase();

  const products = await Product.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] })
    .select("_id name")
    .lean();

  if (products.length === 0) {
    console.log("No products need a slug backfill.");
    process.exit(0);
  }

  const existingSlugs = new Set(
    (await Product.find({ slug: { $nin: [null, ""] } }).select("slug").lean()).map((p) => p.slug as string)
  );

  for (const product of products) {
    const base = slugify(product.name) || "product";
    let slug = base;
    let suffix = 2;
    while (existingSlugs.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    existingSlugs.add(slug);
    await Product.updateOne({ _id: product._id }, { slug });
    console.log(`  ${product.name} -> ${slug}`);
  }

  console.log(`Backfilled ${products.length} product slug(s).`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
