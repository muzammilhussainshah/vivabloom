"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectToDatabase, Coupon, Store } from "@monocoupon/db";
import { couponSchema, type CouponInput } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";
import { COUPON_TEMPLATE } from "./couponTemplate";

export type ActionState = { error?: string } | undefined;

/** Shared shaping between single and bulk create/update — code/URL/date normalization + the verified-at-creation timestamp. */
function buildCouponDoc(storeId: string, storeSlug: string, data: CouponInput) {
  const { store: _store, code, affiliateUrl, startDate, expiryDate, ...rest } = data;
  return {
    ...rest,
    store: storeId,
    storeSlug,
    code: code || null,
    affiliateUrl: affiliateUrl || null,
    startDate: startDate ? new Date(startDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    lastCheckedAt: data.isVerified ? new Date() : null,
  };
}

async function syncStoreStats(storeId: string) {
  const [totalCoupons, activeDeals] = await Promise.all([
    Coupon.countDocuments({ store: storeId }),
    Coupon.countDocuments({ store: storeId, isActive: true }),
  ]);
  await Store.updateOne(
    { _id: storeId },
    { "stats.totalCoupons": totalCoupons, "stats.activeDeals": activeDeals }
  );
}

function parseForm(formData: FormData) {
  return couponSchema.safeParse({
    store: formData.get("store"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    code: formData.get("code") || null,
    type: formData.get("type"),
    discountType: formData.get("discountType") || "other",
    discountValue: formData.get("discountValue") || null,
    merchantUrl: formData.get("merchantUrl"),
    affiliateUrl: formData.get("affiliateUrl") || null,
    startDate: formData.get("startDate") || null,
    expiryDate: formData.get("expiryDate") || null,
    isActive: formData.get("isActive") === "on",
    isExclusive: formData.get("isExclusive") === "on",
    isVerified: formData.get("isVerified") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export async function createCoupon(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const store = await Store.findById(parsed.data.store);
  if (!store) {
    return { error: "Selected store not found." };
  }

  const storeId = parsed.data.store;
  const coupon = await Coupon.create(buildCouponDoc(storeId, store.slug, parsed.data));
  await logAudit("coupon.create", { entityType: "Coupon", entityId: String(coupon._id) });

  await syncStoreStats(storeId);

  revalidatePath("/coupons");
  await revalidateWebPaths(["/stores", `/stores/${store.slug}`, "/", "/sitemap.xml"]);
  redirect("/coupons");
}

/**
 * Creates several coupons for one store in a single submit — the store's
 * usual 5-title set (see couponTemplate.ts), sharing one URL/code, one
 * expiry, and one set of status flags. Each row is still run through
 * couponSchema individually so validation stays identical to the single-
 * coupon form.
 */
export async function createBulkCoupons(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = String(formData.get("store") || "");
  const type = formData.get("type") === "code" ? "code" : "deal";
  const sharedCode = type === "code" ? String(formData.get("code") || "") : null;

  await connectToDatabase();
  const store = storeId ? await Store.findById(storeId) : null;
  if (!store) {
    return { error: "Selected store not found." };
  }

  const shared = {
    description: "",
    code: sharedCode,
    type,
    merchantUrl: formData.get("merchantUrl"),
    affiliateUrl: formData.get("affiliateUrl") || null,
    startDate: null,
    expiryDate: formData.get("expiryDate") || null,
    isActive: formData.get("isActive") === "on",
    isExclusive: false,
    isVerified: formData.get("isVerified") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sortOrder: 0,
  };

  const rows: CouponInput[] = [];
  for (let i = 0; i < COUPON_TEMPLATE.length; i++) {
    if (formData.get(`included-${i}`) !== "on") continue;
    const title = String(formData.get(`title-${i}`) || "").trim();
    if (!title) continue;

    const parsed = couponSchema.safeParse({
      ...shared,
      store: storeId,
      title,
      discountType: formData.get(`discountType-${i}`) || "other",
      discountValue: formData.get(`discountValue-${i}`) || null,
    });
    if (!parsed.success) {
      return { error: `Row "${title}": ${parsed.error.issues[0]?.message ?? "Invalid input"}` };
    }
    rows.push(parsed.data);
  }

  if (rows.length === 0) {
    return { error: "Select at least one coupon to create." };
  }

  const created = await Coupon.insertMany(rows.map((row) => buildCouponDoc(storeId, store.slug, row)));
  for (const coupon of created) {
    await logAudit("coupon.create", { entityType: "Coupon", entityId: String(coupon._id) });
  }

  await syncStoreStats(storeId);

  revalidatePath("/coupons");
  await revalidateWebPaths(["/stores", `/stores/${store.slug}`, "/", "/sitemap.xml"]);
  redirect("/coupons");
}

export async function updateCoupon(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const store = await Store.findById(parsed.data.store);
  if (!store) {
    return { error: "Selected store not found." };
  }

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    return { error: "Coupon not found." };
  }
  const oldStoreId = String(coupon.store);
  const oldStoreSlug = coupon.storeSlug;

  const { store: storeId, code, affiliateUrl, startDate, expiryDate, ...rest } = parsed.data;
  Object.assign(coupon, rest, {
    store: storeId,
    storeSlug: store.slug,
    code: code || null,
    affiliateUrl: affiliateUrl || null,
    startDate: startDate ? new Date(startDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
  });
  await coupon.save();
  await logAudit("coupon.update", { entityType: "Coupon", entityId: id });

  await syncStoreStats(storeId);
  if (oldStoreId !== storeId) await syncStoreStats(oldStoreId);

  revalidatePath("/coupons");
  const paths = ["/stores", `/stores/${store.slug}`, "/", "/sitemap.xml"];
  if (oldStoreSlug !== store.slug) paths.push(`/stores/${oldStoreSlug}`);
  await revalidateWebPaths(paths);
  redirect("/coupons");
}

export async function deleteCoupon(id: string) {
  await connectToDatabase();
  const coupon = await Coupon.findByIdAndDelete(id);

  revalidatePath("/coupons");
  if (coupon) {
    await logAudit("coupon.delete", { entityType: "Coupon", entityId: id });
    await syncStoreStats(String(coupon.store));
    await revalidateWebPaths(["/stores", `/stores/${coupon.storeSlug}`, "/", "/sitemap.xml"]);
  }
  redirect("/coupons");
}

export async function markVerified(id: string) {
  await connectToDatabase();
  const coupon = await Coupon.findByIdAndUpdate(
    id,
    { isVerified: true, lastCheckedAt: new Date() },
    { new: true }
  );

  revalidatePath("/coupons");
  if (coupon) {
    await logAudit("coupon.verify", { entityType: "Coupon", entityId: id });
    await revalidateWebPaths([`/stores/${coupon.storeSlug}`]);
  }
  redirect("/coupons");
}
