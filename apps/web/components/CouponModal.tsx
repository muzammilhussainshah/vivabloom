"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RemoteImage } from "./RemoteImage";
import { BundlePromo } from "./BundlePromo";
import { ClockIcon, CopyIcon, PercentIcon, CloseIcon, ExternalLinkIcon } from "./CouponIcons";
import { copyCouponCode, discountLabel, formatExpiryLong } from "@/lib/couponInteraction";
import type { CouponCard, BundleCard } from "@/lib/data";

/**
 * Post-click confirmation modal: shown after the merchant tab has already
 * been opened (and the code already copied) so the visitor has something to
 * come back to on this tab, with the code still visible and an easy re-copy
 * / re-open action if the popup got blocked or they lost the other tab.
 * Rendered via a portal so its clicks never bubble into the clickable
 * coupon card underneath it.
 */
export function CouponModal({
  open,
  onClose,
  coupon,
  storeName,
  storeLogo,
  storeSlug,
  bundles,
  googleAdsConversionId,
  googleAdsConversionLabel,
  dealUrl,
  onDealClick,
}: {
  open: boolean;
  onClose: () => void;
  coupon: CouponCard;
  storeName: string;
  storeLogo?: string | null;
  storeSlug?: string | null;
  /** This store's active bundles, if any — one is picked at random each time the modal opens. */
  bundles?: BundleCard[];
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
  /** Merchant destination for the modal's own CTA — rendered as a real <a>, never window.open. */
  dealUrl: string;
  /** Re-runs copy + tracking for the modal's CTA. Must NOT open a tab; the anchor does that. */
  onDealClick: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [featuredBundle, setFeaturedBundle] = useState<BundleCard | null>(null);

  useEffect(() => setMounted(true), []);

  // Re-roll which bundle to feature every time the modal opens, so repeat
  // visitors (or visitors closing/reopening across multiple coupons) see
  // variety rather than the same one every time.
  useEffect(() => {
    if (!open || !bundles || bundles.length === 0) return;
    setFeaturedBundle(bundles[Math.floor(Math.random() * bundles.length)]);
  }, [open, bundles]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const expiry = formatExpiryLong(coupon.expiryDate);

  function handleCopy() {
    copyCouponCode(coupon.code, { storeSlug, couponId: coupon._id });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      // React bubbles portal events through the *React* tree, not the DOM
      // tree — this modal is still logically nested inside the clickable
      // coupon card, so every handler here must stop propagation or a
      // backdrop click would also re-trigger the card's own click handler.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${coupon.title} coupon details`}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface-muted shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 flex-col items-center gap-1 bg-brand-secondary px-6 py-3.5 text-center text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-3.5 text-white/80 transition-colors hover:text-white"
          >
            <CloseIcon />
          </button>
          {storeLogo ? (
            <RemoteImage src={storeLogo} alt={storeName} sizes="40px" className="h-10 w-10 rounded-xl bg-white/10" imgClassName="object-contain p-1.5" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">
              {storeName.charAt(0)}
            </div>
          )}
          <p className="text-sm font-bold">{coupon.title}</p>
          <p className="text-xs text-white/80">{storeName}</p>
        </div>

        <div className="flex flex-col gap-2.5 p-4">
          {coupon.description && <p className="line-clamp-2 text-sm text-text-muted">{coupon.description}</p>}

          {coupon.code && (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-primary/40 p-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Your Coupon Code</p>
              <p className="text-lg font-bold tracking-wide text-text">{coupon.code}</p>
              <button
                type="button"
                onClick={handleCopy}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  copied
                    ? "border-brand-accent text-brand-accent"
                    : "border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10"
                }`}
              >
                <CopyIcon />
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-brand-accent">
              <PercentIcon />
              <span className="font-medium text-text">{discountLabel(coupon)}</span>
            </div>
            {expiry && (
              <div className="flex items-center gap-1.5 text-brand-accent">
                <ClockIcon />
                <span className="text-text-muted">Exp {expiry}</span>
              </div>
            )}
          </div>

          {/*
            A real anchor, not a button calling window.open — the guaranteed-
            working path to the merchant, since a navigation the visitor
            triggered by tapping a link is never popup-blocked.
          */}
          <a
            href={dealUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDealClick}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-secondary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary-hover"
          >
            {coupon.code ? "Copy Code & Get Deal" : "Get Deal"}
            <ExternalLinkIcon />
          </a>

          {featuredBundle && (
            <BundlePromo
              bundle={featuredBundle}
              storeSlug={storeSlug}
              couponId={coupon._id}
              couponCode={coupon.code}
              googleAdsConversionId={googleAdsConversionId}
              googleAdsConversionLabel={googleAdsConversionLabel}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
