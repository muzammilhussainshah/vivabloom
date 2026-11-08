import type { StoreCard, CouponCard, StoreOfferRaw, StoreLocaleOfferRaw } from "@/lib/data";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { formatFixedAmount } from "@monocoupon/validation";

export type Mechanic = "link" | "code" | "popup";

/**
 * Whether the mechanic-driven copy matrix (design_handoff_store_page/README's
 * "Content matrix") shows a code in the handoff modal — a behavior flag, not
 * translatable text, so it stays here rather than in the per-locale
 * dictionary (apps/web/lib/i18n/*.ts), which supplies the actual copy for
 * each mechanic (delayNoteBold/delayNoteRest/proofStep2Body/handoffStep2Body)
 * via getDictionary(country).mechanic below.
 */
const MECHANIC_SHOWS_CODE_IN_HANDOFF: Record<Mechanic, boolean> = {
  link: false,
  code: true,
  popup: false,
};

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Auto-derived only — an admin-typed `discountLabel`/`discountSuffix`
 * override (base or per-country) always wins over this and is taken
 * verbatim, never touched (see the deriveOffer return below). This function
 * only ever runs to fill in what an admin *hasn't* written, so it's the only
 * place a currency symbol needs to be chosen for a country (formatFixedAmount,
 * @monocoupon/validation) — free-text overrides are the admin's own words.
 */
function deriveDiscountLabel(coupon: CouponCard | null, storeName: string, country: string | null | undefined, dict: Dictionary): { label: string; suffix: string } {
  if (coupon?.discountType === "percentage" && coupon.discountValue) {
    return { label: `${coupon.discountValue}%`, suffix: dict.offerFallbacks.discountSuffixOff(storeName) };
  }
  if (coupon?.discountType === "fixed" && coupon.discountValue) {
    return { label: formatFixedAmount(coupon.discountValue, country), suffix: dict.offerFallbacks.discountSuffixOff(storeName) };
  }
  return { label: dict.offerFallbacks.dealFallbackLabel, suffix: dict.offerFallbacks.discountSuffixAt(storeName) };
}

export interface DerivedOffer {
  hasOffer: boolean;
  mechanic: Mechanic;
  code: string | null;
  affiliateUrl: string;
  discountLabel: string;
  discountSuffix: string;
  offerSubline: string | null;
  lede: string | null;
  verifiedDate: Date | null;
  verifiedDateShort: string | null;
  verifiedDateLong: string | null;
  nextCheckDateShort: string | null;
  verifierName: string;
  usageCount: string | null;
  trustChecks: string[];
  notOffered: string[];
  proofScreenshots: string[];
  serial: string;
  monogramLetter: string;
  delayNoteBold: string;
  delayNoteRest: string;
  proofStep2Body: string;
  handoffStep2Body: string;
  showsCodeInHandoff: boolean;
}

/**
 * Merges an admin-authored Store.offer over defaults derived from the
 * store's existing top-priority Coupon, so every store with at least one
 * Coupon renders a complete voucher on day one — no page goes blank while
 * content is authored per store. `notOffered` falls back to generic,
 * defensible copy (GENERIC_NOT_OFFERED) until an admin writes store-specific
 * lines; `proofScreenshots` has no fallback at all (can't be safely
 * fabricated) — callers should omit that section when it's empty. Returns
 * `hasOffer: false` only when there's neither an authored offer nor any
 * Coupon at all — the
 * genuine "no verified offer" case.
 *
 * `country` (optional) resolves a matching entry in `store.i18n` and merges
 * it in ahead of everything above: for each field the order is
 * locale override -> base (English) offer/derived value. A country entry can
 * be as sparse as just a different `code`/`affiliateUrl` — any field it
 * doesn't set falls straight through to the same English value the page
 * would otherwise show, never a blank or a mistranslation. Omitting
 * `country` (or passing one with no matching `store.i18n` entry) reproduces
 * today's English-only behavior exactly.
 */
