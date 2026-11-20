import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Fraunces } from "next/font/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { Analytics, GtmNoScript } from "@/components/Analytics";
import { PageviewTracker } from "@/components/PageviewTracker";
import { SITE_URL } from "@/lib/seo";
import { getCachedSiteSettings } from "@/lib/data";
import { darkenHex } from "@/lib/color";
import { resolveSiteName } from "@/lib/brand";
import { SiteNameProvider } from "@/components/SiteNameProvider";

// Body face for the (site) pages. preload: false because the store pages —
// the paid-campaign landing pages, where every KB on the critical path costs
// conversions — never render text in Geist (app/(store)/layout.tsx sets its
// own Figtree), yet a preload here would still download it there. On (site)
// pages it costs at most a brief fallback->Geist swap; next/font's
// metric-matched fallback keeps that from shifting layout.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

// Serif display face for headings and the logo wordmark (exposed for
// Tailwind's font-serif via globals.css @theme). Same variable font file as
// the store pages' serif (lib/storeFonts.ts), so it's only downloaded once.
// (Geist Mono and Fredoka used to be loaded here too but nothing rendered in
// either — they were dropped because every page was preloading them.)
const playfair = Fraunces({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Title brand comes from the admin's Site Settings (siteName), so renaming
// the site there updates every page's <title> without a code change.
export async function generateMetadata(): Promise<Metadata> {
  const siteName = resolveSiteName((await getCachedSiteSettings()).siteName);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${siteName} — Verified Coupon Codes & Deals`, template: `%s | ${siteName}` },
    description: "Verified coupon codes, promo codes, and deals for your favorite online stores.",
    alternates: { canonical: "/" },
  };
}

// viewportFit: "cover" lets the page draw into the safe-area insets on
// notched/gesture-bar phones (iPhones) instead of the browser leaving that
// strip as blank native chrome. Needed for the store pages' sticky mobile
// CTA bar to paint its own background all the way to the true screen edge
// (see StickyMobileBar.tsx's safe-area padding) rather than showing a
// mismatched blank gap below it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getCachedSiteSettings();
  const contactEmail = settings.contact.email || "vivabloom2@gmail.com";
  const siteName = resolveSiteName(settings.siteName);

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    legalName: "AppMash Limited",
    url: SITE_URL,
    description:
      settings.heroDescription ||
      "Verified coupon codes, promo codes, and deals for your favorite online stores.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Office 875, 55 Gracechurch Street",
      addressLocality: "London",
      postalCode: "EC3V 0HR",
      addressCountry: "GB",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: contactEmail,
      ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
      contactType: "customer service",
    },
  };

  // Set directly on <html> (which *is* :root) as an inline style attribute
  // instead of a child <style> tag in <head>. Browser extensions (ad
  // blockers especially) commonly inject their own <style> tags into <head>
  // before React hydrates, which shifts sibling positions and trips React's
  // hydration diff — an inline attribute on an existing element sidesteps
  // that DOM-node contest entirely rather than just suppressing the warning.
  //
  // Once an admin customizes these, they apply everywhere (including
  // overriding the OS dark-mode media query in tokens.css, since an inline
  // style always wins the cascade) — a deliberate choice so a configured
  // brand look stays consistent rather than silently reverting in dark mode.
  // Hover shades are derived rather than admin-editable, so they always
  // stay in sync with whatever base color is picked.
  const themeStyle = {
    "--brand-primary": settings.themeTokens.brandPrimary,
    "--brand-primary-hover": darkenHex(settings.themeTokens.brandPrimary, 0.15),
    "--brand-secondary": settings.themeTokens.brandSecondary,
    "--brand-secondary-hover": darkenHex(settings.themeTokens.brandSecondary, 0.15),
    "--brand-accent": settings.themeTokens.brandAccent,
    "--brand-accent-hover": darkenHex(settings.themeTokens.brandAccent, 0.15),
    "--surface": settings.themeTokens.surface,
    "--surface-muted": settings.themeTokens.surfaceMuted,
    "--text": settings.themeTokens.text,
    "--text-muted": settings.themeTokens.textMuted,
    "--border": settings.themeTokens.border,
    "--footer-bg": settings.themeTokens.footerBg,
  } as React.CSSProperties;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}
      style={themeStyle}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Analytics
          ga4Id={settings.integrations.ga4Id}
          gtmId={settings.integrations.gtmId}
          googleAdsConversionId={settings.integrations.googleAdsConversionId}
          clarityId={settings.integrations.clarityId}
        />
        <GtmNoScript gtmId={settings.integrations.gtmId} />
        <JsonLd data={organizationJsonLd} />
        <SiteNameProvider name={siteName}>{children}</SiteNameProvider>
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
        <VercelAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
