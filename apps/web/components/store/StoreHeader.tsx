"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { CopyIcon, CheckIcon } from "@/components/CouponIcons";
import { urlTail } from "@/lib/couponInteraction";
import type { Dictionary } from "@/lib/i18n";

export interface StoreHeaderOffer {
  discountLabel: string;
  discountSuffix: string;
  verifiedDateShort: string | null;
  affiliateUrl: string;
  storeSlug: string;
  couponId: string | null;
  couponCode: string | null;
}

/**
 * Sticky header for the store-detail routes only (see app/(store)/layout.tsx)
 * — separate from the rest of the site's <Header>. No client-side theme
 * picker (ships from the admin setting instead, per the design handoff), no
 * live search dropdown (full search stays on the main site header), and
 * deliberately no nav links (Stores/Categories/Blog/How we test) — this
 * header exists to convert on the current store, so the only thing beside
 * the logo is the CTA.
 */
export function StoreHeader({
  storeName,
  offer,
  dict,
  onCtaClick,
}: {
  storeName: string | null;
  offer: StoreHeaderOffer | null;
  dict: Dictionary["storeHeader"];
  /** Copies the code, fires tracking, and arms the shared "welcome back" handoff modal — StoreDetailViewV2's handleCtaClick owns all of that; this header has none of its own to avoid double-firing it. */
  onCtaClick?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    },
    []
  );

  // Code-less deals have nothing to preview on hover — fall back to a tail of
  // the destination URL, same as CouponTicket's hover state.
  const partialCode = offer?.couponCode && offer.couponCode.length > 4 ? offer.couponCode.slice(-4) : offer?.couponCode;
  const hoverPreview = partialCode || (offer ? urlTail(offer.affiliateUrl) : "");

  function handleCtaClick() {
    if (!offer) return;
    onCtaClick?.();
    if (!offer.couponCode) return;
    setCopied(true);
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), 2500);
  }

  return (
    <header className="sticky top-0 z-40" style={{ background: "var(--footer)" }}>
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4 md:h-[62px]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="md:hidden">
            <LogoMark size={25} markColor="var(--accent)" glyphColor="var(--page)" />
          </span>
          <span className="hidden md:inline-flex">
            <LogoMark size={28} markColor="var(--accent)" glyphColor="var(--page)" />
          </span>
          <span className="font-script text-2xl font-semibold leading-none tracking-tight" style={{ color: "var(--page)" }}>
            VivaBloom
          </span>
        </Link>

        {offer && storeName && (
          <div className="ml-auto hidden items-center gap-4 md:flex">
            <div className="text-right leading-tight">
              <p className="text-[13.5px] font-bold" style={{ color: "var(--page)" }}>
                {offer.discountLabel} {offer.discountSuffix}
              </p>
              {offer.verifiedDateShort && (
                <p className="flex items-center justify-end gap-1.5 text-[11px]" style={{ color: "var(--success)" }}>
                  <span className="sv-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
                  {dict.testedLiveOffer(offer.verifiedDateShort)}
                </p>
              )}
            </div>
            <a
              href={offer.affiliateUrl}
              target="_blank"
              rel="nofollow sponsored noopener"
              onClick={handleCtaClick}
              aria-label={dict.ctaAriaLabel(Boolean(offer.couponCode), storeName ?? "")}
              className="group relative inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[10px] px-[18px] py-[11px] text-[14px] font-extrabold transition-colors"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {copied ? (
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon />
                  {dict.copied}
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 group-hover:opacity-0">
                    <CopyIcon />
                    {offer.couponCode ? dict.getDiscountCode : dict.getDiscountDeal}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                    <CopyIcon />
                    ...{hoverPreview}
                  </span>
                </>
              )}
            </a>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <Link
            href="/blog"
            aria-label={dict.searchAriaLabel}
            className="flex h-[31px] w-[31px] items-center justify-center rounded-[10px]"
            style={{ background: "rgba(246,243,236,0.12)", color: "var(--page)" }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
