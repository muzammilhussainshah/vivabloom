import { STORE_VARIANTS } from "@/lib/storeVariants";
import { SUPPORTED_COUNTRY_CODES } from "@monocoupon/validation";

// The canonical /stores/[slug] page and its PPC sitelink variants
// (/never-pay-full/[slug], …) render identical store data, so cache
// operations (bust, warm) must treat them as one set. Keeping this in one
// place means the revalidate route and the cron warmer never drift apart, and
// adding a new variant to STORE_VARIANTS wires it into both automatically.
const VARIANT_PREFIXES = Object.keys(STORE_VARIANTS);

/**
 * Canonical path plus every PPC variant path for a single store slug — the
 * English ones (unprefixed) plus every /{country}/... sibling (see
 * app/(store)/[country]/) for every country in SUPPORTED_COUNTRIES. A
 * country-prefixed page always renders something valid (deriveOffer falls
 * back to English field-by-field, see offerContent.ts) even before any
 * Store.i18n content is authored for it, so warming/revalidating all of them
 * unconditionally is correct, not wasted work — an admin edit to a store's
 * base English content should also refresh its (currently English-fallback)
 * localized pages, not just the canonical one.
 */
export function storePathsForSlug(slug: string): string[] {
  const englishPaths = [`/stores/${slug}`, ...VARIANT_PREFIXES.map((prefix) => `/${prefix}/${slug}`)];
  const localizedPaths = SUPPORTED_COUNTRY_CODES.flatMap((country) => [
    `/${country}/stores/${slug}`,
    ...VARIANT_PREFIXES.map((prefix) => `/${country}/${prefix}/${slug}`),
  ]);
  return [...englishPaths, ...localizedPaths];
}

/**
 * Expands a canonical `/stores/[slug]` path into itself plus its variant
 * paths; any other path (list pages, home, sitemap, …) passes through
 * unchanged.
 */
export function expandStorePaths(path: string): string[] {
  const match = path.match(/^\/stores\/([^/]+)$/);
  if (!match) return [path];
  return storePathsForSlug(match[1]);
}
