import type { CouponCard } from "@/lib/data";
import { sendBeacon } from "@/lib/beacon";
import { hasHumanActivity } from "@/lib/humanPresence";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export interface CouponInteractionMeta {
  storeSlug?: string | null;
  couponId?: string | null;
  couponCode?: string | null;
  destinationUrl?: string | null;
}


export function copyCouponCode(code?: string | null, meta?: CouponInteractionMeta) {
  if (!code) return;
  // Callers must run this *before* opening the merchant tab: the async
  // clipboard write needs the transient user activation that window.open
  // consumes, so on iOS the copy silently failed whenever it ran second.
  // Wrapped in try/catch, not just the promise's .catch(): some mobile
  // browsers throw synchronously (not a rejected promise) when clipboard
  // access is denied/unavailable in the current context, which would
  // otherwise abort this whole function before sendBeacon runs — and abort
  // the caller before it gets to its own setCopied(true), silently killing
  // any "Copied!" UI feedback on exactly the mobile browsers where the
  // clipboard write is most likely to be restricted in the first place.
  try {
    navigator.clipboard?.writeText(code)?.catch(() => {});
  } catch {
    // Swallow — the UI feedback and tracking beacon below must still fire.
  }
  sendBeacon("/api/engagement", {
    path: location.pathname,
    type: "coupon_copy",
    couponCode: code,
    storeSlug: meta?.storeSlug ?? null,
    couponId: meta?.couponId ?? null,
    hadPointer: hasHumanActivity(),
  });
}

export function trackCouponClick(
  googleAdsConversionId?: string | null,
  googleAdsConversionLabel?: string | null,
  meta?: CouponInteractionMeta
) {
  window.gtag?.("event", "select_promotion", { promotion_name: "coupon_click" });
  if (googleAdsConversionId && googleAdsConversionLabel) {
    window.gtag?.("event", "conversion", { send_to: `${googleAdsConversionId}/${googleAdsConversionLabel}` });
  }
  sendBeacon("/api/engagement", {
    path: location.pathname,
    type: "affiliate_click",
    storeSlug: meta?.storeSlug ?? null,
    couponId: meta?.couponId ?? null,
    couponCode: meta?.couponCode ?? null,
    destinationUrl: meta?.destinationUrl ?? null,
    hadPointer: hasHumanActivity(),
  });
}

/** Same engagement pipeline as coupon clicks, just without a coupon code/id — bundles have no code to copy. */
export function trackBundleClick(
  googleAdsConversionId?: string | null,
  googleAdsConversionLabel?: string | null,
  meta?: { storeSlug?: string | null; destinationUrl?: string | null }
) {
  window.gtag?.("event", "select_promotion", { promotion_name: "bundle_click" });
  if (googleAdsConversionId && googleAdsConversionLabel) {
    window.gtag?.("event", "conversion", { send_to: `${googleAdsConversionId}/${googleAdsConversionLabel}` });
  }
  sendBeacon("/api/engagement", {
    path: location.pathname,
    type: "affiliate_click",
    storeSlug: meta?.storeSlug ?? null,
    destinationUrl: meta?.destinationUrl ?? null,
    hadPointer: hasHumanActivity(),
  });
}

/**
 * Partial preview of a coupon code for the voucher card's post-reveal code
 * chip — enough visible to look like a real code, never enough to use
 * without tapping to copy. Codes below 5 characters are masked entirely
 * rather than leaving only one char covered.
 */
export function maskCode(code: string): string {
  if (code.length <= 4) return "••••";
  return `••••${code.slice(-3)}`;
}

/** Last few characters of a URL (protocol/trailing-slash stripped) — used as the hover preview on "Get Deal" buttons that have no code to show instead. */
export function urlTail(url: string, length = 10) {
  const cleaned = url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return cleaned.length > length ? cleaned.slice(-length) : cleaned;
}

/** Same masked-preview treatment as maskCode, for the voucher's "Get Deal" button (code-less offers) — reveals the last 3 characters of the destination URL instead of a coupon code. */
export function maskUrlTail(url: string): string {
  return `••••${urlTail(url, 3)}`;
}

export function discountLabel(coupon: Pick<CouponCard, "discountType" | "discountValue" | "type">) {
  if (coupon.discountType === "percentage" && coupon.discountValue) return `${coupon.discountValue}% OFF`;
  if (coupon.discountType === "fixed" && coupon.discountValue) return `$${coupon.discountValue} OFF`;
  return coupon.type === "deal" ? "DEAL" : "CODE";
}

/** Short form used on the coupon ticket card, e.g. "Oct 13". */
export function formatExpiryShort(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Long form used in the coupon detail modal, e.g. "October 13, 2030". */
export function formatExpiryLong(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
