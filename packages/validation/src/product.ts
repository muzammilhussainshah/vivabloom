import { z } from "zod";
import { SUPPORTED_COUNTRY_CODES } from "./countries";

export const productLocaleSchema = z.object({
  country: z.enum(SUPPORTED_COUNTRY_CODES as [string, ...string[]]),
  productUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url("Must be a valid URL").max(1000).optional().nullable()),
});

/**
 * Deliberately does NOT include `i18n` — same reasoning as storeSchema/
 * couponSchema: owned exclusively by the Country Customization page's own
 * action, validated directly against productLocaleSchema. Including it here
 * would mean a normal Product edit silently wipes it back to `[]`.
 */
export const productSchema = z.object({
  store: z.string().min(1, "Store is required"),
  name: z.string().min(1, "Name is required").max(200),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().max(5000).optional().default(""),
  image: z.string().url("Must be a valid URL"),
  price: z.coerce.number().min(0),
  originalPrice: z.coerce.number().min(0).optional().nullable(),
  productUrl: z.string().url("Must be a valid URL").max(1000),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
