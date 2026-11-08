"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { StoreMark } from "./StoreMark";
import { CopyIcon, CheckIcon } from "@/components/CouponIcons";
import { copyCouponCode, maskCode, maskUrlTail } from "@/lib/couponInteraction";
import { useCenterFocus } from "@/lib/useCenterFocus";
import type { DerivedOffer } from "@/lib/offerContent";
import type { Dictionary } from "@/lib/i18n";

/**
 * `discountSuffix` is authored as one string — "off {storeName}" / "at
 * {storeName}" by default (see offerContent.ts's deriveDiscountLabel; admin
 * can override it, but the form's own placeholder guides them to the same
 * shape). Split on the first space so the preposition can sit on the same
 * line as the discount value and the store name gets its own line below,
 * rather than the whole suffix riding along with either one.
 */
function splitSuffix(suffix: string): { preposition: string; rest: string } {
  const spaceIndex = suffix.indexOf(" ");
  if (spaceIndex === -1) return { preposition: suffix, rest: "" };
  return { preposition: suffix.slice(0, spaceIndex), rest: suffix.slice(spaceIndex + 1) };
}

/**
 * `sv-voucher-value`'s base size is tuned for a bare "$80"/"20%" (2-4
 * chars). Admins can also write a phrase like "Up To 10%" or "Buy 1 Get 1"
 * there, which wraps and blows up the card at that size — step down for
 * longer labels instead.
 */
function voucherValueClass(label: string): string {
  if (label.length > 10) return "sv-voucher-value sv-voucher-value--sm";
  if (label.length > 5) return "sv-voucher-value sv-voucher-value--md";
  return "sv-voucher-value";
}

/**
 * The main CTA's label text ("Get Code"/"Get Deal", 8 chars) was hardcoded
 * at a fixed 27px — fine in English, but translated labels ("Ottieni
 * Codice", "Obtenir le Code", 14-16 chars) measure wider than the button's
 * available width at that size on mobile (confirmed via canvas text
 * measurement on a 375px viewport: English ~148px fits easily in ~246px
 * available; Italian/French measure 262-281px, genuinely too wide), so
 * they'd wrap or clip. Same fix pattern as voucherValueClass above — step
 * down for longer labels, but mobile-only: on desktop the card is ~553px
 * wide (confirmed live), leaving 499px available — more than enough for
 * every current translation at the full 27px, so md:text-[27px] restores it
 * there rather than shrinking text that already fits.
 */
function ctaLabelClass(label: string): string {
  if (label.length > 10) return "text-[22px] md:text-[27px]";
  return "text-[27px]";
}

/**
 * Small ring that drains in one continuous motion across the *entire*
 * countdown span, with the current digit centered inside it — a fixed-size
 * badge next to a label that never changes length, so the CTA button never
 * reflows (and nothing below it, like the barcode, ever shifts). Mounted
 * once when the countdown starts and unmounted when it ends — deliberately
 * NOT keyed by `value`, so ticking 3→2→1 only updates the digit text and
 * never restarts the drain animation; it plays through once, start to finish.
 */
const COUNTDOWN_RING_RADIUS = 10;
const COUNTDOWN_RING_CIRCUMFERENCE = 2 * Math.PI * COUNTDOWN_RING_RADIUS;

