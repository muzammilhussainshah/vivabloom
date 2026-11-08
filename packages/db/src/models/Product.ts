import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/** A country-specific override of `productUrl` — e.g. a different affiliate network/referral link for Italy. Falls back to the English productUrl when a country has no entry (see catalogItems.ts in apps/web). */
const ProductLocaleSchema = new Schema(
  {
    country: { type: String, required: true, lowercase: true, trim: true },
    productUrl: { type: String, default: null },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    /** Denormalized from Store.slug so the /go-product/[...] redirect route avoids a join. */
    storeSlug: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    /** Admin-authored copy for the product detail page — optional, falls back to a generic blurb on the web app when empty. */
    description: { type: String, default: "" },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, default: null },
    productUrl: { type: String, required: true },
    /** One entry per country this product has a referral-link override for. */
    i18n: {
      type: [ProductLocaleSchema],
      default: [],
      validate: {
        validator: (entries: { country: string }[]) => new Set(entries.map((e) => e.country)).size === entries.length,
        message: "Each country can only have one i18n entry per product.",
      },
    },
    isActive: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.index({ store: 1, isActive: 1 });
ProductSchema.index({ name: "text", description: "text" });

export type IProduct = InferSchemaType<typeof ProductSchema>;

export const Product: Model<IProduct> =
  (models.Product as Model<IProduct>) ?? model<IProduct>("Product", ProductSchema);
