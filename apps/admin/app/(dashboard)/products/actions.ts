"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectToDatabase, Product, Bundle, Store, Category } from "@monocoupon/db";
import { productSchema } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string } | undefined;

async function syncStoreProductStats(storeId: string) {
  const totalProducts = await Product.countDocuments({ store: storeId });
  await Store.updateOne({ _id: storeId }, { "stats.totalProducts": totalProducts });
}

/** The web app's /products/[slug] route serves both kinds at the same URL, so a product's slug must be unique across both collections, not just within Product. */
async function isSlugTaken(slug: string, excludeProductId?: string): Promise<boolean> {
  const [productMatch, bundleMatch] = await Promise.all([
    Product.findOne(excludeProductId ? { slug, _id: { $ne: excludeProductId } } : { slug }),
    Bundle.findOne({ slug }),
  ]);
  return !!(productMatch || bundleMatch);
}

async function categoryPathsForStore(storeId: string): Promise<string[]> {
  const store = await Store.findById(storeId, "categories").lean();
  if (!store?.categories?.length) return [];
  const categories = await Category.find({ _id: { $in: store.categories } }, "slug").lean();
  return categories.map((c) => `/category/${c.slug}`);
}

function parseForm(formData: FormData) {
  return productSchema.safeParse({
    store: formData.get("store"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || "",
    image: formData.get("image"),
    price: formData.get("price"),
    originalPrice: formData.get("originalPrice") || null,
    productUrl: formData.get("productUrl"),
    isActive: formData.get("isActive") === "on",
  });
}

export async function createProduct(_prevState: ActionState, formData: FormData): Promise<ActionState> {
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
  const product = await Product.create({
    ...rest,
    store: storeId,
    storeSlug: store.slug,
    originalPrice: originalPrice || null,
  });
  await logAudit("product.create", { entityType: "Product", entityId: String(product._id) });

  await syncStoreProductStats(storeId);

  revalidatePath("/products");
  const categoryPaths = await categoryPathsForStore(storeId);
  await revalidateWebPaths([
    "/products",
    `/products/${product.slug}`,
    "/stores",
    `/stores/${store.slug}`,
    "/",
    "/sitemap.xml",
    ...categoryPaths,
  ]);
  redirect("/products");
}

export async function updateProduct(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const store = await Store.findById(parsed.data.store);
  if (!store) {
    return { error: "Selected store not found." };
  }

  if (await isSlugTaken(parsed.data.slug, id)) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const product = await Product.findById(id);
  if (!product) {
    return { error: "Product not found." };
  }
  const oldStoreId = String(product.store);
  const oldStoreSlug = product.storeSlug;
  const oldProductSlug = product.slug;

  const { store: storeId, originalPrice, ...rest } = parsed.data;
  Object.assign(product, rest, {
    store: storeId,
    storeSlug: store.slug,
    originalPrice: originalPrice || null,
  });
  await product.save();
  await logAudit("product.update", { entityType: "Product", entityId: id });

  await syncStoreProductStats(storeId);
  if (oldStoreId !== storeId) await syncStoreProductStats(oldStoreId);

  revalidatePath("/products");
  const paths = [
    "/products",
    `/products/${product.slug}`,
    "/stores",
    `/stores/${store.slug}`,
    "/",
    "/sitemap.xml",
    ...(await categoryPathsForStore(storeId)),
  ];
  if (oldProductSlug !== product.slug) paths.push(`/products/${oldProductSlug}`);
  if (oldStoreSlug !== store.slug) {
    paths.push(`/stores/${oldStoreSlug}`, ...(await categoryPathsForStore(oldStoreId)));
  }
  await revalidateWebPaths(paths);
  redirect("/products");
}

export async function deleteProduct(id: string) {
  await connectToDatabase();
  const product = await Product.findByIdAndDelete(id);

  revalidatePath("/products");
  if (product) {
    await logAudit("product.delete", { entityType: "Product", entityId: id });
    const storeId = String(product.store);
    await syncStoreProductStats(storeId);
    const categoryPaths = await categoryPathsForStore(storeId);
    await revalidateWebPaths([
      "/products",
      `/products/${product.slug}`,
      "/stores",
      `/stores/${product.storeSlug}`,
      "/",
      "/sitemap.xml",
      ...categoryPaths,
    ]);
  }
  redirect("/products");
}
