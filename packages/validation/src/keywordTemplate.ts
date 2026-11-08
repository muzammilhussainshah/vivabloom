import { z } from "zod";
import { slugSchema } from "./category";

function linesFromText(value: unknown): string[] {
  const text = typeof value === "string" ? value : "";
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function tokensFromText(value: unknown): string[] {
  const text = typeof value === "string" ? value : "";
  return text
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

export const keywordTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: slugSchema,
  brandTokens: z.preprocess(tokensFromText, z.array(z.string()).min(1, "At least one brand token is required")),
  brandName: z.string().trim().toLowerCase().default(""),
  brandDescriptor: z.string().trim().toLowerCase().default(""),
  keywords: z.preprocess(linesFromText, z.array(z.string()).min(1, "At least one keyword is required")),
  negativeKeywords: z.preprocess(linesFromText, z.array(z.string()).default([])),
});

export type KeywordTemplateInput = z.infer<typeof keywordTemplateSchema>;
