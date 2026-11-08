import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * The ledger of how much of one AccountingEntry's earnedCents has been
 * resolved, and how. Every settlement is either:
 * - "recovered": actually paid, tied to the AccountingPayment that paid it
 *   (via `payment`) — created by the FIFO allocator.
 * - "lost": written off (the store went unpaid/unreachable), tied to the
 *   AccountingWriteOff event that wrote it off (via `writeOff`) — `reason`
 *   explains why. Deleting that write-off event (e.g. the store pays after
 *   all) cascades to delete these too, reverting the day back to pending.
 * - "returned": the underlying sale was cancelled/refunded by the customer,
 *   so the commission was never really earned — tied to the
 *   AccountingReturn event (via `returnEvent`). Mechanically identical to
 *   "lost" (FIFO over pending, undoable by deleting the parent event), but
 *   reported separately since the root cause is completely different (a
 *   store non-payment risk vs. ordinary return-rate noise).
 *
 * For a given entry: recovered + lost + returned sums, subtracted from
 * earnedCents, give the still-pending amount. This is a dedicated collection
 * (rather than a running total on AccountingEntry) so every dollar's fate is
 * individually auditable and re-derivable — nothing is overwritten in place.
 */
const AccountingSettlementSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    entry: { type: Schema.Types.ObjectId, ref: "AccountingEntry", required: true, index: true },
    type: { type: String, enum: ["recovered", "lost", "returned"], required: true },
    amountCents: { type: Number, required: true, min: 1 },
    payment: { type: Schema.Types.ObjectId, ref: "AccountingPayment", default: null },
    writeOff: { type: Schema.Types.ObjectId, ref: "AccountingWriteOff", default: null },
    returnEvent: { type: Schema.Types.ObjectId, ref: "AccountingReturn", default: null },
    date: { type: Date, required: true },
    reason: { type: String, default: null },
  },
  { timestamps: true }
);

export type IAccountingSettlement = InferSchemaType<typeof AccountingSettlementSchema>;

export const AccountingSettlement: Model<IAccountingSettlement> =
  (models.AccountingSettlement as Model<IAccountingSettlement>) ??
  model<IAccountingSettlement>("AccountingSettlement", AccountingSettlementSchema);
