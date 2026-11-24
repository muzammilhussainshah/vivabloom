import { z } from "zod";

/**
 * Store Checker (admin "AI Intelligence" section): researches whether a store
 * is safe to promote as an affiliate and which of its products look most
 * promising. Input schemas for the admin API routes, plus the schemas the
 * AI's JSON replies are validated against — every AI field is lenient
 * (`.catch`) so one malformed field degrades to "unknown" instead of failing
 * the whole step.
 */

/** Markets offered in the Store Checker / Find Stores UI. Separate from SUPPORTED_COUNTRIES (site i18n) and BLOG_COUNTRIES. */
export const RESEARCH_COUNTRIES = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "ae", name: "UAE" },
  { code: "sa", name: "Saudi Arabia" },
  { code: "it", name: "Italy" },
  { code: "es", name: "Spain" },
  { code: "nl", name: "Netherlands" },
  { code: "ie", name: "Ireland" },
  { code: "nz", name: "New Zealand" },
] as const;

export const RESEARCH_CATEGORIES = [
  "Health & Wellness",
  "Supplements",
  "Beauty & Skincare",
  "Electronics",
  "Home & Kitchen",
  "Fashion",
  "Fitness",
  "Pet Products",
  "Baby Products",
  "Lifestyle",
  "Food & Drink",
  "Jewelry & Accessories",
  "Outdoor & Travel",
] as const;

export function getResearchCountry(code?: string | null) {
  return code ? RESEARCH_COUNTRIES.find((c) => c.code === code) : undefined;
}

export const STORE_CHECK_STEPS = ["identity", "program", "reputation", "products"] as const;
export type StoreCheckStep = (typeof STORE_CHECK_STEPS)[number];

/**
 * The affiliate-terms rules checked for every store. Kept to the rules that
 * decide whether a coupon site running Google Search ads on brand + coupon
 * keywords can promote the store at all.
 */
export const POLICY_KEYS = [
  "paid_search",
  "brand_bidding",
  "brand_coupon_keywords",
  "trademark_in_ads",
  "coupon_sites",
  "direct_linking",
] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export const POLICY_STATUSES = ["allowed", "prohibited", "restricted", "requires_approval", "unknown"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

const countryCode = z
  .string()
  .trim()
  .toLowerCase()
  .refine((c) => RESEARCH_COUNTRIES.some((r) => r.code === c), "Unsupported country");

export const startStoreCheckSchema = z.object({
  query: z.string().trim().min(2, "Enter a store link or brand name").max(2000),
  country: countryCode.nullable().optional(),
  category: z.string().trim().min(2).max(60).nullable().optional(),
  force: z.boolean().optional(),
});

/** Archive/restore a store and/or change its category. */
export const updateStoreCheckSchema = z
  .object({
    archived: z.boolean().optional(),
    category: z.string().trim().max(60).nullable().optional(),
  })
  .refine((v) => v.archived !== undefined || v.category !== undefined, "Nothing to update");

export const discoverStoresSchema = z.object({
  country: countryCode,
  category: z.string().trim().min(2).max(60),
  keyword: z.string().trim().max(80).optional().nullable(),
  force: z.boolean().optional(),
});

/* ---------- AI reply schemas ---------- */

const quote = z.string().max(600).nullable().catch(null);
const sourceIndex = z.coerce.number().int().min(0).max(99).nullable().catch(null);
const textField = z
  .object({ value: z.string().max(300).nullable().catch(null), quote, source: sourceIndex })
  .nullable()
  .catch(null);

export const programExtractionSchema = z.object({
  programFound: z.enum(["yes", "no", "unclear"]).catch("unclear"),
  programActive: z.enum(["yes", "no", "unclear"]).catch("unclear"),
  network: textField,
  applicationUrl: z.string().max(500).nullable().catch(null),
  commission: z
    .object({
      value: z.string().max(200).nullable().catch(null),
      type: z.enum(["percentage", "fixed", "tiered", "unknown"]).catch("unknown"),
      rateMin: z.coerce.number().min(0).max(100).nullable().catch(null),
      rateMax: z.coerce.number().min(0).max(100).nullable().catch(null),
      fixedAmount: z.coerce.number().min(0).nullable().catch(null),
      quote,
      source: sourceIndex,
    })
    .nullable()
    .catch(null),
  cookieDays: z
    .object({ value: z.coerce.number().int().min(0).max(3650).nullable().catch(null), quote, source: sourceIndex })
    .nullable()
    .catch(null),
  payoutThreshold: textField,
  payoutSchedule: textField,
  paymentMethods: textField,
  validationPeriod: textField,
  approvalRequirements: textField,
  policies: z
    .array(
      z.object({
        key: z.string(),
        status: z.enum(POLICY_STATUSES).catch("unknown"),
        quote,
        source: sourceIndex,
        explanation: z.string().max(400).catch(""),
      })
    )
    .catch([]),
  notes: z.array(z.string().max(300)).max(6).catch([]),
});
export type ProgramExtraction = z.infer<typeof programExtractionSchema>;

export const REPUTATION_KINDS = [
  "affiliate_unpaid",
  "affiliate_terminated",
  "affiliate_reversal",
  "affiliate_delay",
  "affiliate_positive",
  "customer_complaint",
  "customer_positive",
  "scam_warning",
  "irrelevant",
] as const;
export type ReputationKind = (typeof REPUTATION_KINDS)[number];

export const reputationExtractionSchema = z.object({
  items: z
    .array(
      z.object({
        index: z.coerce.number().int().min(0),
        kind: z.enum(REPUTATION_KINDS).catch("irrelevant"),
        summary: z.string().max(400).catch(""),
        quote,
        date: z.string().max(40).nullable().catch(null),
      })
    )
    .catch([]),
  customerRating: z
    .object({
      value: z.coerce.number().min(0).max(10).nullable().catch(null),
      scale: z.coerce.number().min(1).max(10).nullable().catch(null),
      count: z.coerce.number().int().min(0).nullable().catch(null),
      platform: z.string().max(60).nullable().catch(null),
      index: z.coerce.number().int().min(0).nullable().catch(null),
      quote,
    })
    .nullable()
    .catch(null),
});
export type ReputationExtraction = z.infer<typeof reputationExtractionSchema>;

const shortList = z.array(z.string().max(240)).max(5).catch([]);
export const productExplanationSchema = z.object({
  products: z
    .array(
      z.object({
        id: z.string(),
        why: z.string().max(500).catch(""),
        strengths: shortList,
        risks: shortList,
        adAngle: z.string().max(300).catch(""),
        audience: z.string().max(240).catch(""),
        keywordIdeas: z.array(z.string().max(80)).max(8).catch([]),
      })
    )
    .catch([]),
});
export type ProductExplanation = z.infer<typeof productExplanationSchema>;

export const discoveryExtractionSchema = z.object({
  brands: z
    .array(
      z.object({
        name: z.string().max(120),
        domain: z.string().max(120).nullable().catch(null),
        source: sourceIndex,
        quote,
        /** Exact words from the source showing THIS brand runs an affiliate/partner program. */
        programQuote: quote,
        note: z.string().max(240).nullable().catch(null),
      })
    )
    .catch([]),
});
export type DiscoveryExtraction = z.infer<typeof discoveryExtractionSchema>;

/** Program terms the admin pasted (e.g. copied from a network dashboard that needs a login). */
export const pastedTermsSchema = z.object({
  text: z.string().trim().min(200, "Paste the full terms (at least a few paragraphs).").max(80_000, "That's too long — paste just the program terms."),
});
