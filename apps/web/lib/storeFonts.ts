import { Fraunces, Figtree, IBM_Plex_Mono } from "next/font/google";

/**
 * Shared next/font instances for the store-page redesign's typography (see
 * lib/storeTheme.ts for the color half of that system). Pulled into their own
 * module so any page that needs to render store-scoped UI outside the
 * (store) route group — e.g. the /deals index, which mixes many stores'
 * OfferVoucher cards into a page that keeps the site's own Header/Footer —
 * can reuse the exact same font objects instead of re-declaring them (two
 * separate next/font calls for the same face would otherwise register as two
 * distinct font instances).
 */
export const storeSourceSerif = Fraunces({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const storeFigtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const storePlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
