import type { Metadata } from "next";
import { connectToDatabase, getSiteSettings } from "@monocoupon/db";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Site Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await connectToDatabase();
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Site Settings</h1>
      <SettingsForm
        initialData={{
          siteName: settings.siteName ?? "VivaBloom",
          logoUrl: settings.logoUrl,
          tagline: settings.tagline ?? "",
          heroOverline: settings.heroOverline ?? "",
          heroDescription: settings.heroDescription ?? "",
          heroImage: settings.heroImage,
          brandPrimary: settings.themeTokens?.brandPrimary ?? "#7c6cf0",
          brandSecondary: settings.themeTokens?.brandSecondary ?? "#5b4bd5",
          brandAccent: settings.themeTokens?.brandAccent ?? "#c2379b",
          surface: settings.themeTokens?.surface ?? "#f7f8ff",
          surfaceMuted: settings.themeTokens?.surfaceMuted ?? "#ffffff",
          text: settings.themeTokens?.text ?? "#1e2440",
          textMuted: settings.themeTokens?.textMuted ?? "#6b7391",
          border: settings.themeTokens?.border ?? "#e4e8f5",
          footerBg: settings.themeTokens?.footerBg ?? "#1f1b3d",
          contactEmail: settings.contact?.email,
          contactPhone: settings.contact?.phone,
          contactAddress: settings.contact?.address,
          socialFacebook: settings.socialLinks?.facebook,
          socialInstagram: settings.socialLinks?.instagram,
          socialYoutube: settings.socialLinks?.youtube,
          socialTiktok: settings.socialLinks?.tiktok,
          socialDiscord: settings.socialLinks?.discord,
          ga4Id: settings.integrations?.ga4Id,
          gtmId: settings.integrations?.gtmId,
          googleAdsConversionId: settings.integrations?.googleAdsConversionId,
          googleAdsConversionLabel: settings.integrations?.googleAdsConversionLabel,
          clarityId: settings.integrations?.clarityId,
          blockedCountries: (settings.blockedCountries ?? []).join(", "),
          blockedIps: (settings.blockedIps ?? []).join("\n"),
        }}
      />
    </div>
  );
}
