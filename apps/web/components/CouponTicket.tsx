"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CouponModal } from "./CouponModal";
import { ScissorsIcon, ClockIcon, SparkleIcon, CopyIcon, CheckIcon } from "./CouponIcons";
import { copyCouponCode, trackCouponClick, discountLabel, formatExpiryShort, urlTail } from "@/lib/couponInteraction";
import type { CouponCard, BundleCard } from "@/lib/data";

// Soft brand-tinted ticket body, derived from the brand color (same approach as
// BlogCard) so it tracks any admin theme change instead of being hard-coded.
// The color-mix() itself lives in globals.css behind a feature query rather
// than inline here: as an inline style it had no fallback, so every browser
// without color-mix() (Safari <16.2, Chrome <111) dropped the declaration and
// the card lost its fill entirely — leaving no visible card edge at all.
const TICKET_BG = "var(--ticket-bg)";

/**
 * A physical-coupon-styled card: discount + verified badge up top, a
 * perforated dashed divider with scissors "cut here" in the middle, then the
 * offer details and a single Get Code/Deal button. The two circles on the
 * divider are colored to match the page background so they read as
 * cutouts notched into the ticket's edges — this only works cleanly on a
 * plain page background, not inside another colored container.
 *
 * The whole card is a real <a> (not a div driving window.open): every other
 * merchant CTA in the app (ProductCard, BundleCard, ProductHighlightStrip,
 * BundlePromo, the modal's own button) already navigates via a plain anchor
 * because window.open() is the one path browsers and ad/popup blockers can
 * silently swallow or strip — leaving visitors stuck on about:blank or bounced
 * to the merchant's bare homepage with no affiliate params. Making the card
 * itself an anchor closes that last gap: the visible "Get Code"/"Get Deal"
 * pill is now just styled text inside it, not a second nested link.
 */
export function CouponTicket({
  coupon,
  storeName,
  storeLogo,
  storeSlug,
  bundles,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  coupon: CouponCard;
  storeName: string;
  storeLogo?: string | null;
  storeSlug?: string | null;
  bundles?: BundleCard[];
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiry = formatExpiryShort(coupon.expiryDate);
  const partialCode = coupon.code && coupon.code.length > 4 ? coupon.code.slice(-4) : coupon.code;
  // The merchant's own URL — affiliateUrl (with tracking/discount params) if
  // set, otherwise the plain merchantUrl. Navigated to directly; we no
  // longer proxy coupon clicks through our own /go/[slug] redirect.
  const target = coupon.affiliateUrl || coupon.merchantUrl;
  // Code-less deals have nothing to preview on hover — fall back to a tail of
  // the destination URL so the button never swaps in blank space.
  const hoverPreview = partialCode || urlTail(target);

  useEffect(() => () => {
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
  }, []);

  // Confirms to the visitor that the code is already on their clipboard, so
  // they don't second-guess it and go hunting for a code box that isn't there.
  function flashCopied() {
    if (!coupon.code) return;
    setCopied(true);
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), 2500);
  }

  const meta = { storeSlug, couponId: coupon._id, couponCode: coupon.code, destinationUrl: target };

  /** Copy + track only — no navigation. Shared by the card tap and the modal's anchor CTA. */
  function copyAndTrack() {
    copyCouponCode(coupon.code, meta);
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
    flashCopied();
  }

  // Tapping anywhere on the card — the actual navigation is the anchor's own
  // native `href`/`target` behavior, never blocked by popup blockers since
  // it's a direct user gesture on a real link. This just runs the copy/track
  // side effects and pops the confirmation modal alongside it.
  function getDeal() {
    copyAndTrack();
    setModalOpen(true);
  }

  // Anchors fire `click` (and this handler) on Enter automatically, but not
  // on Space — simulate a real click so Space keeps working exactly like it
  // did when this was a role="button" div.
  function handleCardKeyDown(e: React.KeyboardEvent<HTMLAnchorElement>) {
    if (e.key === " ") {
      e.preventDefault();
      e.currentTarget.click();
    }
  }

  return (
    <a
      href={target}
      target="_blank"
      rel="noopener noreferrer"
      className="coupon-card relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-brand-primary/20 transition-shadow hover:shadow-md"
      style={{ backgroundColor: TICKET_BG }}
      onClick={getDeal}
      onKeyDown={handleCardKeyDown}
      aria-label={`${coupon.title} — ${coupon.code ? "get code" : "get deal"}`}
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            {storeLogo && (
              // Fixed height, auto width (not RemoteImage's fixed-box `fill`
              // pattern) — a fixed-width box left blank letterboxing around
              // logos that aren't exactly that aspect ratio, which both made
              // the logo look smaller than the row's height allowed and
              // pushed the discount text away from it with invisible gap.
              // Auto width fills the full row height with no wasted space,
              // so the text sits right after the logo's real edge.
              <Image
                src={storeLogo}
                alt={storeName}
                width={280}
                height={56}
                sizes="220px"
                className="h-10 w-auto shrink-0 object-contain object-left sm:h-12"
              />
            )}
            {/* leading-none: the text-2xl/4xl line-height reserves more
                vertical box than the glyphs need, which was the "wasted"
                room around the now-bigger logo — tightening it lets the row
                grow to fit the logo without over-growing the card. */}
            <p className="text-2xl font-extrabold leading-none text-brand-accent sm:text-4xl">{discountLabel(coupon)}</p>
          </div>
        </div>
        {coupon.isVerified && (
          <div className="flex shrink-0 flex-col items-center gap-1 text-brand-accent">
            <SparkleIcon />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Verified</span>
          </div>
        )}
      </div>

      {/* Perforated divider */}
      <div className="relative shrink-0">
        <div className="coupon-perforation border-t-2 border-dashed border-brand-primary/25" />
        <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-surface" aria-hidden="true" />
        <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-surface" aria-hidden="true" />
        <span
          className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-brand-primary/50"
          style={{ backgroundColor: TICKET_BG }}
          aria-hidden="true"
        >
          <ScissorsIcon />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6 sm:pt-5">
        <div>
          <p className="text-lg font-semibold text-text">{coupon.title}</p>
          {coupon.description && <p className="mt-1 text-sm text-text-muted">{coupon.description}</p>}
          {expiry && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-muted sm:mt-3">
              <ClockIcon />
              Expires {expiry}
            </p>
          )}
        </div>
        {/* Just styled text now, not its own link — the whole card above is
            already the real <a>, and a nested anchor here would be invalid
            HTML the browser would silently break apart. */}
        <span
          className={`group relative inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors sm:px-6 sm:py-3 ${
            copied ? "bg-brand-accent" : "bg-brand-secondary hover:bg-brand-secondary-hover"
          }`}
        >
          {copied ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon />
              Copied!
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 group-hover:opacity-0">
                <CopyIcon />
                {coupon.code ? "Get Code" : "Get Deal"}
                <span aria-hidden="true">→</span>
              </span>
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                <CopyIcon />
                ...{hoverPreview}
              </span>
            </>
          )}
        </span>
      </div>

      <CouponModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        coupon={coupon}
        storeName={storeName}
        storeLogo={storeLogo}
        storeSlug={storeSlug}
        bundles={bundles}
        googleAdsConversionId={googleAdsConversionId}
        googleAdsConversionLabel={googleAdsConversionLabel}
        dealUrl={target}
        onDealClick={copyAndTrack}
      />
    </a>
  );
}
