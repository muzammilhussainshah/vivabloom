import { JsonLd } from "@/components/JsonLd";
import { BlogViewBeacon } from "@/components/BlogViewBeacon";
import { StoreHeader } from "./StoreHeader";
import { StoreHero } from "./StoreHero";
import { OfferVoucher } from "./OfferVoucher";
import { AllDealsSection } from "./AllDealsSection";
import { StickyMobileBar } from "./StickyMobileBar";
import { ProofStrip } from "./ProofStrip";
import { HonestyPanel } from "./HonestyPanel";
import { HowWeCheckFaq } from "./HowWeCheckFaq";
import { RelatedArticles } from "./RelatedArticles";
import { EmptyOfferState, type AlternativeDeal } from "./EmptyOfferState";
import { StoreFooter } from "./StoreFooter";
import { StoreActionsProvider } from "./StoreActions";
import { resolveEmptyHeaderText, resolveStoreText } from "./storeText";
import { deriveOffer } from "@/lib/offerContent";
import { getDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, faqPageJsonLd, storeOffersJsonLd } from "@/lib/seo";
import { getCachedSiteSettings, getDealsIndex } from "@/lib/data";
import { resolveSiteName } from "@/lib/brand";
import { getSupportedCountry } from "@monocoupon/validation/countries";
import type { StoreCard, CouponCard, ProductCard as ProductCardData, BundleCard as BundleCardData, BlogPostCard } from "@/lib/data";

/**
 * The full store-page-redesign UI — one verified offer, presented as a
 * scratch-off voucher, backed by proof screenshots, an honesty panel, and a
 * mechanic-aware hand-off flow. Replaces StoreDetailView for the canonical
 * /stores/[slug] route and its 6 PPC-sitelink variants (all render this same
 * component — see design_handoff_store_page/README.md: the redesign's <h1>
 * lives inside the voucher and must be the store name + discount, so unlike
 * the old page there's no separate per-variant marketing headline to render;
 * the variants still differ in <head> metaTitle/metaDescription only).
 *
 * A server component — this is the paid-campaign landing page, so it ships as
 * little JavaScript as possible. Offer derivation, the i18n dictionaries
 * (templated strings are resolved here, see storeText.ts), JSON-LD and the
 * static sections never reach the browser. The interactive widgets (header
 * CTA, voucher, product tiles, All Deals, FAQ accordion, sticky bar) are
 * client islands that get their click handlers from StoreActionsProvider,
 * which also owns tracking and the "welcome back" handoff modal.
 */
