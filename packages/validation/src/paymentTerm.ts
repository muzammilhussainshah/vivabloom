import { z } from "zod";

export const paymentTermSchema = z
  .object({
    store: z.string().min(1, "Store is required"),
    netDays: z.coerce.number().int().min(0).default(30),
    batchCycle: z.enum(["none", "weekly", "monthly"]).default("monthly"),
    payDayOfWeek: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).max(6).optional()),
    payDayOfMonth: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1).max(31).optional()),
    monthsOffset: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).optional()),
    closingDayOfMonth: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1).max(31).optional()),
    minimumAmount: z.coerce.number().min(0).default(0),
    notes: z.string().max(500).optional().default(""),
  })
  .refine((data) => data.batchCycle !== "weekly" || data.payDayOfWeek !== undefined, {
    message: "Pick which weekday payment lands on for a weekly cycle",
    path: ["payDayOfWeek"],
  })
  .refine((data) => data.batchCycle !== "monthly" || data.payDayOfMonth !== undefined, {
    message: "Pick which day of the month payment lands on for a monthly cycle",
    path: ["payDayOfMonth"],
  });
export type PaymentTermInput = z.infer<typeof paymentTermSchema>;
