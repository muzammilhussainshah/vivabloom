"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectToDatabase, Bundle, Product, Store, Category } from "@monocoupon/db";
import { bundleSchema } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string } | undefined;

async function syncStoreBundleStats(storeId: string) {
  const totalBundles = await Bundle.countDocuments({ store: storeId });
  await Store.updateOne({ _id: storeId }, { "stats.totalBundles": totalBundles });
}

/** The web app's /products/[slug] route serves both kinds at the same URL, so a bundle's slug must be unique across both collections, not just within Bundle. */
async function isSlugTaken(slug: string, excludeBundleId?: string): Promise<boolean> {
  const [bundleMatch, productMatch] = await Promise.all([
    Bundle.findOne(excludeBundleId ? { slug, _id: { $ne: excludeBundleId } } : { slug }),
    Product.findOne({ slug }),
  ]);
  return !!(bundleMatch || productMatch);
}

async function categoryPathsForStore(storeId: string): Promise<string[]> {
  const store = await Store.findById(storeId, "categories").lean();
  if (!store?.categories?.length) return [];
  const categories = await Category.find({ _id: { $in: store.categories } }, "slug").lean();
  return categories.map((c) => `/category/${c.slug}`);
}

function parseForm(formData: FormData) {
  return bundleSchema.safeParse({
    store: formData.get("store"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || "",
    image: formData.get("image"),
    price: formData.get("price"),
    originalPrice: formData.get("originalPrice") || null,
    extraDiscountPercent: formData.get("extraDiscountPercent") || null,
    bundleUrl: formData.get("bundleUrl"),
    bundleDetailsUrl: formData.get("bundleDetailsUrl"),
    isActive: formData.get("isActive") === "on",
  });
}

export async function createBundle(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const store = await Store.findById(parsed.data.store);
  if (!store) {
    return { error: "Selected store not found." };
  }

  if (await isSlugTaken(parsed.data.slug)) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const { store: storeId, originalPrice, ...rest } = parsed.data;
  const bundle = await Bundle.create({
    ...rest,
    store: storeId,
    storeSlug: store.slug,
    originalPrice: originalPrice || null,
  });
  await logAudit("bundle.create", { entityType: "Bundle", entityId: String(bundle._id) });

  await syncStoreBundleStats(storeId);

  revalidatePath("/bundles");
  const categoryPaths = await categoryPathsForStore(storeId);
  await revalidateWebPaths([
    "/products",
    `/products/${bundle.slug}`,
    "/stores",
    `/stores/${store.slug}`,
    "/",
    "/sitemap.xml",
    ...categoryPaths,
  ]);
  redirect("/bundles");
}

export async function updateBundle(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const store = await Store.findById(parsed.data.store);
  if (!store) {
    return { error: "Selected store not found." };
  }

  const bundle = await Bundle.findById(id);
  if (!bundle) {
    return { error: "Bundle not found." };
  }

  if (await isSlugTaken(parsed.data.slug, id)) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const oldStoreId = String(bundle.store);
  const oldStoreSlug = bundle.storeSlug;
  const oldBundleSlug = bundle.slug;

  const { store: storeId, originalPrice, ...rest } = parsed.data;
  Object.assign(bundle, rest, {
    store: storeId,
    storeSlug: store.slug,
    originalPrice: originalPrice || null,
  });
  await bundle.save();
  await logAudit("bundle.update", { entityType: "Bundle", entityId: id });

  await syncStoreBundleStats(storeId);
  if (oldStoreId !== storeId) await syncStoreBundleStats(oldStoreId);

  revalidatePath("/bundles");
  const paths = [
    "/products",
    `/products/${bundle.slug}`,
    "/stores",
    `/stores/${store.slug}`,
    "/",
    "/sitemap.xml",
    ...(await categoryPathsForStore(storeId)),
  ];
  if (oldBundleSlug !== bundle.slug) paths.push(`/products/${oldBundleSlug}`);
  if (oldStoreSlug !== store.slug) {
    paths.push(`/stores/${oldStoreSlug}`, ...(await categoryPathsForStore(oldStoreId)));
  }
  await revalidateWebPaths(paths);
  redirect("/bundles");
}

export async function deleteBundle(id: string) {
  await connectToDatabase();
  const bundle = await Bundle.findByIdAndDelete(id);

  revalidatePath("/bundles");
  if (bundle) {
    await logAudit("bundle.delete", { entityType: "Bundle", entityId: id });
    const storeId = String(bundle.store);
    await syncStoreBundleStats(storeId);
    const categoryPaths = await categoryPathsForStore(storeId);
    await revalidateWebPaths([
      "/products",
      `/products/${bundle.slug}`,
      "/stores",
      `/stores/${bundle.storeSlug}`,
      "/",
      "/sitemap.xml",
      ...categoryPaths,
    ]);
  }
  redirect("/bundles");
}
