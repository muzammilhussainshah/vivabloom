import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color, e.g. #6d28d9");

export const siteSettingSchema = z.object({
  siteName: z.string().min(1).max(100).default("VivaBloom"),
  logoUrl: z.string().url().max(1000).optional().nullable().or(z.literal("")),
  tagline: z.string().max(300).optional().default(""),
  heroOverline: z.string().max(200).optional().default(""),
  heroDescription: z.string().max(600).optional().default(""),
  heroImage: z.string().url().max(1000).optional().nullable().or(z.literal("")),
  brandPrimary: hexColor,
  brandSecondary: hexColor,
  brandAccent: hexColor,
  surface: hexColor,
  surfaceMuted: hexColor,
  text: hexColor,
  textMuted: hexColor,
  border: hexColor,
  footerBg: hexColor,
  contactEmail: z.string().email().optional().nullable().or(z.literal("")),
  contactPhone: z.string().max(50).optional().nullable().or(z.literal("")),
  contactAddress: z.string().max(300).optional().nullable().or(z.literal("")),
  socialFacebook: z.string().url().max(500).optional().nullable().or(z.literal("")),
  socialInstagram: z.string().url().max(500).optional().nullable().or(z.literal("")),
  socialYoutube: z.string().url().max(500).optional().nullable().or(z.literal("")),
  socialTiktok: z.string().url().max(500).optional().nullable().or(z.literal("")),
  socialDiscord: z.string().url().max(500).optional().nullable().or(z.literal("")),
  ga4Id: z.string().max(50).optional().nullable().or(z.literal("")),
  gtmId: z.string().max(50).optional().nullable().or(z.literal("")),
  googleAdsConversionId: z.string().max(50).optional().nullable().or(z.literal("")),
  googleAdsConversionLabel: z.string().max(50).optional().nullable().or(z.literal("")),
  clarityId: z.string().max(50).optional().nullable().or(z.literal("")),
  /** Comma-separated ISO 3166-1 alpha-2 codes, e.g. "PK, IN". Parsed into an array server-side. */
  blockedCountries: z.string().max(500).optional().default(""),
  /** IPv4/IPv6 addresses, one per line or comma-separated (pastes straight from the Suspicious tab's IP list). Parsed into an array server-side. */
  blockedIps: z.string().max(5000).optional().default(""),
});

export type SiteSettingInput = z.infer<typeof siteSettingSchema>;
