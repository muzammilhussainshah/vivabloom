import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * One row per store per calendar day: what was spent on ads and what was
 * earned in affiliate commission that day. This is the single source of
 * truth for the accounting section — monthly/lifetime totals, ROI, and
 * receivables are always computed from these rows, never stored redundantly,
 * so there's nothing that can drift out of sync with a manual total.
 *
 * Money is stored as integer cents (spentCents/earnedCents), never floats —
 * float dollars accumulate rounding error across hundreds of summed rows.
 */
const AccountingEntrySchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    /** UTC midnight for the day this entry covers. */
    date: { type: Date, required: true },
    spentCents: { type: Number, required: true, default: 0, min: 0 },
    earnedCents: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// One row per store per day — re-submitting the same store+date is an edit,
// never a duplicate (see upsertEntry in accounting/actions.ts).
AccountingEntrySchema.index({ store: 1, date: 1 }, { unique: true });

export type IAccountingEntry = InferSchemaType<typeof AccountingEntrySchema>;

export const AccountingEntry: Model<IAccountingEntry> =
  (models.AccountingEntry as Model<IAccountingEntry>) ?? model<IAccountingEntry>("AccountingEntry", AccountingEntrySchema);
