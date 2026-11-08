/**
 * PPC-sitelink landing page variants of /stores/[slug] — same store data and
 * coupons, different heading/meta copy per URL so each Google Ads sitelink
 * has its own distinct-looking landing page. See lib/storeVariantPage.tsx
 * for how these get wired into actual routes.
 *
 * The actual copy (tagline/metaTitle/metaDescription, in every supported
 * language) lives in apps/web/lib/i18n/{en,it,fr}.ts's `variants` section —
 * this file is now just the canonical list of variant keys/route segments,
 * kept as a real object (rather than a plain string array) so
 * `Dictionary["variants"]` can enforce every locale supplies all of them via
 * `Record<StoreVariantKey, ...>`.
 *
 * `tagline` is the one piece of ON-PAGE (not just <head>) copy that differs
 * per variant — rendered as a small eyebrow line in StoreHero, above the
 * store identity row. The redesign's actual <h1> lives inside the voucher
 * and must always be the store name + discount (see offerContent.ts's
 * genericLede and OfferVoucher.tsx), so it can't carry this — but Google Ads
 * policy requires sitelink destination pages to be more than identical
 * content behind different URLs, and metaTitle/metaDescription alone (both
 * <head>-only, invisible to a visitor) don't satisfy that. `undefined` on
 * the canonical /stores/[slug] route (no tagline passed there at all).
 */
export const STORE_VARIANTS = {
  "never-pay-full": true,
  "todays-deals": true,
  "free-shipping-codes": true,
  "exclusive-offers": true,
  "secret-codes": true,
  "exclusive-deals": true,
} as const;

export type StoreVariantKey = keyof typeof STORE_VARIANTS;
