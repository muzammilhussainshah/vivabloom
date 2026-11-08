import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * A customer-return / commission-reversal event — mechanically the same
 * shape as AccountingWriteOff (a parent record + FIFO settlements against
 * pending earnings, undoable as one unit), but semantically distinct: a
 * write-off means the store never paid a valid debt; a return means the
 * underlying sale itself was cancelled, so the commission was never really
 * earned to begin with. Reported as its own bucket (not lumped into "Lost")
 * because the two have completely different implications — one is a red
 * flag on the store, the other is normal return-rate noise.
 *
 * Only reduces still-*pending* earnings (same FIFO-over-pending mechanism as
 * a write-off) — if the commission was already recovered (paid to you)
 * before the return was discovered, this can't claw that back
 * retroactively; in practice the network deducts it from your next payment,
 * so just log whatever smaller amount you actually receive.
 */
const AccountingReturnSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    amountCents: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    reason: { type: String, default: null },
  },
  { timestamps: true }
);

AccountingReturnSchema.index({ store: 1, date: -1 });

export type IAccountingReturn = InferSchemaType<typeof AccountingReturnSchema>;

export const AccountingReturn: Model<IAccountingReturn> =
  (models.AccountingReturn as Model<IAccountingReturn>) ??
  model<IAccountingReturn>("AccountingReturn", AccountingReturnSchema);
