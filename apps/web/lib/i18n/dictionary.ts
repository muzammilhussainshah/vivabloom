import type { StoreVariantKey } from "@/lib/storeVariants";

/**
 * Fixed site chrome for the store-detail routes: button labels, section
 * headings, aria-labels, footer/header copy, PPC-variant taglines. This is
 * deliberately separate from admin-authored store content (Store.offer /
 * Store.i18n, see offerContent.ts) — chrome is translated once per country
 * here and never admin-editable, whereas store content falls back
 * field-by-field to English when a country override isn't authored (see
 * deriveOffer in offerContent.ts). Also separate from the GENERIC_TRUST_CHECKS
 * / GENERIC_NOT_OFFERED / genericLede fallback templates in offerContent.ts,
 * which stay English-only by design (per explicit product decision — an
 * unauthored field shows the English content, not a translated placeholder).
 *
 * MECHANIC_COPY (the mechanic-driven instructional microcopy) IS included
 * here, unlike the generic content fallbacks above — it's never
 * admin-authored (always derived purely from the `mechanic` enum), so it's
 * chrome, not content.
 */
export interface MechanicChromeEntry {
  delayNoteBold: string;
  delayNoteRest: (storeName: string) => string;
  proofStep2Body: (storeName: string) => string;
  handoffStep2Body: (storeName: string) => string;
}

export interface Dictionary {
  /** apps/web/app/(store)/stores/[slug]/page.tsx canonical <title>. */
  canonicalMetaTitle: (storeName: string) => string;

  /** apps/web/lib/storeVariants.ts — the 6 PPC-sitelink variant routes. */
  variants: Record<
    StoreVariantKey,
    {
      tagline: (storeName: string) => string;
      metaTitle: (storeName: string) => string;
      metaDescription: (storeName: string) => string;
    }
  >;

  /** apps/web/lib/offerContent.ts — MECHANIC_COPY. Chrome, not admin content (see file header note). */
  mechanic: {
    link: MechanicChromeEntry;
    code: MechanicChromeEntry;
    popup: MechanicChromeEntry;
  };

  storeHeader: {
    testedLiveOffer: (dateShort: string) => string; // "Tested {date} · 1 live offer"
    copied: string;
    getDiscountCode: string;
    getDiscountDeal: string;
    ctaAriaLabel: (hasCode: boolean, storeName: string) => string;
    searchAriaLabel: string;
  };

  storeHero: {
    home: string;
    liveOffer: (testedDateLong: string | null) => string; // "1 live offer" or "1 live offer, tested {date}"
    onTheRightPage: string;
    ownCutsLine: (storeName: string, discountLabel: string) => string;
    bundleAriaLabel: string;
  };

  offerVoucher: {
    voucherLabel: (storeName: string) => string; // "{storeName} Voucher"
    serialLine: (serial: string) => string; // "NO. {serial} · 1 OF 1"
    verified: string;
    thisVoucherIsWorth: string;
    getCode: string;
    getDeal: string;
    copied: string;
    pasteAtCheckout: string;
    redirectingNow: string;
    tapToCopyCode: string;
    tapToLoadDeal: string;
    onePerOrderNoExpiry: string;
    copyDiscountCodeAria: string;
    copyDealLinkAria: string;
  };

  stickyMobileBar: {
    liveOffer: string;
    testedPrefix: (dateShort: string) => string; // "Tested {date} · "
    getDiscountCode: string;
    getDiscountDeal: string;
  };

  allDeals: {
    eyebrow: string; // "Every live offer"
    heading: (count: number, storeName: string) => string;
    verifiedCode: string;
    verifiedLink: string;
    codeDeal: string;
    productDeal: string;
    bestOffer: string;
    getCode: string;
    getDeal: string;
    copied: string;
    copyDiscountCodeAria: string;
    copyDealLinkAria: string;
    wholeListStrong: string; // "That's the whole list."
    wholeListRest: (storeName: string) => string;
    offUnit: string; // "OFF" — the small label under a card's discount value
    dealFallbackLabel: string; // "Deal" — when a coupon has no percentage/fixed value to show
  };

  honesty: {
    eyebrow: string; // "No padding, no guessing"
    heading: (storeName: string) => string;
    body: string;
    lastFullCheckPrefix: string; // "Last full check " — the date itself renders bold, right after this
    lastFullCheckSuffix: (verifierName: string) => string; // " by {name}."
    nextCheck: (dateShort: string) => string; // " Next check {date}."
    whatStoreDoesNotOffer: (storeName: string) => string;
  };

  proof: {
    eyebrow: string; // "Proof, not promises"
    heading: string;
    subheading: (storeName: string) => string;
    step1: (storeName: string) => string;
    step3: (discountLabel: string) => string;
    didntLandStrong: string;
    didntLandBeforeLink: string;
    tellUsLink: string;
    didntLandAfterLink: string;
  };

  howWeCheck: {
    heading: string;
    steps: [string, string, string];
    howWeMakeMoneyHeading: string;
    howWeMakeMoneyBody: string;
    questionsHeading: string;
  };

  handoff: {
    closeAria: string;
    dialogAriaLabel: (storeName: string) => string;
    yourCouponCode: string;
    copied: string;
    copyCode: string;
    copyCodeAndGetDeal: string;
    getDeal: string;
    bundleAndSave: string;
    extraOff: (percent: number) => string;
    save: (amount: string, percentSuffix: string) => string; // percentSuffix already formatted as " (12%)" or ""
    getThisBundle: string;
    details: string;
    // Shown instead of the bundle block above when the store has no bundles
    // at all — features a random Product in the same slot so the modal
    // still has an upsell. No "extra % off" badge or separate details link
    // for this case (Product has neither field, unlike Bundle).
    featuredProductHeading: string; // e.g. "You might also like"
    getThisProduct: string;
  };

  footer: {
    blurb: string;
    columns: { label: string; links: { href: string; label: string }[] }[];
    copyright: (year: number) => string;
  };

  emptyOffer: {
    heading: (storeName: string) => string;
    body: (storeName: string) => string;
    browseAllStores: string;
  };

  relatedArticles: {
    heading: string; // "Related reading"
    allArticles: string; // "All articles →" (arrow is appended in JSX, not part of this string)
  };

  /**
   * Fallback templates for admin-authorable Store content (offer.trustChecks/
   * notOffered/lede, offer.verifierName) — used only when NEITHER a
   * country-specific Store.i18n entry NOR the base Store.offer sets that
   * field (see deriveOffer in offerContent.ts). Translated per-locale (unlike
   * a genuinely unset admin field, which still falls back to English) since
   * these are the same fixed copy for every store, not per-store content —
   * closer to chrome than to authored content.
   */
  offerFallbacks: {
    trustChecks: string[];
    notOffered: string[];
    lede: (storeName: string, verifiedDateLong: string | null) => string;
    defaultVerifierName: string;
    discountSuffixOff: (storeName: string) => string; // "off {name}" — used whenever a real percentage/fixed value was found
    discountSuffixAt: (storeName: string) => string; // "at {name}" — used only with the dealFallbackLabel below
    dealFallbackLabel: string; // "Deal" — no percentage/fixed value on the top coupon at all
  };
}
