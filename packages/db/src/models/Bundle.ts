import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/** A country-specific override of `bundleUrl`/`bundleDetailsUrl` — e.g. a different affiliate network/referral link for Italy. Falls back to the English URLs when a country has no entry (see catalogItems.ts / HandoffModal.tsx in apps/web). */
const BundleLocaleSchema = new Schema(
  {
    country: { type: String, required: true, lowercase: true, trim: true },
    bundleUrl: { type: String, default: null },
    bundleDetailsUrl: { type: String, default: null },
  },
  { _id: false }
);

const BundleSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    /** Denormalized from Store.slug so lookups avoid a join. */
    storeSlug: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    /**
     * Unique across BOTH Bundle and Product — the web app's /products/[slug]
     * route serves either kind at the same URL (a bundle is presented as
     * "just another product" there), so this can't collide with a Product
     * slug either. Enforced app-side (admin actions check both collections);
     * this index alone only guarantees uniqueness within Bundle.
     */
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    /** Admin-authored copy for the bundle's detail page — optional, falls back to a generic blurb on the web app when empty. */
    description: { type: String, default: "" },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, default: null },
    /** Display-only marketing badge (e.g. "extra 7% off") — not applied to `price`, which already reflects the final charged amount. */
    extraDiscountPercent: { type: Number, default: null },
    bundleUrl: { type: String, required: true },
    bundleDetailsUrl: { type: String, required: true },
    /** One entry per country this bundle has a referral-link override for. */
    i18n: {
      type: [BundleLocaleSchema],
      default: [],
      validate: {
        validator: (entries: { country: string }[]) => new Set(entries.map((e) => e.country)).size === entries.length,
        message: "Each country can only have one i18n entry per bundle.",
      },
    },
    isActive: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BundleSchema.index({ store: 1, isActive: 1 });
BundleSchema.index({ name: "text", description: "text" });

export type IBundle = InferSchemaType<typeof BundleSchema>;

export const Bundle: Model<IBundle> =
  (models.Bundle as Model<IBundle>) ?? model<IBundle>("Bundle", BundleSchema);
