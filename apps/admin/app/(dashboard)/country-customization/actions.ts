"use server";

import { connectToDatabase, Store, Coupon, Product, Bundle } from "@monocoupon/db";
import { storeLocaleOfferSchema, couponLocaleSchema, productLocaleSchema, bundleLocaleSchema } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseStoreLocale(formData: FormData, country: string) {
  const trustChecks = formData.getAll("trustCheck").map(String).filter((s) => s.trim());
  const notOffered = formData.getAll("notOffered").map(String).filter((s) => s.trim());
  const faqQuestions = formData.getAll("faqQuestion").map(String);
  const faqAnswers = formData.getAll("faqAnswer").map(String);
  const faqs = faqQuestions
    .map((question, i) => ({ question, answer: faqAnswers[i] ?? "", sortOrder: i }))
    .filter((f) => f.question.trim() && f.answer.trim());

  return {
    country,
    mechanic: formData.get("mechanic") || null,
    code: formData.get("code") || null,
    affiliateUrl: formData.get("affiliateUrl") || null,
    discountLabel: formData.get("discountLabel") || null,
    discountSuffix: formData.get("discountSuffix") || null,
    offerSubline: formData.get("offerSubline") || null,
    lede: formData.get("lede") || null,
    verifiedDate: formData.get("verifiedDate") || null,
    nextCheckDate: formData.get("nextCheckDate") || null,
    verifierName: formData.get("verifierName") || null,
    usageCount: formData.get("usageCount") || null,
    trustChecks,
    notOffered,
    faqs,
    metaTitle: formData.get("metaTitle") || null,
    metaDescription: formData.get("metaDescription") || null,
  };
}

function hasAnyContent(entry: ReturnType<typeof parseStoreLocale>): boolean {
  return Boolean(
    entry.mechanic || entry.code || entry.affiliateUrl || entry.discountLabel || entry.discountSuffix ||
    entry.offerSubline || entry.lede || entry.verifiedDate || entry.nextCheckDate || entry.verifierName ||
    entry.usageCount || entry.trustChecks.length > 0 || entry.notOffered.length > 0 || entry.faqs.length > 0 ||
    entry.metaTitle || entry.metaDescription
  );
}

/**
 * Saves everything for one (store, country) pair in a single submit —
 * the store's offer override plus every active coupon's title/description
 * override. Deliberately its own action rather than reusing
 * stores/actions.ts's updateStore or coupons/actions.ts's updateCoupon:
 * those re-validate and rewrite their *entire* document, so reusing them
 * here would risk this page accidentally clobbering base English fields
 * (name, categories, SEO, etc.) it never even shows. This action only ever
 * touches the `i18n` array on the relevant documents.
 */
export async function saveCountryContent(storeId: string, country: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  await connectToDatabase();

  const store = await Store.findById(storeId);
  if (!store) {
    return { error: "Store not found." };
  }

  const localeEntryRaw = parseStoreLocale(formData, country);
  const storeHasContent = hasAnyContent(localeEntryRaw);
  if (storeHasContent) {
    const parsed = storeLocaleOfferSchema.safeParse(localeEntryRaw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    store.set(
      "i18n",
      [...(store.i18n ?? []).filter((e) => e.country !== country), parsed.data]
    );
  } else {
    store.set("i18n", (store.i18n ?? []).filter((e) => e.country !== country));
  }
  await store.save();

  const coupons = await Coupon.find({ store: storeId, isActive: true });
  for (const coupon of coupons) {
    const title = String(formData.get(`coupon_${coupon._id}_title`) || "").trim();
    const description = String(formData.get(`coupon_${coupon._id}_description`) || "").trim();
    const code = String(formData.get(`coupon_${coupon._id}_code`) || "").trim();
    const affiliateUrl = String(formData.get(`coupon_${coupon._id}_affiliateUrl`) || "").trim();

    if (title || description || code || affiliateUrl) {
      const parsed = couponLocaleSchema.safeParse({
        country,
        title: title || null,
        description: description || null,
        code: code || null,
        affiliateUrl: affiliateUrl || null,
      });
      if (!parsed.success) {
        return { error: `Coupon "${coupon.title}": ${parsed.error.issues[0]?.message ?? "Invalid input"}` };
      }
      coupon.set(
        "i18n",
        [...(coupon.i18n ?? []).filter((e) => e.country !== country), parsed.data]
      );
    } else {
      coupon.set("i18n", (coupon.i18n ?? []).filter((e) => e.country !== country));
    }
    await coupon.save();
  }

  const products = await Product.find({ store: storeId, isActive: true });
  for (const product of products) {
    const productUrl = String(formData.get(`product_${product._id}_url`) || "").trim();
    if (productUrl) {
      const parsed = productLocaleSchema.safeParse({ country, productUrl });
      if (!parsed.success) {
        return { error: `Product "${product.name}": ${parsed.error.issues[0]?.message ?? "Invalid input"}` };
      }
      product.set(
        "i18n",
        [...(product.i18n ?? []).filter((e) => e.country !== country), parsed.data]
      );
    } else {
      product.set("i18n", (product.i18n ?? []).filter((e) => e.country !== country));
    }
    await product.save();
  }

  const bundles = await Bundle.find({ store: storeId, isActive: true });
  for (const bundle of bundles) {
    const bundleUrl = String(formData.get(`bundle_${bundle._id}_url`) || "").trim();
    const bundleDetailsUrl = String(formData.get(`bundle_${bundle._id}_detailsUrl`) || "").trim();
    if (bundleUrl || bundleDetailsUrl) {
      const parsed = bundleLocaleSchema.safeParse({ country, bundleUrl: bundleUrl || null, bundleDetailsUrl: bundleDetailsUrl || null });
      if (!parsed.success) {
        return { error: `Bundle "${bundle.name}": ${parsed.error.issues[0]?.message ?? "Invalid input"}` };
      }
      bundle.set(
        "i18n",
        [...(bundle.i18n ?? []).filter((e) => e.country !== country), parsed.data]
      );
    } else {
      bundle.set("i18n", (bundle.i18n ?? []).filter((e) => e.country !== country));
    }
    await bundle.save();
  }

  await logAudit(`store.localeUpdate.${country}`, { entityType: "Store", entityId: storeId });

  await revalidateWebPaths(["/stores", `/stores/${store.slug}`]);

  return { success: true };
}
