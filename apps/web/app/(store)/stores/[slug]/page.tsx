import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getAllStoreSlugs, getStoreDetail, getCachedSiteSettings, getStoreSlugRedirect } from "@/lib/data";
import { StoreDetailViewV2 } from "@/components/store/StoreDetailViewV2";
import { getDictionary } from "@/lib/i18n";
import { buildStoreLanguageAlternates } from "@/lib/storeLocaleAlternates";
import { toQueryString } from "@/lib/url";

const dict = getDictionary(null);

// 24h ISR window. These pages change only via admin edits, which already
// bust the cache on-demand through /api/revalidate (see admin's
// revalidateWebPaths) — so a long timer is safe and keeps PPC landing pages
// warm at the iad1 origin, avoiding the multi-second cold on-demand render
// that a short window caused on sporadically-trafficked stores.
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getAllStoreSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoreDetail(slug);
  if (!data) return { title: "Store not found" };
  return {
    title: dict.canonicalMetaTitle(data.store.name),
    alternates: { canonical: `/stores/${slug}`, languages: buildStoreLanguageAlternates(slug) },
  };
}

export default async function StorePage({
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
    if (newSlug) permanentRedirect(`/stores/${newSlug}${toQueryString(await searchParams)}`);
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
      googleAdsConversionId={settings.integrations.googleAdsConversionId}
      googleAdsConversionLabel={settings.integrations.googleAdsConversionLabel}
    />
  );
}
