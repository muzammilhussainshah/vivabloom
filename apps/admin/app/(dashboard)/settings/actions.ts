"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, SiteSetting } from "@monocoupon/db";
import { siteSettingSchema } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";
import { syncBlockedCountries } from "@/lib/blockedCountries";
import { syncBlockedIps } from "@/lib/blockedIps";

export type ActionState =
  | { error?: string; success?: boolean; blockedCountries?: string[]; blockedIps?: string[] }
  | undefined;

const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

/** Parses "PK, in,  us" into ["PK", "IN", "US"], deduped. Throws on any invalid code. */
function parseBlockedCountries(raw: string): string[] {
  const codes = raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const invalid = codes.find((c) => !COUNTRY_CODE_RE.test(c));
  if (invalid) {
    throw new Error(`"${invalid}" isn't a valid 2-letter country code (e.g. PK, IN, US)`);
  }
  return Array.from(new Set(codes));
}

/**
 * Parses a pasted block of IPs — one per line (matches the Suspicious tab's
 * "Copy IPs" format), comma-separated, or space-separated — into a deduped
 * array. Throws on any entry that isn't a plausible IPv4/IPv6 address.
 */
function parseBlockedIps(raw: string): string[] {
  const ips = raw
    .split(/[\s,]+/)
    .map((ip) => ip.trim())
    .filter(Boolean);

  const invalid = ips.find((ip) => !IPV4_RE.test(ip) && !IPV6_RE.test(ip));
  if (invalid) {
    throw new Error(`"${invalid}" isn't a valid IP address`);
  }
  return Array.from(new Set(ips));
}

function parseForm(formData: FormData) {
  return siteSettingSchema.safeParse({
    siteName: formData.get("siteName") || "VivaBloom",
    logoUrl: formData.get("logoUrl") || null,
    tagline: formData.get("tagline") ?? "",
    heroOverline: formData.get("heroOverline") ?? "",
    heroDescription: formData.get("heroDescription") ?? "",
    heroImage: formData.get("heroImage") || null,
    brandPrimary: formData.get("brandPrimary"),
    brandSecondary: formData.get("brandSecondary"),
    brandAccent: formData.get("brandAccent"),
    surface: formData.get("surface"),
    surfaceMuted: formData.get("surfaceMuted"),
    text: formData.get("text"),
    textMuted: formData.get("textMuted"),
    border: formData.get("border"),
    footerBg: formData.get("footerBg"),
    contactEmail: formData.get("contactEmail") || null,
    contactPhone: formData.get("contactPhone") || null,
    contactAddress: formData.get("contactAddress") || null,
    socialFacebook: formData.get("socialFacebook") || null,
    socialInstagram: formData.get("socialInstagram") || null,
    socialYoutube: formData.get("socialYoutube") || null,
    socialTiktok: formData.get("socialTiktok") || null,
    socialDiscord: formData.get("socialDiscord") || null,
    ga4Id: formData.get("ga4Id") || null,
    gtmId: formData.get("gtmId") || null,
    googleAdsConversionId: formData.get("googleAdsConversionId") || null,
    googleAdsConversionLabel: formData.get("googleAdsConversionLabel") || null,
    clarityId: formData.get("clarityId") || null,
    blockedCountries: formData.get("blockedCountries") ?? "",
    blockedIps: formData.get("blockedIps") ?? "",
  });
}

export async function updateSiteSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;
  let blockedCountries: string[];
  try {
    blockedCountries = parseBlockedCountries(d.blockedCountries);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid blocked countries" };
  }
  let blockedIps: string[];
  try {
    blockedIps = parseBlockedIps(d.blockedIps);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid blocked IPs" };
  }

  await connectToDatabase();
  await SiteSetting.findOneAndUpdate(
    { key: "main" },
    {
      key: "main",
      siteName: d.siteName,
      logoUrl: d.logoUrl || null,
      tagline: d.tagline,
      heroOverline: d.heroOverline,
      heroDescription: d.heroDescription,
      heroImage: d.heroImage || null,
      themeTokens: {
        brandPrimary: d.brandPrimary,
        brandSecondary: d.brandSecondary,
        brandAccent: d.brandAccent,
        surface: d.surface,
        surfaceMuted: d.surfaceMuted,
        text: d.text,
        textMuted: d.textMuted,
        border: d.border,
        footerBg: d.footerBg,
        radiusBase: "0.5rem",
      },
      contact: {
        email: d.contactEmail || null,
        phone: d.contactPhone || null,
        address: d.contactAddress || null,
      },
      socialLinks: {
        facebook: d.socialFacebook || null,
        instagram: d.socialInstagram || null,
        youtube: d.socialYoutube || null,
        tiktok: d.socialTiktok || null,
        discord: d.socialDiscord || null,
      },
      integrations: {
        ga4Id: d.ga4Id || null,
        gtmId: d.gtmId || null,
        googleAdsConversionId: d.googleAdsConversionId || null,
        googleAdsConversionLabel: d.googleAdsConversionLabel || null,
        clarityId: d.clarityId || null,
      },
      blockedCountries,
      blockedIps,
    },
    { upsert: true }
  );
  await syncBlockedCountries(blockedCountries);
  await syncBlockedIps(blockedIps);
  await logAudit("settings.update", { entityType: "SiteSetting", entityId: "main" });

  revalidatePath("/settings");
  await revalidateWebPaths([], { layout: true });
  // Echoed back so the form can sync its fields to the canonical, deduped
  // list that actually got saved — not just whatever raw text was typed.
  return { success: true, blockedCountries, blockedIps };
}
