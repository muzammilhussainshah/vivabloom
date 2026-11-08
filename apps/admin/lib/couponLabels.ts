import { Coupon } from "@monocoupon/db";

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export interface CouponLabel {
  title: string;
  code: string | null;
}

/**
 * Batch-resolves coupon ids (as denormalized onto tracking/engagement
 * events) to their current title/code, so the admin UI can show "which
 * card" a click/copy belongs to instead of a bare ObjectId. One query for
 * however many distinct ids appear on the current page — never a
 * per-row lookup.
 */
export async function resolveCouponLabels(couponIds: (string | null | undefined)[]): Promise<Map<string, CouponLabel>> {
  const ids = Array.from(new Set(couponIds.filter((id): id is string => !!id && OBJECT_ID_RE.test(id))));
  if (ids.length === 0) return new Map();

  const coupons = await Coupon.find({ _id: { $in: ids } }, "title code").lean();
  return new Map(coupons.map((c) => [String(c._id), { title: c.title, code: c.code ?? null }]));
}
