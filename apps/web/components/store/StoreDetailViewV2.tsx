"use client";

import { useEffect, useRef, useState } from "react";
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
import { EmptyOfferState } from "./EmptyOfferState";
import { HandoffModal, type HandoffData } from "./HandoffModal";
import { StoreFooter } from "./StoreFooter";
import { copyCouponCode, trackCouponClick } from "@/lib/couponInteraction";
import { deriveOffer } from "@/lib/offerContent";
import { getDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, faqPageJsonLd, storeOffersJsonLd } from "@/lib/seo";
import { getSupportedCountry } from "@monocoupon/validation";
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
 */
export function StoreDetailViewV2({
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
  const offer = deriveOffer(store, store.offer, coupons[0] ?? null, store.websiteUrl ?? "", country);
  const storePath = country ? `/${country}/stores/${store.slug}` : `/stores/${store.slug}`;

  // Root layout's <html lang> is a static "en" — it can't read the current
  // route's country without forcing the whole site into dynamic rendering
  // (the same ISR-breaking gotcha app/(store)/layout.tsx documents for
  // params). This keeps the authoritative SEO signal (hreflang alternates,
  // set server-side in generateMetadata) correct in the raw HTML regardless,
  // while still fixing the attribute for screen readers/assistive tech,
  // which read the live DOM rather than the initial server response.
  useEffect(() => {
    const languageCode = country ? (getSupportedCountry(country)?.languageCode ?? "en") : "en";
    const previous = document.documentElement.lang;
    document.documentElement.lang = languageCode;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [country]);

  // The "welcome back" modal (HandoffModal.tsx): armed by any CTA below with
  // that CTA's own coupon data, then shown ~1s after this tab regains
  // visibility — not at the moment of the click, since the merchant tab just
  // opened and a modal fighting for attention on *this* tab while the
  // visitor is busy on the other one would just be in the way. `pendingRef`
  // holds an armed-but-not-yet-shown handoff; `wasHiddenRef` tracks whether
  // this tab has actually been backgrounded since arming, so an unrelated
  // visibility blip (or the initial arm itself) can't trigger it — only a
  // genuine hidden→visible round trip can.
  //
  // Shown every time: each CTA click re-arms it, and every genuine
  // hidden→visible round trip after that shows it again — no longer gated to
  // once per session, so a visitor who checks several coupons/products (each
  // in its own new tab) sees the handoff after each one, not just the first.
  const [handoffData, setHandoffData] = useState<HandoffData | null>(null);
  const pendingHandoffRef = useRef<HandoffData | null>(null);
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }
      if (wasHiddenRef.current && pendingHandoffRef.current) {
        const armed = pendingHandoffRef.current;
        pendingHandoffRef.current = null; // consume — an unrelated later tab switch shouldn't re-show it
        setTimeout(() => setHandoffData(armed), 1000);
      }
      wasHiddenRef.current = false;
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  function armHandoff(data: HandoffData) {
    pendingHandoffRef.current = data;
  }

  function handleCtaClick() {
    const meta = { storeSlug: store.slug, couponId: coupons[0]?._id ?? null, couponCode: offer.code, destinationUrl: offer.affiliateUrl };
    copyCouponCode(offer.code, meta);
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
    armHandoff({
      title: `${offer.discountLabel} ${offer.discountSuffix}`,
      description: offer.offerSubline,
      code: offer.code,
      affiliateUrl: offer.affiliateUrl,
      couponId: coupons[0]?._id ?? null,
    });
  }

  // The hero's click-confirmation strip shows products and bundles, not the
  // coupon itself — passing null/null deliberately skips the Ads conversion
  // ping here (only the actual coupon CTAs — voucher, nav bar, All Deals —
  // should count) while the affiliate_click engagement beacon still fires.
  function handleProductClick(url: string) {
    const meta = { storeSlug: store.slug, couponId: coupons[0]?._id ?? null, couponCode: offer.code, destinationUrl: url };
    copyCouponCode(offer.code, meta);
    trackCouponClick(null, null, meta);
    armHandoff({
      title: `${offer.discountLabel} ${offer.discountSuffix}`,
      description: offer.offerSubline,
      code: offer.code,
      affiliateUrl: url,
      couponId: coupons[0]?._id ?? null,
    });
  }

  // AllDealsSection copies each card's own code/link itself (via
  // copyCouponCode, scoped to that specific coupon) before calling this —
  // this only needs to fire the click/conversion tracking and arm the
  // handoff, not copy again. These cards are real coupon CTAs (not products
  // or bundles), so they count toward the Ads conversion same as the main
  // voucher and nav bar.
  function handleDealCtaClick(meta: { couponId: string; couponCode: string | null; destinationUrl: string }) {
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, { storeSlug: store.slug, ...meta });
    const coupon = coupons.find((c) => c._id === meta.couponId);
    armHandoff({
      title: coupon?.title ?? `${offer.discountLabel} ${offer.discountSuffix}`,
      description: coupon?.description,
      code: meta.couponCode,
      affiliateUrl: meta.destinationUrl,
      couponId: meta.couponId,
    });
  }

  const headerOffer = offer.hasOffer
    ? {
        discountLabel: offer.discountLabel,
        discountSuffix: offer.discountSuffix,
        verifiedDateShort: offer.verifiedDateShort,
        affiliateUrl: offer.affiliateUrl,
        storeSlug: store.slug,
        couponId: coupons[0]?._id ?? null,
        couponCode: offer.code,
      }
    : null;

  if (!offer.hasOffer) {
    return (
      <div>
        <StoreHeader storeName={store.name} offer={null} dict={dict.storeHeader} />
        <EmptyOfferState storeName={store.name} storeLogo={store.logo} monogramLetter={offer.monogramLetter} dict={dict.emptyOffer} />
        <StoreFooter dict={dict.footer} />
      </div>
    );
  }

  return (
    <div>
      <StoreHeader storeName={store.name} offer={headerOffer} dict={dict.storeHeader} onCtaClick={handleCtaClick} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: dict.storeHero.home, path: "/" },
          { name: store.name, path: storePath },
        ])}
      />
      <JsonLd
        data={storeOffersJsonLd(store, [
          { title: `${offer.discountLabel} ${offer.discountSuffix}`, description: offer.offerSubline ?? undefined, expiryDate: null },
        ])}
      />
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
        onProductClick={handleProductClick}
        dict={dict.storeHero}
        country={country}
        voucher={
          <OfferVoucher
            storeName={store.name}
            storeLogo={store.logo}
            monogramLetter={offer.monogramLetter}
            offer={offer}
            storeSlug={store.slug}
            couponId={coupons[0]?._id ?? null}
            onCtaClick={handleCtaClick}
            dict={dict.offerVoucher}
          />
        }
      />

      <AllDealsSection
        coupons={coupons}
        storeName={store.name}
        storeLogo={store.logo}
        monogramLetter={offer.monogramLetter}
        storeSlug={store.slug}
        onActivate={handleDealCtaClick}
        dict={dict.allDeals}
        country={country}
      />

      <ProofStrip offer={offer} storeName={store.name} dict={dict.proof} />
      <HonestyPanel offer={offer} storeName={store.name} dict={dict.honesty} />
      <div id="how-we-check" style={{ scrollMarginTop: "80px" }}>
        <HowWeCheckFaq faqs={store.faqs ?? []} dict={dict.howWeCheck} />
      </div>
      <RelatedArticles posts={relatedPosts} dict={dict.relatedArticles} />

      <StickyMobileBar offer={offer} onCtaClick={handleCtaClick} dict={dict.stickyMobileBar} />

      <HandoffModal
        data={handoffData}
        onClose={() => setHandoffData(null)}
        onReopen={armHandoff}
        storeName={store.name}
        storeLogo={store.logo}
        monogramLetter={offer.monogramLetter}
        storeSlug={store.slug}
        bundles={bundles}
        products={products}
        dict={dict.handoff}
        country={country}
      />

      <StoreFooter dict={dict.footer} />
    </div>
  );
}
