"use client";

import { useEffect, useRef, useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/CouponIcons";
import type { DerivedOffer } from "@/lib/offerContent";
import type { Dictionary } from "@/lib/i18n";

/**
 * Mobile-only fixed CTA bar, always on screen from the first paint, so a
 * visitor can convert from anywhere on the page with one thumb-reach tap.
 * `store-scope`'s bottom padding (store.css) keeps page content clear of it.
 */
export function StickyMobileBar({ offer, onCtaClick, dict }: { offer: DerivedOffer; onCtaClick: () => void; dict: Dictionary["stickyMobileBar"] }) {
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    },
    []
  );

  function handleClick() {
    onCtaClick();
    if (!offer.code) return;
    setCopied(true);
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 px-4 pt-3.5 md:hidden"
      // paddingBottom extends the bar's own background down through the
      // home-indicator safe area on notched iPhones (needs viewportFit:
      // "cover", set in the layouts' viewport export).
      style={{
        background: "var(--bar)",
        backdropFilter: "blur(10px)",
        borderTop: "2px solid var(--accent)",
        boxShadow: "0 -12px 30px -12px rgba(0,0,0,0.45)",
        paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-extrabold" style={{ color: "var(--page)" }}>
          {offer.discountLabel} {offer.discountSuffix}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs" style={{ color: "var(--success)" }}>
          <span className="sv-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
          {offer.verifiedDateShort ? dict.testedPrefix(offer.verifiedDateShort) : ""}
          {dict.liveOffer}
        </p>
      </div>
      <a
        href={offer.affiliateUrl}
        target="_blank"
        rel="nofollow sponsored noopener"
        onClick={handleClick}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-3 text-[14.5px] font-extrabold shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.97]"
        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? dict.copied : offer.code ? dict.getDiscountCode : dict.getDiscountDeal}
      </a>
    </div>
  );
}
