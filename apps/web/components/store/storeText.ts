import type { Dictionary } from "@/lib/i18n";
import type { DerivedOffer } from "@/lib/offerContent";

/**
 * Store-page UI copy with every templated (function-valued) dictionary entry
 * already filled in.
 *
 * Why: StoreDetailViewV2 is a server component, and a server component can't
 * hand functions to client components. The dictionary's function entries
 * (`enjoyOffer(label, suffix)` and friends) only ever take values the server
 * already has (store name, discount label, dates), so they're resolved there
 * and the client components receive plain strings. That also keeps the
 * en/fr/it dictionaries themselves out of the browser bundle entirely.
 *
 * Only the slices consumed by client components are resolved here; server
 * components (ProofStrip, HonestyPanel, StoreFooter, ...) keep taking the raw
 * Dictionary slices.
 */

type Text<T, K extends keyof T, R> = Omit<T, K> & { [P in K]: R };

export type StoreHeaderText = Text<Dictionary["storeHeader"], "enjoyOffer" | "testedLiveOffer" | "ctaAriaLabel", string>;
export type StoreHeroText = Omit<Dictionary["storeHero"], "liveOffer" | "ownCutsLine" | "steps"> & {
  liveOffer: string;
  ownCutsLine: string;
  steps: { title: string; body: string }[];
};
export type OfferVoucherText = Text<Dictionary["offerVoucher"], "voucherLabel" | "serialLine", string>;
export type StickyMobileBarText = Text<Dictionary["stickyMobileBar"], "enjoyOffer" | "testedPrefix", string>;
export type AllDealsText = Text<Dictionary["allDeals"], "heading" | "wholeListRest", string>;

export function resolveOfferVoucherText(dict: Dictionary["offerVoucher"], storeName: string, offer: Pick<DerivedOffer, "serial">): OfferVoucherText {
  return { ...dict, voucherLabel: dict.voucherLabel(storeName), serialLine: dict.serialLine(offer.serial) };
}

export function resolveStoreText(dict: Dictionary, storeName: string, offer: DerivedOffer, couponCount: number) {
  const header: StoreHeaderText = {
    ...dict.storeHeader,
    enjoyOffer: dict.storeHeader.enjoyOffer(offer.discountLabel, offer.discountSuffix),
    testedLiveOffer: offer.verifiedDateShort ? dict.storeHeader.testedLiveOffer(offer.verifiedDateShort) : "",
    ctaAriaLabel: dict.storeHeader.ctaAriaLabel(Boolean(offer.code), storeName),
  };
  const hero: StoreHeroText = {
    ...dict.storeHero,
    liveOffer: dict.storeHero.liveOffer(offer.verifiedDateLong),
    ownCutsLine: dict.storeHero.ownCutsLine(storeName, offer.discountLabel),
    steps: dict.storeHero.steps(Boolean(offer.code), storeName, offer.discountLabel),
  };
  const stickyMobileBar: StickyMobileBarText = {
    ...dict.stickyMobileBar,
    enjoyOffer: dict.stickyMobileBar.enjoyOffer(offer.discountLabel, offer.discountSuffix),
    testedPrefix: offer.verifiedDateShort ? dict.stickyMobileBar.testedPrefix(offer.verifiedDateShort) : "",
  };
  const allDeals: AllDealsText = {
    ...dict.allDeals,
    heading: dict.allDeals.heading(couponCount, storeName),
    wholeListRest: dict.allDeals.wholeListRest(storeName),
  };
  return { header, hero, offerVoucher: resolveOfferVoucherText(dict.offerVoucher, storeName, offer), stickyMobileBar, allDeals };
}

/** The storeHeader slice for pages with no live offer — the header then shows no CTA, so the offer-specific lines are never rendered. */
export function resolveEmptyHeaderText(dict: Dictionary["storeHeader"]): StoreHeaderText {
  return { ...dict, enjoyOffer: "", testedLiveOffer: "", ctaAriaLabel: "" };
}
