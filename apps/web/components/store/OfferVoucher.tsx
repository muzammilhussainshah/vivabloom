"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { StoreMark } from "./StoreMark";
import { CopyIcon, CheckIcon } from "@/components/CouponIcons";
import { copyCouponCode, maskCode } from "@/lib/couponInteraction";
import type { DerivedOffer } from "@/lib/offerContent";
import type { Dictionary } from "@/lib/i18n";

/**
 * `discountSuffix` is authored as one string — "off {storeName}" / "at
 * {storeName}" by default (see offerContent.ts's deriveDiscountLabel; admin
 * can override it, but the form's own placeholder guides them to the same
 * shape). Split on the first space so the preposition can sit on the same
 * line as the discount value and the store name gets its own line below.
 */
function splitSuffix(suffix: string): { preposition: string; rest: string } {
  const spaceIndex = suffix.indexOf(" ");
  if (spaceIndex === -1) return { preposition: suffix, rest: "" };
  return { preposition: suffix.slice(0, spaceIndex), rest: suffix.slice(spaceIndex + 1) };
}

/**
 * `sv-voucher-value`'s base size is tuned for a bare "$80"/"20%" (2-4
 * chars). Admins can also write a phrase like "Up To 10%" or "Buy 1 Get 1"
 * there, which would wrap and blow up the card at that size — step down for
 * longer labels instead.
 */
function voucherValueClass(label: string): string {
  if (label.length > 10) return "sv-voucher-value sv-voucher-value--sm";
  if (label.length > 5) return "sv-voucher-value sv-voucher-value--md";
  return "sv-voucher-value";
}

/**
 * Small ring that drains in one continuous motion across the *entire*
 * countdown span, with the current digit centered inside it — a fixed-size
 * badge next to a label that never changes length, so the CTA never reflows.
 * Mounted once when the countdown starts and unmounted when it ends —
 * deliberately NOT keyed by `value`, so ticking 3→2→1 only updates the digit
 * and never restarts the drain animation.
 */
const COUNTDOWN_RING_RADIUS = 10;
const COUNTDOWN_RING_CIRCUMFERENCE = 2 * Math.PI * COUNTDOWN_RING_RADIUS;

