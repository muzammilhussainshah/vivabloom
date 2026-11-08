import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * How one store actually pays out, expressed generally enough to cover every
 * real-world pattern seen so far (see apps/admin/lib/accounting/forecast.ts
 * for how these fields combine into an actual expected-payment date):
 *
 * - Flat offset only (batchCycle "none"): pay `netDays` after each day it was
 *   earned — e.g. Spacegoods, net 60.
 * - Weekly batch (batchCycle "weekly"): every Mon-Sun week's earnings close
 *   together on that Sunday; paid `netDays` after that close, landing on
 *   `payDayOfWeek` — e.g. Tabs Chocolate: net 30, closes Sunday, pays the
 *   following Monday.
 * - Monthly batch (batchCycle "monthly"): earnings close together into a
 *   period, paid on `payDayOfMonth` of a later month — either the earliest
 *   such date that's still >= netDays after close, or a fixed `monthsOffset`
 *   when the store states it that way directly (Engwe: "August's earnings
 *   paid by October 10" = monthsOffset 2, day 10; IM8: "August's earnings
 *   paid September 10" = monthsOffset 1, day 10 — the store's own stated
 *   lag, not a netDays estimate, whenever the store tells you the lag
 *   directly rather than "net 30").
 *   The closing period itself defaults to the calendar month, but a store
 *   whose cycle doesn't line up with month-end (paid the 10th, covering
 *   everything since the 10th of the prior month — a "10th-to-10th" cycle,
 *   not a calendar month) sets `closingDayOfMonth` to move the cutoff itself
 *   (Ekster: closingDayOfMonth 10, monthsOffset 1, day 10).
 *
 * `minimumAmountCents` (monthly batches only): if a month's batched pending
 * total is under this, it isn't paid out on schedule — it carries forward
 * and merges with the next month's batch instead (IM8's $100 minimum).
 */
const PaymentTermSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, unique: true, index: true },
    netDays: { type: Number, default: 30, min: 0 },
    batchCycle: { type: String, enum: ["none", "weekly", "monthly"], default: "monthly" },
    /** 0 (Sunday) - 6 (Saturday). Used when batchCycle is "weekly". */
    payDayOfWeek: { type: Number, min: 0, max: 6, default: null },
    /** 1-31. Used when batchCycle is "monthly". */
    payDayOfMonth: { type: Number, min: 1, max: 31, default: null },
    /** When set, overrides the netDays-derived month entirely (a store-stated fixed lag like "2 months later"). Used when batchCycle is "monthly". */
    monthsOffset: { type: Number, min: 0, default: null },
    /** 1-31, default null (= calendar month-end). When set, the monthly batching boundary itself moves to this day of the month instead of month-end (e.g. 10 for a "10th-to-10th" cycle). Used when batchCycle is "monthly". */
    closingDayOfMonth: { type: Number, min: 1, max: 31, default: null },
    minimumAmountCents: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export type IPaymentTerm = InferSchemaType<typeof PaymentTermSchema>;

export const PaymentTerm: Model<IPaymentTerm> =
  (models.PaymentTerm as Model<IPaymentTerm>) ?? model<IPaymentTerm>("PaymentTerm", PaymentTermSchema);