function CountdownRing({ value, durationSeconds }: { value: number; durationSeconds: number }) {
  return (
    <span className="sv-countdown-ring" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r={COUNTDOWN_RING_RADIUS} fill="none" stroke="rgba(246,243,236,0.28)" strokeWidth="2.5" />
        <circle
          className="sv-countdown-progress"
          cx="13"
          cy="13"
          r={COUNTDOWN_RING_RADIUS}
          fill="none"
          stroke="var(--accent)"
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

/** Diagonal barcode-pattern strip — decorative, spans the full width of the terms strip. */
function Barcode() {
  return (
    <span
      className="block h-7 w-full"
      style={{
        opacity: 0.8,
        backgroundImage:
          "repeating-linear-gradient(90deg, var(--text) 0 2px, transparent 2px 4px, var(--text) 4px 5px, transparent 5px 9px, var(--text) 9px 12px, transparent 12px 14px)",
      }}
      aria-hidden="true"
    />
  );
}

/**
 * The centerpiece of the redesign: a scratch-off voucher card (stub / prize
 * field / perforation / reveal+terms). See design_handoff_store_page's
 * README §3 "The voucher" for the exact spec this ports.
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

  // Single button covers both mechanics, but the two now diverge on timing:
  // a real code is worth a beat to let the copy register before the tab
  // opens, since the code is useless if the visitor doesn't have it in hand
  // yet. A referral link has nothing to "have in hand" — the visitor already
  // expects a new tab the instant they tap "Get Deal", so that one just goes.
  const hasCode = Boolean(offer.code);
  const buttonLabel = hasCode ? dict.getCode : dict.getDeal;
  const hoverPreview = hasCode ? maskCode(offer.code ?? "") : maskUrlTail(offer.affiliateUrl);
  const isLoading = ctaCountdown !== null; // only ever true for the code path — see handleActivate
  // Touch devices have no :hover at all, so the masked-preview reveal below
  // would otherwise never show on a phone — `isFocused` tracks whether this
  // button is crossing the vertical center of the screen as the visitor
  // scrolls past it, giving hover-less devices an equivalent trigger (no-op
  // on real hover-capable devices — see useCenterFocus).
  const { ref: focusRef, isFocused } = useCenterFocus<HTMLAnchorElement>();

  function handleActivate(e: MouseEvent<HTMLAnchorElement>) {
    if (!hasCode) {
      // No countdown for a code-less deal — copy the link for the same
      // tap-to-copy affordance, but let the anchor's own target="_blank"
      // navigation proceed immediately (no preventDefault). That doesn't
      // race the clipboard write: target="_blank" opens a new tab without
      // tearing down this page's JS context, so the write still completes.
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

    // Coupon code: take over navigation ourselves — the clipboard write
    // needs the click's transient user activation, which the anchor's own
    // default navigation would otherwise consume before the write resolves.
    // Middle-click/right-click-"open in new tab" still work since those
    // bypass this handler and use the real href directly.
    e.preventDefault();
    copyCouponCode(offer.code, { storeSlug, couponId, couponCode: offer.code, destinationUrl: offer.affiliateUrl });
    // flushSync forces this state update to commit and paint immediately,
    // rather than trusting React's default batching/scheduling to land it
    // promptly on every mobile JS engine — cheap insurance for a state flip
    // that's reportedly not showing on some real mobile browsers.
    flushSync(() => setCopied(true));
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), 2500);

    // Copying also starts the countdown — the deal opens on its own once it
    // finishes, no second tap needed. The button keeps showing "Copied!"
    // (not just the timer) for the full countdown so the visitor never loses
    // track of whether the code actually landed in their clipboard.
    if (ctaCountdown !== null) return; // already counting down from an earlier tap
    onCtaClick(); // this now leads to a real handoff, so fire the same tracking a direct CTA click would
    let remaining = CTA_COUNTDOWN_SECONDS;
    setCtaCountdown(remaining);
    ctaCountdownInterval.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCtaCountdown(remaining);
        return;
      }
      if (ctaCountdownInterval.current) clearInterval(ctaCountdownInterval.current);
      // Only opened now, after the timer — nothing appears earlier. Most
      // browsers still allow this because a few seconds of "user activation"
      // carries over from the original click. Either way the button reverts
      // to its normal label right after — even if a stricter browser
      // silently blocked this, the button is once again a plain working
      // link the visitor can just click.
      window.open(offer.affiliateUrl, "_blank", "noopener,noreferrer");
      setCtaCountdown(null);
    }, CTA_COUNTDOWN_TICK_MS);
  }

  return (
    <div style={{ filter: "drop-shadow(0 14px 28px rgba(5,20,16,0.45))" }} className="md:[filter:drop-shadow(0_20px_40px_rgba(5,20,16,0.5))]">
      <div className="overflow-hidden rounded-[20px] md:rounded-[22px]" style={{ background: "var(--page)" }}>
        {/* a. Stub */}
        <div className="relative flex items-center gap-3 px-[15px] py-[15px] md:px-[18px]" style={{ background: "var(--text)" }}>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "repeating-linear-gradient(115deg, var(--accent-stripe) 0 1px, transparent 1px 7px)" }}
            aria-hidden="true"
          />
          <StoreMark
            logo={storeLogo}
            letter={monogramLetter}
            name={storeName}
            className="relative h-[34px] w-[34px] rounded-[9px] text-base"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          />
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-extrabold uppercase" style={{ color: "var(--page)" }}>
              {dict.voucherLabel(storeName)}
            </p>
            <p className="font-store-mono text-[10px] tracking-[0.06em]" style={{ color: "var(--success)" }}>
              {dict.serialLine(offer.serial)}
            </p>
          </div>
          {offer.verifiedDateShort && (
            <div
              className="relative flex shrink-0 flex-col items-center whitespace-nowrap rounded-[6px] px-2.5 py-1.5 text-center font-store-mono text-[11px] font-semibold leading-tight"
              style={{ border: "1.5px solid var(--accent)", color: "var(--accent)", transform: "rotate(-5deg)" }}
            >
              <span>{dict.verified}</span>
              <span>{offer.verifiedDateShort.toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* b. Prize field */}
        <div
          className="relative px-[18px] py-[22px] text-center md:px-[20px] md:py-[26px]"
          style={{ background: "var(--accent)" }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 9px)" }}
            aria-hidden="true"
          />
          <p className="relative font-store-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: "var(--on-accent-dim)" }}>
            {dict.thisVoucherIsWorth}
          </p>
          {/* min-h + flex-center: discountLabel can render at one of 3 font
              sizes (voucherValueClass, above) depending on its length — a
              bare "$300" gets the biggest size, a phrase like "Up To 40%"
              steps down. Left alone, that makes the prize field's own height
              vary card-to-card, which barely matters on the single-voucher
              /stores/[slug] page but is visibly inconsistent across the
              /deals grid (many voucher cards side by side). Reserving the
              same minimum height for every size variant, centered
              vertically, keeps every card the same height regardless of
              which discount label it happens to have. */}
          <h1
            className="relative mt-1 flex min-h-[82px] flex-col items-center justify-center font-store-serif md:min-h-[128px]"
            style={{ color: "var(--on-accent)" }}
          >
            {(() => {
              const { preposition, rest } = splitSuffix(offer.discountSuffix);
              return (
                <>
                  <span className="inline-flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
                    <span className={`whitespace-nowrap ${voucherValueClass(offer.discountLabel)}`}>{offer.discountLabel}</span>
                    <span className="sv-voucher-suffix uppercase">{preposition}</span>
                  </span>
                  <span className="sv-voucher-suffix mt-1 block uppercase">{rest}</span>
                </>
              );
            })()}
            {offer.offerSubline && (
              <span className="mt-1.5 block text-[14.5px] font-bold" style={{ color: "var(--on-accent-soft)" }}>
                {offer.offerSubline}
              </span>
            )}
          </h1>
        </div>

        {/* c. Perforation */}
        <div className="relative h-[24px] md:h-[26px]" style={{ background: "var(--page)" }}>
          <div className="absolute left-1/2 top-1/2 w-[calc(100%-26px)] -translate-x-1/2 -translate-y-1/2 border-t-2 border-dashed" style={{ borderColor: "var(--border-strong)" }} />
          <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full md:h-[26px] md:w-[26px]" style={{ background: "var(--primary)" }} aria-hidden="true" />
          <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full md:h-[26px] md:w-[26px]" style={{ background: "var(--primary)" }} aria-hidden="true" />
        </div>

        {/* d. Reveal + terms */}
        <div className="px-5 pb-[20px] pt-4 md:px-[22px]">
          {/* One button covers both mechanics — "Get Code" for a real coupon
              code, "Get Deal" when there's only a referral link — same box
              styling either way. Default state shows the label; hovering
              (desktop only, no-op on touch) reveals a masked last-3-chars
              preview, same as the code used to always show. Tapping copies
              and flashes "Copied!" either way, but only the code path also
              runs the 3s countdown before opening (kept alongside "Copied!"
              rather than replacing it, so the visitor never loses track of
              whether the code landed) — a code-less "Get Deal" tap opens
              immediately, since there's no code the visitor needs a moment
              to register first. */}
          <a
            ref={focusRef}
            href={offer.affiliateUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            onClick={handleActivate}
            aria-label={hasCode ? dict.copyDiscountCodeAria : dict.copyDealLinkAria}
            className="group relative flex h-[78px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] px-4 text-center transition-transform active:scale-[0.98] md:h-[88px]"
            style={{ background: "var(--text)", color: "var(--accent-on-dark)", border: "2.5px solid var(--accent)" }}
          >
            {copied || isLoading ? (
              <span className="inline-flex items-center gap-2.5">
                <span className={`font-store-mono ${ctaLabelClass(dict.copied)} font-semibold tracking-[0.1em]`}>{dict.copied}</span>
                <CheckIcon />
                {/* isLoading (the 3s countdown) can outlast the 2.5s `copied`
                    flash by up to half a second — keeping this branch keyed
                    on `copied || isLoading` (not just `copied`) means the
                    button stays on "Copied!" for the ring's entire run
                    instead of flashing back to the default label right
                    before it auto-opens. */}
                {isLoading && <CountdownRing value={ctaCountdown} durationSeconds={CTA_COUNTDOWN_TOTAL_SECONDS} />}
              </span>
            ) : (
              <span className="relative inline-flex items-center justify-center">
                {/* isFocused and the plain "opacity-0"/"opacity-100" it swaps
                    in are never combined with the always-on
                    "group-hover:opacity-*" class on the *same* span —
                    Tailwind's generated utilities for a bare class and a
                    variant of the same property are equally specific, so
                    having both present at once leaves the outcome dependent
                    on generation order rather than intent. Each span always
                    renders exactly one opacity class. */}
                <span className={`inline-flex items-center gap-2.5 transition-opacity ${isFocused ? "opacity-0" : "group-hover:opacity-0"}`}>
                  <span className={`font-store-mono ${ctaLabelClass(buttonLabel)} font-semibold tracking-[0.1em]`}>{buttonLabel}</span>
                  <CopyIcon />
                </span>
                <span
                  className={`absolute inset-0 inline-flex items-center justify-center gap-2.5 transition-opacity ${isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                >
                  <span className={`font-store-mono ${ctaLabelClass(hoverPreview)} font-semibold tracking-[0.1em]`}>{hoverPreview}</span>
                  <CopyIcon />
                </span>
              </span>
            )}
            <span className="sv-caption" style={{ color: "var(--success)" }}>
              {copied || isLoading ? (hasCode ? dict.pasteAtCheckout : dict.redirectingNow) : hasCode ? dict.tapToCopyCode : dict.tapToLoadDeal}
            </span>
          </a>

          {footerNote ?? (
            <p className="mt-3 text-center text-[12.5px]" style={{ color: "var(--text-soft)" }}>
              <strong style={{ color: "var(--text)" }}>{offer.delayNoteBold}</strong> {offer.delayNoteRest}
            </p>
          )}

          <div className="mt-3.5 border-t border-dashed pt-3.5" style={{ borderColor: "var(--border)" }}>
            <Barcode />
            <p className="font-store-mono mt-2 text-center text-[9.5px] tracking-wide" style={{ color: "var(--muted-text)" }}>
              {dict.onePerOrderNoExpiry}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