export async function StoreDetailViewV2({
  store,
  coupons,
  products,
  bundles,
  relatedPosts,
  tagline,
  country,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  store: StoreCard;
  coupons: CouponCard[];
  products: ProductCardData[];
  bundles: BundleCardData[];
  relatedPosts: BlogPostCard[];
  /** Set only by the 6 PPC-sitelink variant routes (storeVariantPage.tsx) — undefined on the canonical /stores/[slug] route. */
  tagline?: string;
  /** Set only by the country-prefixed routes (/{country}/stores/[slug] and its variants) — undefined (English) on the unprefixed routes. Resolves both the UI-chrome dictionary and any Store.i18n content override for this store (see deriveOffer in offerContent.ts). */
  country?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  const dict = getDictionary(country);
  const siteName = resolveSiteName((await getCachedSiteSettings()).siteName);
  const offer = deriveOffer(store, store.offer, coupons[0] ?? null, store.websiteUrl ?? "", country, siteName);
  const storePath = country ? `/${country}/stores/${store.slug}` : `/stores/${store.slug}`;

  if (!offer.hasOffer) {
    // Up to 3 other stores with a verified offer, same eligibility rules as /deals.
    const { entries } = await getDealsIndex();
    const alternatives: AlternativeDeal[] = entries
      .filter((e) => e.store.slug !== store.slug)
      .map((e) => ({ e, o: deriveOffer(e.store, e.store.offer, e.coupon, e.store.websiteUrl ?? "", country, siteName) }))
      .filter(({ o }) => o.hasOffer)
      .slice(0, 3)
      .map(({ e, o }) => ({
        href: country ? `/${country}/stores/${e.store.slug}` : `/stores/${e.store.slug}`,
        name: e.store.name,
        logo: e.store.logo,
        monogramLetter: o.monogramLetter,
        category: e.store.categories?.[0]?.name ?? null,
        discountLabel: o.discountLabel,
        discountSuffix: o.discountSuffix,
      }));

    return (
      // min-h-dvh: a short page still fills the screen, so the footer sits at the bottom instead of leaving blank space under it.
      <div className="flex min-h-dvh flex-col">
        <StoreHeader storeName={store.name} offer={null} dict={resolveEmptyHeaderText(dict.storeHeader)} />
        <EmptyOfferState
          storeName={store.name}
          storeLogo={store.logo}
          monogramLetter={offer.monogramLetter}
          alternatives={alternatives}
          dict={dict.emptyOffer}
        />
        <StoreFooter dict={dict.footer} siteName={siteName} />
      </div>
    );
  }

  const text = resolveStoreText(dict, store.name, offer, coupons.length);
  const primaryCouponId = coupons[0]?._id ?? null;
  const offerTitle = `${offer.discountLabel} ${offer.discountSuffix}`;
  const headerOffer = {
    discountLabel: offer.discountLabel,
    discountSuffix: offer.discountSuffix,
    verifiedDateShort: offer.verifiedDateShort,
    affiliateUrl: offer.affiliateUrl,
    storeSlug: store.slug,
    couponId: primaryCouponId,
    couponCode: offer.code,
  };

  return (
    <StoreActionsProvider
      storeSlug={store.slug}
      storeName={store.name}
      storeLogo={store.logo}
      monogramLetter={offer.monogramLetter}
      country={country}
      languageCode={country ? (getSupportedCountry(country)?.languageCode ?? "en") : "en"}
      googleAdsConversionId={googleAdsConversionId}
      googleAdsConversionLabel={googleAdsConversionLabel}
      primaryCouponId={primaryCouponId}
      offer={{ code: offer.code, affiliateUrl: offer.affiliateUrl, title: offerTitle, description: offer.offerSubline }}
      coupons={coupons.map((c) => ({ _id: c._id, title: c.title, description: c.description }))}
      bundles={bundles}
      products={products}
    >
      <div>
        <StoreHeader storeName={store.name} offer={headerOffer} dict={text.header} />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: dict.storeHero.home, path: "/" },
            { name: store.name, path: storePath },
          ])}
        />
        <JsonLd data={storeOffersJsonLd(store, [{ title: offerTitle, description: offer.offerSubline ?? undefined, expiryDate: null }])} />
        {store.faqs && store.faqs.length > 0 && <JsonLd data={faqPageJsonLd(store.faqs)} />}
        {store.categories?.map((category) => (
          <BlogViewBeacon key={category._id} type="category" id={category._id} />
        ))}

        <StoreHero
          storeName={store.name}
          storeLogo={store.logo}
          monogramLetter={offer.monogramLetter}
          categoryName={store.categories?.[0]?.name}
          tagline={tagline}
          offer={offer}
          products={products}
          bundles={bundles}
          dict={text.hero}
          country={country}
          voucher={
            <OfferVoucher
              storeName={store.name}
              storeLogo={store.logo}
              monogramLetter={offer.monogramLetter}
              offer={offer}
              storeSlug={store.slug}
              couponId={primaryCouponId}
              dict={text.offerVoucher}
            />
          }
        />

        <AllDealsSection coupons={coupons} storeName={store.name} storeSlug={store.slug} dict={text.allDeals} country={country} />

        <ProofStrip offer={offer} storeName={store.name} dict={dict.proof} />
        <HonestyPanel offer={offer} storeName={store.name} dict={dict.honesty} />
        <div id="how-we-check" style={{ scrollMarginTop: "80px" }}>
          <HowWeCheckFaq faqs={store.faqs ?? []} dict={dict.howWeCheck} />
        </div>
        <RelatedArticles posts={relatedPosts} dict={dict.relatedArticles} />

        <StickyMobileBar offer={offer} dict={text.stickyMobileBar} />

        <StoreFooter dict={dict.footer} siteName={siteName} clearStickyBar />
      </div>
    </StoreActionsProvider>
  );
}
