import type { Dictionary } from "./dictionary";
import { en } from "./en";
import { it } from "./it";
import { fr } from "./fr";

export type { Dictionary } from "./dictionary";

// Keyed by the country codes in SUPPORTED_COUNTRIES (@monocoupon/validation).
// A country with no entry here (e.g. Germany, Spain — added to the country
// list but not yet translated) falls back to English via getDictionary
// below, same as an untranslated field within a translated country falls
// back to English in offerContent.ts's deriveOffer.
const DICTIONARIES: Partial<Record<string, Dictionary>> = {
  it,
  fr,
};

/** Not yet wired into any route/component — see Step 5. */
export function getDictionary(country?: string | null): Dictionary {
  if (!country) return en;
  return DICTIONARIES[country] ?? en;
}
