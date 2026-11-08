export interface SupportedCountry {
  /** Lowercase ISO 3166-1 alpha-2 code, used as the URL segment (e.g. "it"). */
  code: string;
  /** Display name for admin UI (e.g. "Italy"). */
  countryName: string;
  /** Display name of the primary language for this country (e.g. "Italian"). */
  language: string;
  /** ISO 639-1 code for the primary language, used for html lang / dictionary lookup (e.g. "it"). */
  languageCode: string;
  /** Currency symbol for this country's market (e.g. "€"). Only used for *auto-derived* discount labels (see formatFixedAmount below) — an admin-typed discountLabel is never touched, it's taken exactly as written. */
  currencySymbol: string;
  /** "prefix" ($80, US-style) or "suffix" (80 €, standard European style). */
  currencyPosition: "prefix" | "suffix";
}

// Kept in sync with the languages supported by admin's ad-keywords campaign
// builder (packages/db/src/models/KeywordLocale.ts + English, which is
// built-in there rather than a KeywordLocale doc). Each entry below uses that
// language's primary/home country; several of those languages also target
// secondary countries in admin (German: AT, CH; French: BE, CH, LU; Italian:
// CH; Dutch: BE) that aren't added here yet since a shared country like
// Switzerland or Belgium needs an explicit language decision per country.
export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: "it", countryName: "Italy", language: "Italian", languageCode: "it", currencySymbol: "€", currencyPosition: "suffix" },
  { code: "fr", countryName: "France", language: "French", languageCode: "fr", currencySymbol: "€", currencyPosition: "suffix" },
  { code: "de", countryName: "Germany", language: "German", languageCode: "de", currencySymbol: "€", currencyPosition: "suffix" },
  { code: "es", countryName: "Spain", language: "Spanish", languageCode: "es", currencySymbol: "€", currencyPosition: "suffix" },
  { code: "nl", countryName: "Netherlands", language: "Dutch", languageCode: "nl", currencySymbol: "€", currencyPosition: "suffix" },
  { code: "pl", countryName: "Poland", language: "Polish", languageCode: "pl", currencySymbol: "zł", currencyPosition: "suffix" },
  { code: "dk", countryName: "Denmark", language: "Danish", languageCode: "da", currencySymbol: "kr", currencyPosition: "suffix" },
];

export const SUPPORTED_COUNTRY_CODES = SUPPORTED_COUNTRIES.map((c) => c.code);

export function isSupportedCountry(code: string): boolean {
  return SUPPORTED_COUNTRY_CODES.includes(code);
}

export function getSupportedCountry(code: string): SupportedCountry | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code);
}

/**
 * Extracts the locale-prefix country from a site path (e.g. "/it/stores/x"
 * -> "it"; "/stores/x" -> null) — the market a visit/click belongs to (which
 * language/URL they were on), not their IP-geolocated location. Used by the
 * tracking pipeline (apps/web/app/api/track, /api/engagement) to tag
 * pageviews/clicks with `localeCountry`, distinct from TrackingEvent's
 * existing `country` field (IP-derived physical location — a visitor can be
 * in either country regardless of which language page they're on).
 */
export function localeCountryFromPath(path: string): string | null {
  const segment = path.split("/")[1];
  return segment && isSupportedCountry(segment) ? segment : null;
}

/**
 * Formats a raw fixed-discount number ($ amount) using the given country's
 * currency — e.g. `formatFixedAmount(80, "it")` -> "80 €". Falls back to the
 * US "$80" style when country is unset/unsupported. Only for *auto-derived*
 * labels built from Coupon.discountValue (see deriveDiscountLabel in
 * apps/web/lib/offerContent.ts and cardValueParts in AllDealsSection.tsx) —
 * an admin-typed discountLabel override is a free-text field and is never
 * passed through this.
 */
export function formatFixedAmount(amount: number, country?: string | null): string {
  const supported = country ? getSupportedCountry(country) : undefined;
  if (!supported) return `$${amount}`;
  return supported.currencyPosition === "prefix" ? `${supported.currencySymbol}${amount}` : `${amount} ${supported.currencySymbol}`;
}
