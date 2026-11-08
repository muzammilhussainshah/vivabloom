import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getAllStoreSlugs, getStoreDetail, getCachedSiteSettings, getStoreSlugRedirect } from "@/lib/data";
import { StoreDetailViewV2 } from "@/components/store/StoreDetailViewV2";
import { getDictionary } from "@/lib/i18n";
import { buildStoreLanguageAlternates } from "@/lib/storeLocaleAlternates";
import { SUPPORTED_COUNTRY_CODES } from "@monocoupon/validation";
import { toQueryString } from "@/lib/url";

/**
 * Country-prefixed sibling of ../../stores/[slug]/page.tsx (e.g.
 * /it/stores/engwe) — same 24h ISR window, same data, rendered in the
 * country's language via getDictionary(country) and any Store.i18n content
 * override for this specific store (see deriveOffer in offerContent.ts).
 *
 * generateStaticParams covers every (country x store) combination — every
 * store gets a valid page in every supported country from day one, since
 * deriveOffer's field-by-field fallback to English guarantees there's never
 * a blank/broken render, even for a store with zero authored i18n content.
 * Indexability is gated separately below (see `robots`) so a country with no
 * authored content for this store doesn't compete with the English page in
 * search — it still renders and works fine for direct/PPC traffic either way.
 */
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getAllStoreSlugs();
  return SUPPORTED_COUNTRY_CODES.flatMap((country) => slugs.map((slug) => ({ country, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; slug: string }>;
}): Promise<Metadata> {
  const { country, slug } = await params;
  if (!SUPPORTED_COUNTRY_CODES.includes(country)) notFound();
  const data = await getStoreDetail(slug);
  if (!data) return { title: "Store not found" };
  const dict = getDictionary(country);
  // Indexable only once this store has at least one authored field for this
  // country — otherwise the page is 100% English-fallback content wrapped in
  // translated chrome, which is too thin to compete for search ranking (see
  // [[store-page-i18n-landscape]]'s Step 7 discussion). Still renders and
  // works normally for direct/PPC traffic either way.
  const hasLocalContent = data.store.i18n?.some((entry) => entry.country === country) ?? false;
  return {
    title: dict.canonicalMetaTitle(data.store.name),
    alternates: { canonical: `/${country}/stores/${slug}`, languages: buildStoreLanguageAlternates(slug) },
    robots: { index: hasLocalContent, follow: true },
  };
}

export default async function LocalizedStorePage({
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
    if (newSlug) permanentRedirect(`/${country}/stores/${newSlug}${toQueryString(await searchParams)}`);
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
      country={country}
      googleAdsConversionId={settings.integrations.googleAdsConversionId}
      googleAdsConversionLabel={settings.integrations.googleAdsConversionLabel}
    />
  );
}
