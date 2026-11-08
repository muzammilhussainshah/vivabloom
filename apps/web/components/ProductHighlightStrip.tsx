"use client";

import { useState } from "react";
import { RemoteImage } from "./RemoteImage";
import { CouponModal } from "./CouponModal";
import { GiftIcon } from "./CouponIcons";
import { copyCouponCode, trackCouponClick, trackBundleClick } from "@/lib/couponInteraction";
import type { ProductCard as ProductCardData, CouponCard, BundleCard as BundleCardData } from "@/lib/data";

/** A single tappable photo in the strip — a product or a bundle, normalized to one shape. */
interface HighlightItem {
  kind: "product" | "bundle";
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number | null;
  url: string;
}

/**
 * A horizontally-scrolling strip of real product (and, when available, bundle)
 * photos, shown right below the store heading (before "Active Coupons") on
 * the canonical store page and its PPC-sitelink variants. Experimental:
 * testing whether putting actual merchandise up top — not just the store
 * logo — makes the page feel more compelling to visitors coming in from ads.
 * Bundles are tagged with a small gift-icon badge so they read as the
 * higher-value upsell rather than a plain product.
 *
 * Scrolls horizontally instead of wrapping so it stays a fixed, small height
 * no matter how many items a store has — important on mobile where every
 * extra pixel above the coupons pushes them further down.
 *
 * Tapping a photo behaves exactly like tapping a coupon card (CouponTicket):
 * copies the store's top coupon code, tracks the click, opens the merchant
 * tab, and pops the same CouponModal confirmation — it just opens that
 * specific product's or bundle's page instead of the coupon's own merchant
 * link, since neither has a code of its own to offer. A plain button (not an
 * <a>) so this one function can drive both the initial tap and the modal's
 * own "Copy Code & Get Deal" repeat action without opening two tabs.
 */
export function ProductHighlightStrip({
  products,
  coupons,
  bundles = [],
  storeName,
  storeLogo,
  storeSlug,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  products: ProductCardData[];
  coupons: CouponCard[];
  bundles?: BundleCardData[];
  storeName: string;
  storeLogo?: string | null;
  storeSlug?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  const [activeItem, setActiveItem] = useState<HighlightItem | null>(null);
  // Same coupon shown first under "Active Coupons" — copied whenever a photo
  // is tapped, so the image is just another door into that one code.
  const primaryCoupon = coupons[0] ?? null;

  const items: HighlightItem[] = [
    ...products.map((p) => ({
      kind: "product" as const,
      id: p._id,
      name: p.name,
      image: p.image,
      price: p.price,
      originalPrice: p.originalPrice,
      url: p.productUrl,
    })),
    ...bundles.map((b) => ({
      kind: "bundle" as const,
      id: b._id,
      name: b.name,
      image: b.image,
      price: b.price,
      originalPrice: b.originalPrice,
      url: b.bundleUrl,
    })),
  ].slice(0, 8);

  // Copy + track only. Navigation is the anchor's own job — these used to be
  // <button>s calling window.open with a features string, which iOS Safari
  // treats as a popup and blocks by default, so the merchant tab never opened
  // for much of our paid mobile traffic. Copying before (rather than after)
  // the navigation also matters: window.open consumed the user activation the
  // clipboard write needs, so the code silently failed to copy on iOS.
  function handleTap(item: HighlightItem) {
    if (!primaryCoupon) {
      trackBundleClick(googleAdsConversionId, googleAdsConversionLabel, { storeSlug, destinationUrl: item.url });
      return;
    }
    const meta = {
      storeSlug,
      couponId: primaryCoupon._id,
      couponCode: primaryCoupon.code,
      destinationUrl: item.url,
    };
    copyCouponCode(primaryCoupon.code, meta);
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
    setActiveItem(item);
  }

  return (
    <>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const hasDiscount = !!(item.originalPrice && item.originalPrice > item.price);
          const percentOff = hasDiscount
            ? Math.ceil(((item.originalPrice! - item.price) / item.originalPrice!) * 100)
            : null;

          return (
            <a
              key={`${item.kind}-${item.id}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleTap(item)}
              aria-label={`${item.name} — get code`}
              className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-muted transition-shadow hover:shadow-md sm:h-24 sm:w-24"
            >
              <RemoteImage src={item.image} alt={item.name} sizes="96px" className="h-full w-full" />
              {percentOff !== null && (
                <span className="absolute left-1 top-1 rounded-base bg-brand-secondary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  -{percentOff}%
                </span>
              )}
              {item.kind === "bundle" && (
                <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-accent text-white">
                  <GiftIcon />
                </span>
              )}
            </a>
          );
        })}
      </div>

      {primaryCoupon && (
        <CouponModal
          open={activeItem !== null}
          onClose={() => setActiveItem(null)}
          coupon={primaryCoupon}
          storeName={storeName}
          storeLogo={storeLogo}
          storeSlug={storeSlug}
          bundles={bundles}
          googleAdsConversionId={googleAdsConversionId}
          googleAdsConversionLabel={googleAdsConversionLabel}
          // Never rendered with a null activeItem — `open` is false in that case.
          dealUrl={activeItem?.url ?? "#"}
          onDealClick={() => activeItem && handleTap(activeItem)}
        />
      )}
    </>
  );
}
