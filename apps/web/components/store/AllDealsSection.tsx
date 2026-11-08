"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { CopyIcon, CheckIcon } from "@/components/CouponIcons";
import { copyCouponCode, maskCode, maskUrlTail } from "@/lib/couponInteraction";
import { useCenterFocus } from "@/lib/useCenterFocus";
import { StoreMark } from "./StoreMark";
import type { CouponCard } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { formatFixedAmount } from "@monocoupon/validation";

const CTA_COUNTDOWN_SECONDS = 3; // displayed ticks: 3, 2, 1
const CTA_COUNTDOWN_TOTAL_SECONDS = 0.5; // real elapsed time before opening — the 3 ticks are compressed to fit inside this
const CTA_COUNTDOWN_TICK_MS = (CTA_COUNTDOWN_TOTAL_SECONDS * 1000) / CTA_COUNTDOWN_SECONDS;

/** Same value/unit split the voucher's discountLabel uses, just derived per-card instead of from the single top coupon. No dedicated field distinguishes a site-wide policy (e.g. "free shipping") from a product-tied deal, so anything without a real percentage/fixed value falls back to a plain "Deal" — an admin can still make that distinction with the coupon's own title/description text. */
function cardValueParts(coupon: CouponCard, country: string | null | undefined, dict: Dictionary["allDeals"]): { value: string; unit: string } {
  if (coupon.discountType === "percentage" && coupon.discountValue) return { value: `${coupon.discountValue}%`, unit: dict.offUnit };
  if (coupon.discountType === "fixed" && coupon.discountValue) return { value: formatFixedAmount(coupon.discountValue, country), unit: dict.offUnit };
  return { value: dict.dealFallbackLabel, unit: "" };
}

function cardTag(coupon: CouponCard, isFeatured: boolean, dict: Dictionary["allDeals"]): string {
  if (isFeatured) return coupon.code ? dict.verifiedCode : dict.verifiedLink;
  return coupon.type === "code" ? dict.codeDeal : dict.productDeal;
}

/** Country override -> English, field by field — same fallback rule as deriveOffer (offerContent.ts), just for a coupon instead of the store's offer. Covers both content (title/description) and the actual referral link (code/affiliateUrl) — a coupon can override just its link for a country using a different affiliate network while still showing the English title. */
function localizedCoupon(coupon: CouponCard, country?: string | null): { title: string; description?: string; code: string | null; affiliateUrl: string | null } {
  const entry = country ? coupon.i18n?.find((e) => e.country === country) : null;
  return {
    title: entry?.title || coupon.title,
    description: entry?.description || coupon.description,
    code: entry?.code || coupon.code || null,
    affiliateUrl: entry?.affiliateUrl || coupon.affiliateUrl || null,
  };
}

/** Small ring identical in spirit to OfferVoucher's CountdownRing (same CSS classes from store.css), sized down for this section's compact pill buttons. Kept as its own copy here rather than importing from OfferVoucher.tsx, which this feature is explicitly scoped to leave untouched. */
function MiniCountdownRing({ value }: { value: number }) {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="sv-countdown-ring" aria-hidden="true" style={{ height: 20, width: 20 }}>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r={radius} fill="none" stroke="rgba(246,243,236,0.28)" strokeWidth="2" />
        <circle
          className="sv-countdown-progress"
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform="rotate(-90 10 10)"
          style={{ "--sv-countdown-circumference": circumference, animationDuration: `${CTA_COUNTDOWN_TOTAL_SECONDS}s` } as CSSProperties}
        />
      </svg>
      <span className="sv-countdown-number" style={{ fontSize: 10 }}>
        {value}
      </span>
    </span>
  );
}

/**
 * Same tap-to-copy behavior as the voucher's single CTA (OfferVoucher.tsx):
 * a real code gets a copy + "Copied!" + 3s countdown before the tab opens; a
 * code-less deal copies its link but opens immediately, no countdown. Each
 * card gets its own instance/state — clicking one doesn't affect the others.
 */
