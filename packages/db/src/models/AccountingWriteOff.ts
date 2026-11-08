import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * A "mark as lost" event — the write-off counterpart to AccountingPayment.
 * Recording one triggers a FIFO write-off against the store's oldest
 * unsettled AccountingEntry rows (see markStoreLost in
 * apps/admin/lib/accounting/ledger.ts), producing one AccountingSettlement
 * (type "lost") per day it touches, each referencing this record via
 * `writeOff` — exactly mirroring how a Payment's settlements reference it
 * via `payment`. That parent record is what makes the write-off undoable
 * as one unit later (e.g. if the store pays after all): delete this record
 * and its settlements, and those days revert to pending.
 */
const AccountingWriteOffSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    amountCents: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    reason: { type: String, default: null },
  },
  { timestamps: true }
);

AccountingWriteOffSchema.index({ store: 1, date: -1 });

export type IAccountingWriteOff = InferSchemaType<typeof AccountingWriteOffSchema>;

export const AccountingWriteOff: Model<IAccountingWriteOff> =
  (models.AccountingWriteOff as Model<IAccountingWriteOff>) ??
  model<IAccountingWriteOff>("AccountingWriteOff", AccountingWriteOffSchema);
