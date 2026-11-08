import { z } from "zod";
import { isBlogCountry } from "./blogCountries";

export const generateBlogTopicsSchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
  /** Lowercase BLOG_COUNTRIES code, or omitted/empty for country-agnostic topics. */
  country: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined))
    .refine((v) => v === undefined || isBlogCountry(v), "Unsupported country"),
});

export type GenerateBlogTopicsInput = z.infer<typeof generateBlogTopicsSchema>;
