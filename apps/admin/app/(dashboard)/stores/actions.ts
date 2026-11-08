"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectToDatabase, Store, Coupon } from "@monocoupon/db";
import { storeSchema } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  const categories = formData.getAll("categories").map(String);
  const faqQuestions = formData.getAll("faqQuestion").map(String);
  const faqAnswers = formData.getAll("faqAnswer").map(String);
  const faqs = faqQuestions
    .map((question, i) => ({ question, answer: faqAnswers[i] ?? "", sortOrder: i }))
    .filter((f) => f.question.trim() && f.answer.trim());

  const trustChecks = formData.getAll("offerTrustCheck").map(String).filter((s) => s.trim());
  const notOffered = formData.getAll("offerNotOffered").map(String).filter((s) => s.trim());
  const proofScreenshots = [0, 1, 2]
    .map((i) => String(formData.get(`offerProofScreenshot${i}`) ?? ""))
    .filter(Boolean);

  return storeSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    logo: formData.get("logo") || null,
    description: formData.get("description") ?? "",
    shortDescription: formData.get("shortDescription") ?? "",
    categories,
    websiteUrl: formData.get("websiteUrl"),
    faqs,
    offer: {
      mechanic: formData.get("offerMechanic") || null,
      code: formData.get("offerCode") || null,
      affiliateUrl: formData.get("offerAffiliateUrl") || null,
      discountLabel: formData.get("offerDiscountLabel") || null,
      discountSuffix: formData.get("offerDiscountSuffix") || null,
      offerSubline: formData.get("offerSubline") || null,
      lede: formData.get("offerLede") || null,
      verifiedDate: formData.get("offerVerifiedDate") || null,
      nextCheckDate: formData.get("offerNextCheckDate") || null,
      verifierName: formData.get("offerVerifierName") || null,
      usageCount: formData.get("offerUsageCount") || null,
      trustChecks,
      notOffered,
      proofScreenshots,
    },
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sortOrder: formData.get("sortOrder") || 0,
    seoTitle: formData.get("seoTitle") || null,
    seoDescription: formData.get("seoDescription") || null,
    rating: formData.get("rating") || 0,
  });
}

export async function createStore(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const existing = await Store.findOne({ slug: parsed.data.slug });
  if (existing) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const { rating, ...rest } = parsed.data;
  const store = await Store.create({
    ...rest,
    stats: { totalCoupons: 0, activeDeals: 0, views: 0, rating, joinedDate: new Date() },
  });
  await logAudit("store.create", { entityType: "Store", entityId: String(store._id) });

  revalidatePath("/stores");
  await revalidateWebPaths(["/stores", "/", "/sitemap.xml", `/stores/${parsed.data.slug}`, "/categories"]);
  redirect("/stores");
}

export async function updateStore(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const slugTaken = await Store.findOne({ slug: parsed.data.slug, _id: { $ne: id } });
  if (slugTaken) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const store = await Store.findById(id);
  if (!store) {
    return { error: "Store not found." };
  }
  const oldSlug = store.slug;

  const { rating, ...rest } = parsed.data;
  Object.assign(store, rest);
  if (store.stats) store.stats.rating = rating;

  if (oldSlug !== parsed.data.slug) {
    // Remember the old slug so /stores/{oldSlug} can redirect forward instead
    // of 404ing; drop the new slug from history in case this rename reverses
    // an earlier one (A -> B -> A).
    const history = (store.previousSlugs ?? []).filter((s) => s !== parsed.data.slug);
    if (!history.includes(oldSlug)) history.push(oldSlug);
    store.previousSlugs = history;
  }

  await store.save();
  await logAudit("store.update", { entityType: "Store", entityId: id });

  if (oldSlug !== parsed.data.slug) {
    await Coupon.updateMany({ store: store._id }, { storeSlug: parsed.data.slug });
  }

  revalidatePath("/stores");
  const paths = ["/stores", "/", "/sitemap.xml", `/stores/${parsed.data.slug}`, "/categories"];
  if (oldSlug !== parsed.data.slug) paths.push(`/stores/${oldSlug}`);
  await revalidateWebPaths(paths);
  redirect("/stores");
}

export async function deleteStore(id: string) {
  await connectToDatabase();
  const store = await Store.findByIdAndDelete(id);
  if (store) {
    await Coupon.deleteMany({ store: store._id });
    await logAudit("store.delete", { entityType: "Store", entityId: id });
  }

  revalidatePath("/stores");
  if (store) {
    await revalidateWebPaths(["/stores", "/", "/sitemap.xml", `/stores/${store.slug}`, "/categories"]);
  }
  redirect("/stores");
}