function DealCtaButton({
  coupon,
  featured,
  storeSlug,
  onActivate,
  dict,
  country,
}: {
  coupon: CouponCard;
  featured: boolean;
  storeSlug: string;
  onActivate: (meta: { couponId: string; couponCode: string | null; destinationUrl: string }) => void;
  dict: Dictionary["allDeals"];
  country?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    },
    []
  );

  const { code: localCode, affiliateUrl: localAffiliateUrl } = localizedCoupon(coupon, country);
  const destinationUrl = localAffiliateUrl || coupon.merchantUrl;
  const hasCode = Boolean(localCode);
  const label = hasCode ? dict.getCode : dict.getDeal;
  const hoverPreview = hasCode ? maskCode(localCode ?? "") : maskUrlTail(destinationUrl);
  const isLoading = countdown !== null;

  function handleActivate(e: MouseEvent<HTMLAnchorElement>) {
    const meta = { couponId: coupon._id, couponCode: localCode, destinationUrl };

    if (!hasCode) {
      // No countdown for a code-less deal — same as the voucher's own
      // "Get Deal" path, the visitor already expects an instant new tab.
      try {
        navigator.clipboard?.writeText(destinationUrl)?.catch(() => {});
      } catch {
        // Swallow — UI feedback must still fire even if clipboard access is denied.
      }
      flushSync(() => setCopied(true));
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2500);
      onActivate(meta);
      return;
    }

    e.preventDefault();
    copyCouponCode(localCode, { storeSlug, couponId: coupon._id, couponCode: localCode, destinationUrl });
    flushSync(() => setCopied(true));
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    copiedTimeout.current = setTimeout(() => setCopied(false), 2500);

    if (countdown !== null) return;
    onActivate(meta);
    let remaining = CTA_COUNTDOWN_SECONDS;
    setCountdown(remaining);
    countdownInterval.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      window.open(destinationUrl, "_blank", "noopener,noreferrer");
      setCountdown(null);
    }, CTA_COUNTDOWN_TICK_MS);
  }

  const busy = copied || isLoading;
  // Touch devices have no :hover at all, so the masked-preview reveal below
  // would otherwise never show on a phone — `isFocused` tracks whether this
  // button is the one currently crossing the vertical center of the screen
  // as the visitor scrolls, giving hover-less devices an equivalent trigger
  // (no-op on real hover-capable devices — see useCenterFocus).
  const { ref: focusRef, isFocused } = useCenterFocus<HTMLAnchorElement>();

  return (
    <a
      ref={focusRef}
      href={destinationUrl}
      target="_blank"
      rel="nofollow sponsored noopener"
      onClick={handleActivate}
      aria-label={hasCode ? dict.copyDiscountCodeAria : dict.copyDealLinkAria}
      className="group relative flex h-[48px] w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full px-5 text-center text-[14px] font-extrabold transition-transform active:scale-[0.98] md:w-auto md:self-center"
      style={
        busy
          ? { background: "var(--text)", color: "var(--accent-on-dark)", border: "2px solid var(--accent)" }
          : featured
            ? { background: "var(--accent)", color: "var(--on-accent)" }
            : { background: "var(--primary)", color: "var(--page)" }
      }
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <CheckIcon />
          {dict.copied}
          {isLoading && <MiniCountdownRing value={countdown} />}
        </span>
      ) : (
        <span className="relative inline-flex items-center justify-center">
          {/* isFocused and the plain "opacity-0"/"opacity-100" it swaps in
              are never combined with the always-on "group-hover:opacity-*"
              class on the *same* span — Tailwind's generated utilities for
              a bare class and a variant of the same property are equally
              specific, so having both present at once leaves the outcome
              dependent on generation order rather than intent. Each span
              always renders exactly one opacity class. */}
          <span className={`inline-flex items-center gap-2 whitespace-nowrap transition-opacity ${isFocused ? "opacity-0" : "group-hover:opacity-0"}`}>
            <CopyIcon />
            {label} →
          </span>
          <span
            className={`absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap transition-opacity ${isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <CopyIcon />
            {hoverPreview}
          </span>
        </span>
      )}
    </a>
  );
}

function DealCard({
  coupon,
  featured,
  storeName,
  storeLogo,
  monogramLetter,
  storeSlug,
  onActivate,
  dict,
  country,
}: {
  coupon: CouponCard;
  featured: boolean;
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  storeSlug: string;
  onActivate: (meta: { couponId: string; couponCode: string | null; destinationUrl: string }) => void;
  dict: Dictionary["allDeals"];
  country?: string | null;
}) {
  const { value, unit } = cardValueParts(coupon, country, dict);
  const tag = cardTag(coupon, featured, dict);
  const { title, description } = localizedCoupon(coupon, country);

  return (
    <div
      className="overflow-hidden rounded-[18px]"
      style={{ background: "var(--card)", border: featured ? "2px solid var(--accent)" : "1px solid var(--border)" }}
    >
      {featured && (
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <span aria-hidden="true">★</span>
          {dict.bestOffer}
        </div>
      )}

      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:gap-5 md:p-5">
        <div className="flex items-start gap-4 md:contents">
          <div className="flex w-[68px] shrink-0 flex-col items-center gap-2 text-center md:w-[76px]">
            {/* `aspect-square w-full` — a true square, exactly as wide as the
                column (matching the value text below it), not stretched to
                that text's own shorter height. The border keeps a
                white-background logo from disappearing into this card's own
                near-white background — without it, that combination reads as
                no logo at all rather than a framed image. Not `priority`
                (StoreMark's default) — this is the same logo repeated once
                per row, and every card in this section sits below the fold,
                so eager-loading each instance would just compete for
                bandwidth against the actually-critical hero/voucher logo
                above. */}
            <StoreMark
              logo={storeLogo}
              letter={monogramLetter}
              name={storeName}
              priority={false}
              className="aspect-square w-full rounded-[14px] text-[26px]"
              style={{ background: "var(--muted)", color: "var(--text)", border: "1.5px solid var(--border)" }}
            />
            <div className="w-full">
              <p className="font-store-serif text-[30px] font-bold leading-none" style={{ color: "var(--accent-ink)" }}>
                {value}
              </p>
              {unit && (
                <p className="font-store-mono mt-1 text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-text)" }}>
                  {unit}
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
              style={
                featured
                  ? { background: "var(--sec-bg)", border: "1px solid var(--sec-br)", color: "var(--success)" }
                  : { background: "var(--muted)", color: "var(--muted-text)" }
              }
            >
              {tag}
            </span>
            <h3 className="mt-1.5 text-[15.5px] font-bold" style={{ color: "var(--text)" }}>
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-soft)" }}>
                {description}
              </p>
            )}
          </div>
        </div>

        <DealCtaButton coupon={coupon} featured={featured} storeSlug={storeSlug} onActivate={onActivate} dict={dict} country={country} />
      </div>
    </div>
  );
}

/**
 * Multi-offer list, reinstated below the single-voucher hero after the
 * redesign's one-offer-only approach measurably hurt revenue — visitors want
 * to see (and pick from) every deal we could verify, not just the best one.
 * Pulled from the same `coupons` list getStoreDetail already fetches (every
 * active Coupon for the store); the voucher above only ever used `coupons[0]`
 * — this section is what surfaces the rest. Renders nothing when the store
 * has just the one coupon, since this list would be redundant with the
 * voucher already showing it.
 */
export function AllDealsSection({
  coupons,
  storeName,
  storeLogo,
  monogramLetter,
  storeSlug,
  onActivate,
  dict,
  country,
}: {
  coupons: CouponCard[];
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  storeSlug: string;
  onActivate: (meta: { couponId: string; couponCode: string | null; destinationUrl: string }) => void;
  dict: Dictionary["allDeals"];
  country?: string | null;
}) {
  if (coupons.length <= 1) return null;

  const featuredId = coupons[0]._id;

  return (
    <section className="mx-auto max-w-[1240px] px-4 pt-10 pb-3 md:pt-14 md:pb-4">
      <p className="font-store-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "var(--accent-ink)" }}>
        {dict.eyebrow}
      </p>

      <h2 className="sv-section-heading font-store-serif mt-2" style={{ color: "var(--text)" }}>
        {dict.heading(coupons.length, storeName)}
      </h2>

      <div className="mt-6 flex flex-col gap-2">
        {coupons.map((coupon) => (
          <DealCard
            key={coupon._id}
            coupon={coupon}
            featured={coupon._id === featuredId}
            storeName={storeName}
            storeLogo={storeLogo}
            monogramLetter={monogramLetter}
            storeSlug={storeSlug}
            onActivate={onActivate}
            dict={dict}
            country={country}
          />
        ))}
      </div>

      <div className="mt-5 rounded-[13px] px-4 pt-4 pb-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="sv-body" style={{ color: "var(--text-soft)" }}>
          <strong style={{ color: "var(--text)" }}>{dict.wholeListStrong}</strong> {dict.wholeListRest(storeName)}
        </p>
      </div>
    </section>
  );
}
