"use client";

import { RemoteImage } from "./RemoteImage";
import { GiftIcon, ExternalLinkIcon } from "./CouponIcons";
import { copyCouponCode, trackBundleClick } from "@/lib/couponInteraction";
import type { BundleCard } from "@/lib/data";

/**
 * Upsell block shown inside CouponModal, right after a visitor has already
 * committed to using a coupon — the moment they're most receptive to a
 * "spend a little more, save a lot more" pitch. Kept deliberately compact
 * (one image row + one savings line + one action row) so it doesn't push
 * the modal past a comfortable height on mobile, where the backdrop is
 * already competing for the same small viewport.
 */
export function BundlePromo({
  bundle,
  storeSlug,
  couponId,
  couponCode,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  bundle: BundleCard;
  storeSlug?: string | null;
  /** The modal's own coupon — bundles have no code of their own, so "Get This Bundle" re-copies this one, same as the modal's main CTA. */
  couponId?: string | null;
  couponCode?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  const hasSavings = !!(bundle.originalPrice && bundle.originalPrice > bundle.price);
  const savingsAmount = hasSavings ? bundle.originalPrice! - bundle.price : null;
  const percentOff = hasSavings ? Math.ceil((savingsAmount! / bundle.originalPrice!) * 100) : null;
  const hasExtra = !!(bundle.extraDiscountPercent && bundle.extraDiscountPercent > 0);

  // The anchor navigates on its own; this just copies the coupon code shown
  // in the modal above (bundles don't have a code of their own) and tracks.
  // Previously a <button> calling window.open with a features string, which
  // iOS Safari treats as a popup and blocks by default, so this upsell
  // simply did nothing on iPhone.
  function handleGetBundle() {
    const meta = { storeSlug, couponId, couponCode, destinationUrl: bundle.bundleUrl };
    copyCouponCode(couponCode, meta);
    trackBundleClick(googleAdsConversionId, googleAdsConversionLabel, meta);
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-accent">
          <GiftIcon />
          Bundle &amp; Save
        </div>
        {hasExtra && (
          <span className="shrink-0 rounded-full bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
            +{bundle.extraDiscountPercent}% extra off
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <RemoteImage
          src={bundle.image}
          alt={bundle.name}
          sizes="40px"
          className="h-10 w-10 shrink-0 rounded-lg bg-surface"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold text-text">{bundle.name}</p>
          {hasSavings && (
            <span className="text-sm font-bold text-brand-accent">
              Save ${savingsAmount!.toFixed(2)}{percentOff !== null ? ` (${percentOff}%)` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={bundle.bundleUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleGetBundle}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          Get This Bundle
          <ExternalLinkIcon />
        </a>
        <a
          href={bundle.bundleDetailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-brand-primary hover:underline"
        >
          Details
        </a>
      </div>
    </div>
  );
}
