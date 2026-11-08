/**
 * The fixed country list for the blog's "generate for this country" mode
 * (packages/db/src/models/BlogTopicSuggestion.ts, apps/admin blog AI panel).
 * Deliberately separate from SUPPORTED_COUNTRIES in ./countries.ts — that list
 * drives actual site i18n (per-locale Store offers, URL prefixes, currency
 * formatting) for a handful of markets; this one is just "which country's
 * shoppers should this blog content sound like it's written for," and the
 * blog itself stays English-only regardless of which country is picked (see
 * blogTopicsPrompt/articlePrompt in apps/admin/lib/ai/prompts.ts).
 */
export interface BlogCountry {
  /** Lowercase ISO 3166-1 alpha-2 code, stored on BlogPost.aiCountry / BlogTopicSuggestion.country. */
  code: string;
  /** Display name for the admin UI and AI prompts. */
  name: string;
}

export const BLOG_COUNTRIES: BlogCountry[] = [
  { code: "au", name: "Australia" },
  { code: "at", name: "Austria" },
  { code: "be", name: "Belgium" },
  { code: "ca", name: "Canada" },
  { code: "dk", name: "Denmark" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "ie", name: "Ireland" },
  { code: "it", name: "Italy" },
  { code: "lu", name: "Luxembourg" },
  { code: "nl", name: "Netherlands" },
  { code: "pl", name: "Poland" },
  { code: "es", name: "Spain" },
  { code: "ch", name: "Switzerland" },
  { code: "gb", name: "UK" },
  { code: "us", name: "US" },
];

export const BLOG_COUNTRY_CODES = BLOG_COUNTRIES.map((c) => c.code);

export function isBlogCountry(code: string): boolean {
  return BLOG_COUNTRY_CODES.includes(code);
}

export function getBlogCountry(code?: string | null): BlogCountry | undefined {
  return code ? BLOG_COUNTRIES.find((c) => c.code === code) : undefined;
}
