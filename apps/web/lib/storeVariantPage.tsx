import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getAllStoreSlugs, getStoreDetail, getCachedSiteSettings, getStoreSlugRedirect } from "@/lib/data";
import { StoreDetailViewV2 } from "@/components/store/StoreDetailViewV2";
import { type StoreVariantKey } from "@/lib/storeVariants";
import { getDictionary } from "@/lib/i18n";
import { SUPPORTED_COUNTRY_CODES } from "@monocoupon/validation";
import { toQueryString } from "@/lib/url";

/**
 * Builds the generateStaticParams/generateMetadata/page trio for one PPC
 * landing-page variant of /stores/[slug] (e.g. /never-pay-full/[slug]).
 * Each variant route file is just a few lines calling this with its own key
 * — see app/(store)/never-pay-full/[slug]/page.tsx for an example.
 *
 * These pages are noindex with a canonical pointing back at /stores/[slug]
 * (or /{country}/stores/[slug] for the localized ones, see
 * makeLocalizedStoreVariantPage below): indexing them as-is (identical
 * content behind different URLs) would create duplicate content that could
 * dilute the canonical page's search ranking. They still work normally for
 * real visitors and paid-ad traffic. On-page, each variant renders the same
 * StoreDetailViewV2 as the canonical route plus one differentiating line
 * (dict.variants[variant].tagline, threaded through as StoreHero's
 * `tagline` prop) — required so these read as more than identical pages
 * behind different URLs, per Google Ads sitelink policy.
 */
export function makeStoreVariantPage(variant: StoreVariantKey) {
  const dict = getDictionary(null);
  const config = dict.variants[variant];

  async function generateStaticParams() {
    const slugs = await getAllStoreSlugs();
    return slugs.map((slug) => ({ slug }));
  }

  async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const data = await getStoreDetail(slug);
    if (!data) return { title: "Store not found" };
    return {
      title: config.metaTitle(data.store.name),
      description: config.metaDescription(data.store.name),
      alternates: { canonical: `/stores/${slug}` },
      robots: { index: false, follow: true },
    };
  }

  async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }) {
    const { slug } = await params;
    const data = await getStoreDetail(slug);
    if (!data) {
      const newSlug = await getStoreSlugRedirect(slug);
      if (newSlug) permanentRedirect(`/${variant}/${newSlug}${toQueryString(await searchParams)}`);
      notFound();
    }
    const { store, coupons, products, bundles, relatedPosts } = data;
    const settings = await getCachedSiteSettings();

    return (
      <StoreDetailViewV2
        store={store}
        coupons={coupons}
        products={products}
        bundles={bundles}
        relatedPosts={relatedPosts}
        tagline={config.tagline(store.name)}
        googleAdsConversionId={settings.integrations.googleAdsConversionId}
        googleAdsConversionLabel={settings.integrations.googleAdsConversionLabel}
      />
    );
  }

  return { generateStaticParams, generateMetadata, Page };
}

/**
 * Country-prefixed sibling of makeStoreVariantPage above — same variant
 * (e.g. /it/never-pay-full/[slug]), rendered in the country's language via
 * getDictionary(country) (see apps/web/lib/i18n) and StoreDetailViewV2's own
 * `country` prop (which resolves store-specific content overrides in
 * Store.i18n through deriveOffer — see offerContent.ts). Always noindex,
 * same as the English variants — canonical points at this country's
 * canonical store page (/{country}/stores/[slug]), never back to English,
 * so Google attributes this content to the right language's canonical
 * rather than collapsing it into the English one.
 */
export function makeLocalizedStoreVariantPage(variant: StoreVariantKey) {
  async function generateStaticParams() {
    const slugs = await getAllStoreSlugs();
    return SUPPORTED_COUNTRY_CODES.flatMap((country) => slugs.map((slug) => ({ country, slug })));
  }

  async function generateMetadata({ params }: { params: Promise<{ country: string; slug: string }> }): Promise<Metadata> {
    const { country, slug } = await params;
    const data = await getStoreDetail(slug);
    if (!data) return { title: "Store not found" };
    const config = getDictionary(country).variants[variant];
    return {
      title: config.metaTitle(data.store.name),
      description: config.metaDescription(data.store.name),
      alternates: { canonical: `/${country}/stores/${slug}` },
      robots: { index: false, follow: true },
    };
  }

  async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ country: string; slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }) {
    const { country, slug } = await params;
    if (!SUPPORTED_COUNTRY_CODES.includes(country)) notFound();
    const data = await getStoreDetail(slug);
    if (!data) {
      const newSlug = await getStoreSlugRedirect(slug);
      if (newSlug) permanentRedirect(`/${country}/${variant}/${newSlug}${toQueryString(await searchParams)}`);
      notFound();
    }
    const { store, coupons, products, bundles, relatedPosts } = data;
    const settings = await getCachedSiteSettings();
    const config = getDictionary(country).variants[variant];

    return (
      <StoreDetailViewV2
        store={store}
        coupons={coupons}
        products={products}
        bundles={bundles}
        relatedPosts={relatedPosts}
        tagline={config.tagline(store.name)}
        country={country}
        googleAdsConversionId={settings.integrations.googleAdsConversionId}
        googleAdsConversionLabel={settings.integrations.googleAdsConversionLabel}
      />
    );
  }

  return { generateStaticParams, generateMetadata, Page };
}
