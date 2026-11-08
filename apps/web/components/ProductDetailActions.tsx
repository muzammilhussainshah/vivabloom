"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { CheckIcon, CopyIcon, ExternalLinkIcon, GiftIcon } from "./CouponIcons";
import { copyCouponCode, trackCouponClick, trackBundleClick } from "@/lib/couponInteraction";
import type { CatalogDetail } from "@/lib/data";

const CTA_COUNTDOWN_SECONDS = 3; // displayed ticks: 3, 2, 1
const CTA_COUNTDOWN_TOTAL_MS = 900; // real elapsed time before opening — compressed to fit inside this
const CTA_COUNTDOWN_TICK_MS = CTA_COUNTDOWN_TOTAL_MS / CTA_COUNTDOWN_SECONDS;

/**
 * The /products/[slug] page's price block + primary CTA — shared by both a
 * product and a bundle (CatalogDetail normalizes the two). No cart/checkout
 * — this is an affiliate catalog, not a store we fulfill orders from — so
 * the button hands the visitor off to the merchant's own page, framed as
 * placing/confirming an order rather than "Get Deal" since the visitor
 * experiences this as buying the item, just on the merchant's site.
 *
 * Deliberately no confirmation modal (unlike the older StoreProductGrid/
 * CouponModal flow used elsewhere) — mirrors the redesigned /stores/[slug]
 * page's own voucher CTA instead: copy the code inline, show "Copied!" right
 * on the button for a beat, then open the merchant tab on its own. One
 * consistent, modal-free handoff.
 */
export function ProductDetailActions({
  item,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  item: CatalogDetail;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  const coupon = item.storeCoupon ?? null;
  const hasCode = !!coupon?.code;

  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    },
    []
  );

  const hasDiscount = !!(item.originalPrice && item.originalPrice > item.price);
  const savings = hasDiscount ? item.originalPrice! - item.price : null;
  const percentOff = hasDiscount ? Math.ceil((savings! / item.originalPrice!) * 100) : null;
  const isLoading = countdown !== null;

  const meta = {
    storeSlug: item.store.slug,
    couponId: coupon?._id ?? null,
    couponCode: coupon?.code ?? null,
    destinationUrl: item.url,
  };

  function handleActivate(e: MouseEvent<HTMLAnchorElement>) {
    if (!hasCode) {
      // No code to hand over — let the anchor's own navigation proceed
      // immediately, just track the click.
      trackBundleClick(googleAdsConversionId, googleAdsConversionLabel, meta);
      return;
    }

    // A code is worth a beat to register before the tab opens, so take over
    // navigation ourselves: preventDefault, copy, flash "Copied!", then open
    // once the short countdown finishes. copyCouponCode must run before any
    // navigation consumes the click's transient user activation, which the
    // clipboard write needs.
    e.preventDefault();
    copyCouponCode(coupon!.code, meta);
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
    flushSync(() => setCopied(true));
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), 2500);

    if (countdownInterval.current) return; // already counting down from an earlier tap
    let remaining = CTA_COUNTDOWN_SECONDS;
    setCountdown(remaining);
    countdownInterval.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      countdownInterval.current = null;
      window.open(item.url, "_blank", "noopener,noreferrer");
      setCountdown(null);
    }, CTA_COUNTDOWN_TICK_MS);
  }

  const ctaLabel = hasDiscount ? `Place Order & Save ${percentOff}%` : `Place Order on ${item.store.name}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <span className="text-3xl font-bold text-text">${item.price.toFixed(2)}</span>
        {hasDiscount && (
          <>
            <span className="text-lg text-text-muted line-through">${item.originalPrice!.toFixed(2)}</span>
            <span className="rounded-base bg-brand-secondary px-2 py-1 text-sm font-semibold text-white">
              Save ${savings!.toFixed(2)} ({percentOff}%)
            </span>
          </>
        )}
      </div>

      {!!item.extraDiscountPercent && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-base bg-brand-accent/10 px-2.5 py-1 text-sm font-semibold text-brand-accent">
          <GiftIcon />
          Get an extra {item.extraDiscountPercent}% off with this bundle
        </p>
      )}

      {coupon?.code && (
        <p className="text-sm text-text-muted">
          Use code <span className="font-semibold text-text">{coupon.code}</span> at checkout on {item.store.name}
          &apos;s site for this price.
        </p>
      )}

      {/* A real anchor, not a button calling window.open — the guaranteed-
          working path to the merchant on the codeless branch (a navigation
          the visitor triggered by tapping a link is never popup-blocked); on
          the coded branch handleActivate takes over and opens the tab itself
          once the code has had a moment to copy. */}
      <a
        href={item.url}
        target="_blank"
        rel="nofollow sponsored noopener"
        onClick={handleActivate}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-8 py-3.5 text-base font-semibold text-white transition-transform active:scale-[0.98] hover:bg-brand-primary-hover"
      >
        {copied || isLoading ? (
          <>
            Copied! {isLoading ? `Opening in ${countdown}…` : "Opening…"}
            <CheckIcon />
          </>
        ) : (
          <>
            {ctaLabel}
            <ExternalLinkIcon />
          </>
        )}
      </a>
      {hasCode && !copied && !isLoading && (
        <p className="-mt-2.5 inline-flex items-center gap-1.5 text-xs text-text-muted">
          <CopyIcon />
          Tapping this copies your code, then opens {item.store.name}.
        </p>
      )}

      {item.detailsUrl && (
        <a
          href={item.detailsUrl}
          target="_blank"
          rel="nofollow sponsored noopener"
          className="-mt-1 w-fit text-sm font-medium text-brand-primary hover:underline"
        >
          View full bundle details on {item.store.name} →
        </a>
      )}

      <p className="text-xs text-text-muted">
        You&apos;ll complete your order on {item.store.name}&apos;s own site — VivaBloom doesn&apos;t process payments.
      </p>
    </div>
  );
}
