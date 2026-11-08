import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * A real-world receipt — money that actually landed, from one store's
 * affiliate program. Recording one triggers FIFO allocation against that
 * store's oldest unsettled AccountingEntry rows (see allocatePayment in
 * apps/admin/lib/accounting/allocate.ts); the resulting per-day breakdown is
 * written to AccountingSettlement, not stored here, so it stays auditable
 * even if entries are edited later.
 *
 * unallocatedCents is the leftover if this payment was larger than every
 * pending amount that existed for the store at the time it was recorded
 * (e.g. an advance) — flagged for the admin to review, never auto-applied to
 * future days.
 */
const AccountingPaymentSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    amountCents: { type: Number, required: true, min: 1 },
    dateReceived: { type: Date, required: true },
    method: { type: String, default: null },
    notes: { type: String, default: "" },
    unallocatedCents: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

AccountingPaymentSchema.index({ store: 1, dateReceived: -1 });

export type IAccountingPayment = InferSchemaType<typeof AccountingPaymentSchema>;

export const AccountingPayment: Model<IAccountingPayment> =
  (models.AccountingPayment as Model<IAccountingPayment>) ??
  model<IAccountingPayment>("AccountingPayment", AccountingPaymentSchema);
