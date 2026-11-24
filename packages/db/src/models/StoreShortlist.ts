import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * A store the admin starred as "worth pursuing" in the Store Checker. It can be
 * starred before it has ever been checked, so it is keyed by name (and domain
 * when known) instead of pointing at a StoreCheck.
 */
const StoreShortlistSchema = new Schema(
  {
    /** Compacted brand name — always present, used to match across searches. */
    nameKey: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    domain: { type: String, default: null, lowercase: true, trim: true },
    /** The admin's own note ("ask Impact manager about PPC", …). */
    memo: { type: String, default: "" },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

StoreShortlistSchema.index({ domain: 1 });

export type IStoreShortlist = InferSchemaType<typeof StoreShortlistSchema>;

export const StoreShortlist: Model<IStoreShortlist> =
  (models.StoreShortlist as Model<IStoreShortlist>) ?? model<IStoreShortlist>("StoreShortlist", StoreShortlistSchema);
