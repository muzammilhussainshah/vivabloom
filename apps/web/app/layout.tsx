import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Fraunces, Fredoka } from "next/font/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { Analytics, GtmNoScript } from "@/components/Analytics";
import { PageviewTracker } from "@/components/PageviewTracker";
import { SITE_URL } from "@/lib/seo";
import { getCachedSiteSettings } from "@/lib/data";
import { darkenHex } from "@/lib/color";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display face for the hero headline ("Read. Learn. Grow."), script
// face for the logo wordmark — both exposed as CSS vars for Tailwind's
// font-serif / font-script utilities (see globals.css @theme).
const playfair = Fraunces({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const pacifico = Fredoka({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "VivaBloom — Verified Coupon Codes & Deals", template: "%s | VivaBloom" },
  description: "Verified coupon codes, promo codes, and deals for your favorite online stores.",
  alternates: { canonical: "/" },
};

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
  const contactEmail = settings.contact.email || "hello@monocoupon.com";

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.siteName || "VivaBloom",
    legalName: "Faliha Limited",
    url: SITE_URL,
    description:
      settings.heroDescription ||
      "Verified coupon codes, promo codes, and deals for your favorite online stores.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Office 1877, 85 Dunstall Hill",
      addressLocality: "Wolverhampton",
      postalCode: "WV6 0SR",
      addressCountry: "GB",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: contactEmail,
      telephone: settings.contact.phone || "+447728915929",
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
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${pacifico.variable} h-full antialiased`}
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
        {children}
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
        <VercelAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
