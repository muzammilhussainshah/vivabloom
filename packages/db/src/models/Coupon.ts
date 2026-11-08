import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * A country-specific override of `title`/`description`/`code`/`affiliateUrl`
 * — much smaller than Store's i18n subdocument since a coupon has no
 * mechanic/dates/trust-checks of its own (those all live on the store-level
 * offer). Same fallback rule as everywhere else in this app: a country with
 * no entry, or an entry missing one of these fields, falls back to the
 * English value (see AllDealsSection.tsx in apps/web) — e.g. a coupon can
 * override just its referral link for Italy (a different affiliate network)
 * while still showing the English title/description.
 */
const CouponLocaleSchema = new Schema(
  {
    country: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, default: null },
    description: { type: String, default: null },
    code: { type: String, default: null },
    affiliateUrl: { type: String, default: null },
  },
  { _id: false }
);

const CouponSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    /** Denormalized from Store.slug so the /go/[...] redirect route avoids a join. */
    storeSlug: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    /** One entry per country this coupon has a translated title/description for. */
    i18n: {
      type: [CouponLocaleSchema],
      default: [],
      validate: {
        validator: (entries: { country: string }[]) => new Set(entries.map((e) => e.country)).size === entries.length,
        message: "Each country can only have one i18n entry per coupon.",
      },
    },
    code: { type: String, default: null },
    type: { type: String, enum: ["code", "deal"], required: true },
    discountType: { type: String, enum: ["percentage", "fixed", "other"], default: "other" },
    discountValue: { type: Number, default: null },
    merchantUrl: { type: String, required: true },
    affiliateUrl: { type: String, default: null },
    startDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    isExclusive: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    lastCheckedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CouponSchema.index({ store: 1, isActive: 1 });
CouponSchema.index({ expiryDate: 1 });
CouponSchema.index({ title: "text" });

export type ICoupon = InferSchemaType<typeof CouponSchema>;

export const Coupon: Model<ICoupon> =
  (models.Coupon as Model<ICoupon>) ?? model<ICoupon>("Coupon", CouponSchema);
