import { z } from "zod";

/** Dollar amounts as typed by the admin — converted to cents in actions.ts (Math.round(dollars * 100)), never here, so the schema stays about shape/range, not units. */
export const accountingEntrySchema = z.object({
  store: z.string().min(1, "Store is required"),
  date: z.string().min(1, "Date is required"),
  spent: z.coerce.number().min(0, "Spent can't be negative"),
  earned: z.coerce.number().min(0, "Earned can't be negative"),
  notes: z.string().max(500).optional().default(""),
});
export type AccountingEntryInput = z.infer<typeof accountingEntrySchema>;

export const accountingPaymentSchema = z.object({
  store: z.string().min(1, "Store is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  dateReceived: z.string().min(1, "Date received is required"),
  method: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().default(""),
});
export type AccountingPaymentInput = z.infer<typeof accountingPaymentSchema>;

/** Writes off a store's currently-pending earnings. `amount` omitted (or "") means "everything still pending". */
export const accountingLostSchema = z.object({
  store: z.string().min(1, "Store is required"),
  amount: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().positive().optional()),
  date: z.string().min(1, "Date is required"),
  reason: z.string().max(500).optional().default(""),
});
export type AccountingLostInput = z.infer<typeof accountingLostSchema>;
