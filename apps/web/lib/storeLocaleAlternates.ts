import { SUPPORTED_COUNTRIES } from "@monocoupon/validation";

/**
 * hreflang alternates for a store's canonical page — every country's own
 * localized URL, keyed by that country's ISO 639-1 *language* code (e.g.
 * "da" for Denmark), not its URL segment/country code ("dk") — those happen
 * to be identical for most current entries (it/fr/de/es/nl/pl) but diverge
 * for Danish, and hreflang requires a real BCP47 language tag, not a bare
 * country code. Used by both the English canonical route and its
 * /{country}/ siblings so Google understands `/stores/[slug]` and
 * `/it/stores/[slug]` etc. are language variants of the same page, not
 * duplicate content. Only for the canonical route — the noindex
 * PPC-sitelink variants don't carry alternates, same as before this feature.
 */
export function buildStoreLanguageAlternates(slug: string): Record<string, string> {
  const languages: Record<string, string> = { en: `/stores/${slug}` };
  for (const { code, languageCode } of SUPPORTED_COUNTRIES) {
    languages[languageCode] = `/${code}/stores/${slug}`;
  }
  return languages;
}