export function deriveOffer(
  store: Pick<StoreCard, "name" | "slug" | "i18n">,
  offer: StoreOfferRaw | null | undefined,
  topCoupon: CouponCard | null,
  websiteUrl: string,
  country?: string | null
): DerivedOffer {
  const dict = getDictionary(country);
  const localeOffer: StoreLocaleOfferRaw | null = country ? (store.i18n?.find((entry) => entry.country === country) ?? null) : null;

  const hasOffer = Boolean(localeOffer?.mechanic || localeOffer?.discountLabel || offer?.mechanic || offer?.discountLabel || topCoupon);
  const mechanic: Mechanic = localeOffer?.mechanic ?? offer?.mechanic ?? (topCoupon?.code ? "code" : "link");
  const copy = dict.mechanic[mechanic];
  const code = localeOffer?.code ?? offer?.code ?? topCoupon?.code ?? null;

  const { label: derivedLabel, suffix: derivedSuffix } = deriveDiscountLabel(topCoupon, store.name, country, dict);

  // Always "yesterday" (relative to whenever this page was generated — these
  // routes are ISR'd, see revalidate in stores/[slug]/page.tsx) unless an
  // admin sets a real verified date. Deliberately does NOT fall back to the
  // coupon's lastCheckedAt: that field isn't a trustworthy "we checked this"
  // timestamp in practice (it tracks closer to when the coupon record was
  // created than to an actual verification), so using it was showing a
  // stale/misleading date instead of the always-fresh "yesterday" the page
  // is supposed to read as. Only applies when there's actually an offer to
  // show — a store with no offer at all gets the empty state instead, which
  // has no verified-date UI to fill in.
  const verifiedDateRaw = localeOffer?.verifiedDate ?? offer?.verifiedDate ?? (hasOffer ? new Date(Date.now() - 86400000).toISOString() : null);
  const verifiedDate = verifiedDateRaw ? new Date(verifiedDateRaw) : null;
  const nextCheckDateRaw = localeOffer?.nextCheckDate ?? offer?.nextCheckDate ?? (verifiedDate ? new Date(verifiedDate.getTime() + 7 * 86400000).toISOString() : null);
  const nextCheckDate = nextCheckDateRaw ? new Date(nextCheckDateRaw) : null;

  const trustChecks = localeOffer?.trustChecks?.length ? localeOffer.trustChecks : offer?.trustChecks?.length ? offer.trustChecks : dict.offerFallbacks.trustChecks;
  const notOffered = localeOffer?.notOffered?.length ? localeOffer.notOffered : offer?.notOffered?.length ? offer.notOffered : dict.offerFallbacks.notOffered;
  const affiliateUrl = localeOffer?.affiliateUrl || offer?.affiliateUrl || topCoupon?.affiliateUrl || topCoupon?.merchantUrl || websiteUrl;

  const serialSlug = store.slug.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const serialDate = verifiedDate ?? new Date();
  const serial = `MC-${serialSlug}-${String(serialDate.getMonth() + 1).padStart(2, "0")}${String(serialDate.getDate()).padStart(2, "0")}`;

  return {
    hasOffer,
    mechanic,
    code,
    affiliateUrl,
    discountLabel: localeOffer?.discountLabel || offer?.discountLabel || derivedLabel,
    discountSuffix: localeOffer?.discountSuffix || offer?.discountSuffix || derivedSuffix,
    offerSubline: localeOffer?.offerSubline || offer?.offerSubline || null,
    lede: localeOffer?.lede || offer?.lede || dict.offerFallbacks.lede(store.name, verifiedDate ? formatDateLong(verifiedDate) : null),
    verifiedDate,
    verifiedDateShort: verifiedDate ? formatDateShort(verifiedDate) : null,
    verifiedDateLong: verifiedDate ? formatDateLong(verifiedDate) : null,
    nextCheckDateShort: nextCheckDate ? formatDateShort(nextCheckDate) : null,
    verifierName: localeOffer?.verifierName || offer?.verifierName || dict.offerFallbacks.defaultVerifierName,
    usageCount: localeOffer?.usageCount || offer?.usageCount || null,
    trustChecks,
    notOffered,
    proofScreenshots: offer?.proofScreenshots ?? [],
    serial,
    monogramLetter: store.name.charAt(0).toUpperCase(),
    delayNoteBold: copy.delayNoteBold,
    delayNoteRest: copy.delayNoteRest(store.name),
    proofStep2Body: copy.proofStep2Body(store.name),
    handoffStep2Body: copy.handoffStep2Body(store.name),
    showsCodeInHandoff: MECHANIC_SHOWS_CODE_IN_HANDOFF[mechanic],
  };
}
