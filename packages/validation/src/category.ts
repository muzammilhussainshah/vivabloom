import { z } from "zod";

export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase, kebab-case (e.g. home-garden)");

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: slugSchema,
  description: z.string().max(1000).optional().default(""),
  icon: z.string().max(500).optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export type CategoryInput = z.infer<typeof categorySchema>;

/** Request body for POST /api/ai/suggest-category (admin "Generate by AI" panel on the Categories list). */
export const suggestCategorySchema = z.object({
  storeUrl: z.string().trim().min(1, "Store URL is required").url("Enter a valid URL (including https://)"),
});

export type SuggestCategoryInput = z.infer<typeof suggestCategorySchema>;