function CountdownRing({ value, durationSeconds }: { value: number; durationSeconds: number }) {
  return (
    <span className="sv-countdown-ring" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r={COUNTDOWN_RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
        <circle
          className="sv-countdown-progress"
          cx="13"
          cy="13"
          r={COUNTDOWN_RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={COUNTDOWN_RING_CIRCUMFERENCE}
          transform="rotate(-90 13 13)"
          style={
            {
              "--sv-countdown-circumference": COUNTDOWN_RING_CIRCUMFERENCE,
              animationDuration: `${durationSeconds}s`,
            } as CSSProperties
          }
        />
      </svg>
      <span className="sv-countdown-number">{value}</span>
    </span>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M8 1.5 2.75 3.5v4c0 3.3 2.2 5.9 5.25 7 3.05-1.1 5.25-3.7 5.25-7v-4L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5.6 8.1 7.3 9.8l3.2-3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0l-8.3-8.3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The centerpiece of the store page: a premium voucher card — dark header
 * (store + verified seal), the prize field (the discount, big), a
 * perforation, then the redemption area: a dashed "code slot" showing the
 * masked code (revealed in full once copied), one full-width CTA, a short
 * how-to line, and the fine print.
 */
export function OfferVoucher({
  storeName,
  storeLogo,
  monogramLetter,
  offer,
  storeSlug,
  couponId,
  onCtaClick,
  dict,
  footerNote,
}: {
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  offer: DerivedOffer;
  storeSlug: string;
  couponId: string | null;
  onCtaClick: () => void;
  dict: Dictionary["offerVoucher"];
  /** Overrides the default "paste it at checkout" instructional line right below the CTA button — e.g. the /deals index replaces it with a small product strip instead. Omit to keep the default copy (every /stores/[slug] route). */
  footerNote?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ctaCountdown, setCtaCountdown] = useState<number | null>(null);
  const ctaCountdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      if (ctaCountdownInterval.current) clearInterval(ctaCountdownInterval.current);
    },
    []
  );

  const CTA_COUNTDOWN_SECONDS = 3; // displayed ticks: 3, 2, 1
  const CTA_COUNTDOWN_TOTAL_SECONDS = 0.5; // real elapsed time before opening — the 3 ticks are compressed to fit inside this
  const CTA_COUNTDOWN_TICK_MS = (CTA_COUNTDOWN_TOTAL_SECONDS * 1000) / CTA_COUNTDOWN_SECONDS;

  // Single button covers both mechanics, but they diverge on timing: a real
  // code gets a beat to let the copy register before the tab opens (the code
  // is useless if the visitor doesn't have it in hand yet); a referral link
  // has nothing to "have in hand", so that one just goes.
  const hasCode = Boolean(offer.code);
  const buttonLabel = hasCode ? dict.getCode : dict.getDeal;
  const isLoading = ctaCountdown !== null; // only ever true for the code path — see handleActivate
  const busy = copied || isLoading;
  const finePrint = dict.onePerOrderNoExpiry
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  function handleActivate(e: MouseEvent<HTMLAnchorElement>) {
    if (!hasCode) {
      // No countdown for a code-less deal — copy the link for the same
      // tap-to-copy affordance, but let the anchor's own target="_blank"
      // navigation proceed immediately (no preventDefault). target="_blank"
      // keeps this page's JS alive, so the clipboard write still completes.
      try {
        navigator.clipboard?.writeText(offer.affiliateUrl)?.catch(() => {});
      } catch {
        // Swallow — UI feedback must still fire even if clipboard access is denied.
      }
      flushSync(() => setCopied(true));
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2500);
      onCtaClick();
      return;
    }

    // Coupon code: take over navigation ourselves — the clipboard write needs
    // the click's transient user activation, which the anchor's own default
    // navigation would otherwise consume before the write resolves.
    // Middle-click/right-click-"open in new tab" still use the real href.
    e.preventDefault();
    copyCouponCode(offer.code, { storeSlug, couponId, couponCode: offer.code, destinationUrl: offer.affiliateUrl });
    // flushSync: commit + paint the "Copied!" state immediately rather than
    // trusting default batching to land it promptly on every mobile engine.
    flushSync(() => setCopied(true));
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), 2500);

    // Copying also starts the countdown — the deal opens on its own once it
    // finishes, no second tap needed.
    if (ctaCountdown !== null) return; // already counting down from an earlier tap
    onCtaClick();
    let remaining = CTA_COUNTDOWN_SECONDS;
    setCtaCountdown(remaining);
    ctaCountdownInterval.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCtaCountdown(remaining);
        return;
      }
      if (ctaCountdownInterval.current) clearInterval(ctaCountdownInterval.current);
      // Opened only now, after the timer; the click's user activation still
      // carries over in most browsers. Either way the button reverts to a
      // plain working link right after.
      window.open(offer.affiliateUrl, "_blank", "noopener,noreferrer");
      setCtaCountdown(null);
    }, CTA_COUNTDOWN_TICK_MS);
  }

  const { preposition, rest } = splitSuffix(offer.discountSuffix);

  return (
    <div className="[filter:drop-shadow(0_18px_32px_rgba(5,20,16,0.42))] md:[filter:drop-shadow(0_28px_48px_rgba(5,20,16,0.48))]">
      {/* No background on the card itself — each band paints its own, so the perforation's masked notches are true holes rather than revealing a card-colored backing. */}
      <div className="overflow-hidden rounded-[24px] md:rounded-[28px]">
        {/* a. Header — who it's for, and the verified seal */}
        {/* The inset hairline traces the card's top edge so the dark header doesn't melt into a dark page behind it. */}
        <div
          className="relative flex items-center gap-3 rounded-t-[inherit] px-4 py-3.5 md:px-5 md:py-4"
          style={{ background: "var(--text)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), inset 1px 0 0 rgba(255,255,255,0.08), inset -1px 0 0 rgba(255,255,255,0.08)" }}
        >
          <StoreMark
            logo={storeLogo}
            letter={monogramLetter}
            name={storeName}
            className="h-10 w-10 rounded-xl text-base ring-2 ring-white/10"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold uppercase tracking-wide" style={{ color: "var(--page)" }}>
              {dict.voucherLabel(storeName)}
            </p>
            <p className="font-store-mono truncate text-[10px] tracking-[0.06em]" style={{ color: "rgba(255,255,255,0.5)" }}>
              {dict.serialLine(offer.serial)}
            </p>
          </div>
          {offer.verifiedDateShort && (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ background: "var(--sec-bg)", border: "1px solid var(--sec-br)", color: "var(--success)" }}
            >
              <ShieldCheckIcon />
              {dict.verified}
              {/* Date only from `sm` up — on a phone it pushed the store name into an ellipsis, and the hero chip right above already says when it was tested. */}
              <span className="hidden sm:inline">· {offer.verifiedDateShort}</span>
            </span>
          )}
        </div>

        {/* b. Prize field */}
        <div className="relative isolate overflow-hidden px-5 pb-7 pt-6 text-center md:pb-9 md:pt-8" style={{ background: "var(--accent)" }}>
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.28), transparent 60%), radial-gradient(80% 60% at 50% 120%, rgba(0,0,0,0.18), transparent 70%)",
            }}
            aria-hidden="true"
          />
          {/* Sunburst rays fanning up from below the value — the classic "prize" coupon cue, kept faint. */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.09]"
            style={{
              background: "repeating-conic-gradient(from 0deg at 50% 115%, #fff 0deg 5deg, transparent 5deg 12deg)",
              maskImage: "radial-gradient(ellipse 75% 95% at 50% 100%, #000 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 75% 95% at 50% 100%, #000 30%, transparent 75%)",
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-16 -top-16 -z-10 h-48 w-48 rounded-full border-[18px] opacity-[0.08]"
            style={{ borderColor: "#fff" }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -right-14 -z-10 h-56 w-56 rounded-full border-[22px] opacity-[0.08]"
            style={{ borderColor: "#fff" }}
            aria-hidden="true"
          />
          <p
            className="font-store-mono mx-auto inline-flex rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ background: "rgba(255,255,255,0.16)", color: "var(--on-accent)" }}
          >
            {dict.thisVoucherIsWorth}
          </p>
          {/* min-h + flex-center keeps every card the same height whichever
              of voucherValueClass's 3 sizes the label renders at — matters on
              the /deals grid, where many of these sit side by side. */}
          <h1
            className="mt-3 flex min-h-[82px] flex-col items-center justify-center font-store-serif md:min-h-[120px]"
            style={{ color: "var(--on-accent)", textShadow: "0 2px 18px rgba(0,0,0,0.12)" }}
          >
            <span className="inline-flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
              <span className={`whitespace-nowrap ${voucherValueClass(offer.discountLabel)}`}>{offer.discountLabel}</span>
              <span className="sv-voucher-suffix uppercase">{preposition}</span>
            </span>
            {rest && <span className="sv-voucher-suffix mt-1.5 block uppercase">{rest}</span>}
            {offer.offerSubline && (
              <span className="mt-3 block font-store-serif text-[20px] font-bold leading-tight md:text-[26px]" style={{ color: "var(--on-accent)" }}>
                {offer.offerSubline}
              </span>
            )}
          </h1>
        </div>

        {/* c. Perforation — the two notches are real holes (a CSS mask), not
            circles painted in a guessed background color, so whatever sits
            behind the card (the hero's gradient, the /deals page) shows
            through, and the wrapper's drop-shadow follows the cut-out. */}
        <div className="sv-voucher-perforation relative h-[26px]" style={{ background: "var(--page)" }}>
          <div
            className="absolute left-1/2 top-1/2 w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 border-t-2 border-dashed"
            style={{ borderColor: "var(--border-strong)" }}
          />
        </div>

        {/* d. Redemption */}
        <div className="px-4 pb-5 pt-3 md:px-6 md:pb-6" style={{ background: "var(--page)" }}>
          {hasCode && (
            <div
              className="mb-3 flex h-14 items-center justify-between gap-3 rounded-2xl border-2 border-dashed px-4"
              style={{
                borderColor: busy ? "var(--success)" : "color-mix(in srgb, var(--accent) 45%, transparent)",
                background: busy ? "color-mix(in srgb, var(--success) 14%, var(--page))" : "color-mix(in srgb, var(--accent) 6%, var(--page))",
              }}
            >
              <span className="flex min-w-0 items-center gap-2.5" style={{ color: busy ? "var(--text)" : "var(--accent-ink)" }}>
                <TagIcon />
                <span className="font-store-mono truncate text-[20px] font-semibold tracking-[0.18em] md:text-[22px]" style={{ color: "var(--text)" }}>
                  {busy ? offer.code : maskCode(offer.code ?? "")}
                </span>
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold uppercase tracking-wide"
                style={{ color: busy ? "var(--text)" : "var(--muted-text)" }}
              >
                {busy ? (
                  <>
                    <CheckIcon />
                    {dict.copied}
                  </>
                ) : (
                  <CopyIcon />
                )}
              </span>
            </div>
          )}

          <a
            href={offer.affiliateUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            onClick={handleActivate}
            aria-label={hasCode ? dict.copyDiscountCodeAria : dict.copyDealLinkAria}
            className="sv-cta-shine group relative flex h-[60px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-5 text-[18px] font-extrabold tracking-tight shadow-[0_12px_24px_-12px_rgba(0,0,0,0.55)] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.985] md:h-[64px] md:text-[19px]"
            style={busy ? { background: "var(--text)", color: "var(--page)" } : { background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2.5">
                <CheckIcon />
                {dict.copied}
                {isLoading && <CountdownRing value={ctaCountdown} durationSeconds={CTA_COUNTDOWN_TOTAL_SECONDS} />}
              </span>
            ) : (
              <>
                <CopyIcon />
                {buttonLabel}
                <ArrowIcon />
              </>
            )}
          </a>
          <p className="mt-2 text-center text-[12.5px] font-medium" style={{ color: "var(--muted-text)" }}>
            {busy ? (hasCode ? dict.pasteAtCheckout : dict.redirectingNow) : hasCode ? dict.tapToCopyCode : dict.tapToLoadDeal}
          </p>

          {footerNote ?? (
            <p className="mt-3 rounded-xl px-3 py-2.5 text-center text-[12.5px] leading-snug" style={{ background: "var(--muted)", color: "var(--text-soft)" }}>
              <strong style={{ color: "var(--text)" }}>{offer.delayNoteBold}</strong> {offer.delayNoteRest}
            </p>
          )}

          {finePrint.length > 0 && (
            <p className="font-store-mono mt-3.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--muted-text)" }}>
              {finePrint.map((part, i) => (
                <span key={part} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
