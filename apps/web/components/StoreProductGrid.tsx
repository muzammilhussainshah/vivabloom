"use client";

import { useState } from "react";
import { ProductCard } from "./ProductCard";
import { BundleCard } from "./BundleCard";
import { CouponModal } from "./CouponModal";
import { copyCouponCode, trackCouponClick, trackBundleClick } from "@/lib/couponInteraction";
import type { CouponCard, ProductCard as ProductCardData, BundleCard as BundleCardData } from "@/lib/data";

export type GridItem = { kind: "product"; data: ProductCardData } | { kind: "bundle"; data: BundleCardData };

/**
 * The "Products" grid on the store page — same ProductCard/BundleCard tiles
 * used on /category and /blog, but here every tile shares the click contract
 * the rest of the store page uses: copy the store's coupon code, navigate to
 * the item's own URL, and open the confirmation modal. Mirrors
 * ProductHighlightStrip's tap behavior exactly, so the top image strip and
 * this grid stay in sync.
 *
 * Kept as a store-page-only wrapper rather than baking this into
 * ProductCard/BundleCard themselves — those two are also used on pages that
 * mix products from several different stores, where there's no single
 * relevant coupon to copy.
 */
export function StoreProductGrid({
  items,
  coupons,
  bundles,
  storeName,
  storeLogo,
  storeSlug,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  items: GridItem[];
  coupons: CouponCard[];
  bundles: BundleCardData[];
  storeName: string;
  storeLogo?: string | null;
  storeSlug?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  // Same coupon the top image strip and coupon tickets copy — one consistent
  // code across every clickable surface on the page.
  const primaryCoupon = coupons[0] ?? null;

  function handleTap(url: string) {
    if (!primaryCoupon) {
      trackBundleClick(googleAdsConversionId, googleAdsConversionLabel, { storeSlug, destinationUrl: url });
      return;
    }
    const meta = { storeSlug, couponId: primaryCoupon._id, couponCode: primaryCoupon.code, destinationUrl: url };
    copyCouponCode(primaryCoupon.code, meta);
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
    setActiveUrl(url);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item, i) =>
          item.kind === "bundle" ? (
            <BundleCard
              key={`bundle-${item.data._id}`}
              bundle={item.data}
              priority={i < 3}
              onClick={() => handleTap(item.data.bundleUrl)}
            />
          ) : (
            <ProductCard
              key={item.data._id}
              product={item.data}
              priority={i < 3}
              onClick={() => handleTap(item.data.productUrl)}
            />
          )
        )}
      </div>

      {primaryCoupon && (
        <CouponModal
          open={activeUrl !== null}
          onClose={() => setActiveUrl(null)}
          coupon={primaryCoupon}
          storeName={storeName}
          storeLogo={storeLogo}
          storeSlug={storeSlug}
          bundles={bundles}
          googleAdsConversionId={googleAdsConversionId}
          googleAdsConversionLabel={googleAdsConversionLabel}
          dealUrl={activeUrl ?? "#"}
          onDealClick={() => activeUrl && handleTap(activeUrl)}
        />
      )}
    </>
  );
}
