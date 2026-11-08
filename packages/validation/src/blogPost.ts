import { z } from "zod";
import { slugSchema } from "./category";
import { isBlogCountry } from "./blogCountries";

export const blogPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: slugSchema,
  excerpt: z.string().max(500).optional().default(""),
  content: z.string().min(1, "Content is required"),
  coverImage: z.string().url("Must be a valid URL").max(1000).optional().nullable().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  author: z.string().max(100).optional().default("VivaBloom"),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  publishedAt: z.string().optional().nullable().or(z.literal("")),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  ogImage: z.string().url("Must be a valid URL").max(1000).optional().nullable().or(z.literal("")),
  relatedStores: z.array(z.string()).default([]),
  aiTopic: z.string().max(300).optional().nullable().or(z.literal("")),
  aiProducts: z.array(z.string()).default([]),
  aiCountry: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || isBlogCountry(v), "Unsupported country"),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;
