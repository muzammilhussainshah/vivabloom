import { z } from "zod";
import { SUPPORTED_COUNTRY_CODES } from "./countries";

export const couponLocaleSchema = z.object({
  country: z.enum(SUPPORTED_COUNTRY_CODES as [string, ...string[]]),
  title: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  code: z.string().max(100).optional().nullable(),
  affiliateUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url("Must be a valid URL").max(1000).optional().nullable()),
});

/**
 * Deliberately does NOT include `i18n` — same reasoning as storeSchema in
 * store.ts: that field is owned exclusively by the Country Customization
 * page's dedicated action, which validates each entry directly against
 * couponLocaleSchema. Including it here would mean a normal Coupon edit
 * (which never submits i18n) silently wipes it back to `[]` via
 * updateCoupon's Object.assign in coupons/actions.ts.
 */
export const couponSchema = z
  .object({
    store: z.string().min(1, "Store is required"),
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(1000).optional().default(""),
    code: z.string().max(100).optional().nullable().or(z.literal("")),
    type: z.enum(["code", "deal"]),
    discountType: z.enum(["percentage", "fixed", "other"]).default("other"),
    discountValue: z.coerce.number().min(0).optional().nullable(),
    merchantUrl: z.string().url("Must be a valid URL").max(1000),
    affiliateUrl: z.string().url("Must be a valid URL").max(1000).optional().nullable().or(z.literal("")),
    startDate: z.string().optional().nullable().or(z.literal("")),
    expiryDate: z.string().optional().nullable().or(z.literal("")),
    isActive: z.boolean().default(true),
    isExclusive: z.boolean().default(false),
    isVerified: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    sortOrder: z.coerce.number().int().default(0),
  })
  .refine((data) => data.type !== "code" || !!data.code, {
    message: "Code is required when type is 'code'",
    path: ["code"],
  });

export type CouponInput = z.infer<typeof couponSchema>;
