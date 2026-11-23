"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { HandoffData, HandoffModal as HandoffModalComponent } from "./HandoffModal";
import { copyCouponCode, trackCouponClick } from "@/lib/couponInteraction";
import type { BundleCard, CouponCard, ProductCard } from "@/lib/data";

type DealMeta = { couponId: string; couponCode: string | null; destinationUrl: string };

/** What the store page's client widgets (header CTA, voucher, sticky bar, product tiles, All Deals cards) call on click. */
export interface StoreActions {
  ctaClick: () => void;
  productClick: (url: string) => void;
  dealClick: (meta: DealMeta) => void;
}

const StoreActionsContext = createContext<StoreActions | null>(null);

/** null outside a StoreActionsProvider (e.g. the empty-offer page, or OfferVoucher on /deals, which passes its own handler). */
export function useStoreActions(): StoreActions | null {
  return useContext(StoreActionsContext);
}

type HandoffModalProps = Omit<ComponentProps<typeof HandoffModalComponent>, "dict">;

// The "welcome back" modal only ever appears after a visitor has clicked a
// deal and come back to this tab — never on first paint — so its code is
// split out of the landing page's initial bundle and only fetched once the
// first CTA arms it (see `handoffArmed` below), while the visitor is busy on
// the merchant's tab. It loads its own dictionary in that same lazy chunk, so
// the i18n tables never ship with the initial page.
const HandoffModal = dynamic(
  () =>
    Promise.all([import("./HandoffModal"), import("@/lib/i18n")]).then(([modal, i18n]) => {
      function LocalizedHandoffModal(props: HandoffModalProps) {
        return <modal.HandoffModal {...props} dict={i18n.getDictionary(props.country).handoff} />;
      }
      return LocalizedHandoffModal;
    }),
  { ssr: false }
);

/**
 * Client-side half of the store page (StoreDetailViewV2 is a server
 * component): owns click tracking, code copying, the handoff modal and the
 * <html lang> fix, and exposes the click handlers through context so the
 * server-rendered page can place its interactive widgets anywhere.
 */
export function StoreActionsProvider({
  storeSlug,
  storeName,
  storeLogo,
  monogramLetter,
  country,
  languageCode,
  googleAdsConversionId,
  googleAdsConversionLabel,
  primaryCouponId,
  offer,
  coupons,
  bundles,
  products,
  children,
}: {
  storeSlug: string;
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  country?: string | null;
  /** Resolved on the server so the country table stays out of the client bundle. */
  languageCode: string;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
  primaryCouponId: string | null;
  offer: { code: string | null; affiliateUrl: string; title: string; description: string | null };
  coupons: Pick<CouponCard, "_id" | "title" | "description">[];
  bundles: BundleCard[];
  products: ProductCard[];
  children: ReactNode;
}) {
  // Root layout's <html lang> is a static "en" — it can't read the current
  // route's country without forcing the whole site into dynamic rendering
  // (the same ISR-breaking gotcha app/(store)/layout.tsx documents for
  // params). This keeps the authoritative SEO signal (hreflang alternates,
  // set server-side in generateMetadata) correct in the raw HTML regardless,
  // while still fixing the attribute for screen readers/assistive tech,
  // which read the live DOM rather than the initial server response.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = languageCode;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [languageCode]);

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
  const [handoffArmed, setHandoffArmed] = useState(false);
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
    setHandoffArmed(true);
  }

  const actions: StoreActions = {
    ctaClick() {
      const meta = { storeSlug, couponId: primaryCouponId, couponCode: offer.code, destinationUrl: offer.affiliateUrl };
      copyCouponCode(offer.code, meta);
      trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
      armHandoff({
        title: offer.title,
        description: offer.description,
        code: offer.code,
        affiliateUrl: offer.affiliateUrl,
        couponId: primaryCouponId,
      });
    },

    // The hero's click-confirmation strip shows products and bundles, not the
    // coupon itself — passing null/null deliberately skips the Ads conversion
    // ping here (only the actual coupon CTAs — voucher, nav bar, All Deals —
    // should count) while the affiliate_click engagement beacon still fires.
    productClick(url) {
      const meta = { storeSlug, couponId: primaryCouponId, couponCode: offer.code, destinationUrl: url };
      copyCouponCode(offer.code, meta);
      trackCouponClick(null, null, meta);
      armHandoff({
        title: offer.title,
        description: offer.description,
        code: offer.code,
        affiliateUrl: url,
        couponId: primaryCouponId,
      });
    },

    // AllDealsSection copies each card's own code/link itself (via
    // copyCouponCode, scoped to that specific coupon) before calling this —
    // this only needs to fire the click/conversion tracking and arm the
    // handoff, not copy again. These cards are real coupon CTAs (not products
    // or bundles), so they count toward the Ads conversion same as the main
    // voucher and nav bar.
    dealClick(meta) {
      trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, { storeSlug, ...meta });
      const coupon = coupons.find((c) => c._id === meta.couponId);
      armHandoff({
        title: coupon?.title ?? offer.title,
        description: coupon?.description,
        code: meta.couponCode,
        affiliateUrl: meta.destinationUrl,
        couponId: meta.couponId,
      });
    },
  };

  return (
    <StoreActionsContext.Provider value={actions}>
      {children}
      {handoffArmed && (
        <HandoffModal
          data={handoffData}
          onClose={() => setHandoffData(null)}
          onReopen={armHandoff}
          storeName={storeName}
          storeLogo={storeLogo}
          monogramLetter={monogramLetter}
          storeSlug={storeSlug}
          bundles={bundles}
          products={products}
          country={country}
        />
      )}
    </StoreActionsContext.Provider>
  );
}

/** A hero product/bundle tile — a plain affiliate link that also fires the product click tracking + handoff. */
export function ProductTileLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const actions = useStoreActions();
  return (
    <a href={href} target="_blank" rel="nofollow sponsored noopener" onClick={() => actions?.productClick(href)} className={className} style={style}>
      {children}
    </a>
  );
}
