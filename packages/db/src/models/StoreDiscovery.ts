import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * A cached "Find stores" search (country + category + optional keyword) from
 * the admin Store Checker. Reused for a week so repeating the same search
 * doesn't spend web-search credits again; `results` shape is owned by
 * apps/admin/lib/intelligence/discover.ts.
 */
const StoreDiscoverySchema = new Schema(
  {
    /** `${country}|${category}|${keyword}` lowercased. */
    key: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    category: { type: String, required: true },
    keyword: { type: String, default: null },
    /** Only stores with evidence of an affiliate program. */
    results: { type: Schema.Types.Mixed, default: [] },
    /** Brands the sources named but with no affiliate-program evidence — kept for transparency, not shown as results. */
    hidden: { type: Schema.Types.Mixed, default: [] },
    /** False for searches saved before results were filtered to affiliate programs. */
    programFiltered: { type: Boolean, default: false },
    tavilyCredits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type IStoreDiscovery = InferSchemaType<typeof StoreDiscoverySchema>;

export const StoreDiscovery: Model<IStoreDiscovery> =
  (models.StoreDiscovery as Model<IStoreDiscovery>) ?? model<IStoreDiscovery>("StoreDiscovery", StoreDiscoverySchema);
