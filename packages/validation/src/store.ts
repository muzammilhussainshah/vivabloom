import { z } from "zod";
import { slugSchema } from "./category";
import { SUPPORTED_COUNTRY_CODES } from "./countries";

export const faqSchema = z.object({
  question: z.string().min(1, "Question is required").max(300),
  answer: z.string().min(1, "Answer is required").max(1000),
  sortOrder: z.coerce.number().int().default(0),
});

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const storeOfferSchema = z.object({
  mechanic: z.preprocess(emptyToUndefined, z.enum(["link", "code", "popup"]).optional().nullable()),
  code: z.string().max(100).optional().nullable(),
  affiliateUrl: z.preprocess(emptyToUndefined, z.string().url("Must be a valid URL").max(1000).optional().nullable()),
  discountLabel: z.string().max(30).optional().nullable(),
  discountSuffix: z.string().max(60).optional().nullable(),
  offerSubline: z.string().max(200).optional().nullable(),
  lede: z.string().max(500).optional().nullable(),
  verifiedDate: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  nextCheckDate: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  verifierName: z.string().max(100).optional().nullable(),
  usageCount: z.string().max(60).optional().nullable(),
  trustChecks: z.array(z.string().max(80)).max(4).default([]),
  notOffered: z.array(z.string().max(120)).max(4).default([]),
  proofScreenshots: z.array(z.string().url()).max(3).default([]),
});

export const storeLocaleOfferSchema = z.object({
  country: z.enum(SUPPORTED_COUNTRY_CODES as [string, ...string[]]),
  mechanic: z.preprocess(emptyToUndefined, z.enum(["link", "code", "popup"]).optional().nullable()),
  code: z.string().max(100).optional().nullable(),
  affiliateUrl: z.preprocess(emptyToUndefined, z.string().url("Must be a valid URL").max(1000).optional().nullable()),
  discountLabel: z.string().max(30).optional().nullable(),
  discountSuffix: z.string().max(60).optional().nullable(),
  offerSubline: z.string().max(200).optional().nullable(),
  lede: z.string().max(500).optional().nullable(),
  verifiedDate: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  nextCheckDate: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  verifierName: z.string().max(100).optional().nullable(),
  usageCount: z.string().max(60).optional().nullable(),
  trustChecks: z.array(z.string().max(80)).max(4).default([]),
  notOffered: z.array(z.string().max(120)).max(4).default([]),
  faqs: z.array(faqSchema).default([]),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
});

/**
 * Deliberately does NOT include `i18n` — that field is owned exclusively by
 * the Country Customization page's own dedicated action (see
 * apps/admin/app/(dashboard)/country-customization/actions.ts), which
 * validates each entry directly against storeLocaleOfferSchema and writes it
 * with `store.set("i18n", ...)`, never through this full-document schema.
 * Including it here would mean a normal Store edit (which never submits
 * i18n) silently wipes every country's saved content back to `[]` via the
 * `offer.default({})`-style Object.assign in stores/actions.ts's updateStore.
 */
export const storeSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  slug: slugSchema,
  logo: z.string().url("Must be a valid URL").max(1000).optional().nullable().or(z.literal("")),
  description: z.string().max(3000).optional().default(""),
  shortDescription: z.string().max(300).optional().default(""),
  categories: z.array(z.string()).default([]),
  websiteUrl: z.string().url("Must be a valid URL").max(1000),
  faqs: z.array(faqSchema).default([]),
  offer: storeOfferSchema.default({}),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  rating: z.coerce.number().min(0).max(5).default(0),
});

export type StoreInput = z.infer<typeof storeSchema>;
export type FaqInput = z.infer<typeof faqSchema>;
export type StoreOfferInput = z.infer<typeof storeOfferSchema>;
export type StoreLocaleOfferInput = z.infer<typeof storeLocaleOfferSchema>;
