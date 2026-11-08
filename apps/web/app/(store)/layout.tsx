import type { Viewport } from "next";
import "@/components/store/store.css";
import { getCachedSiteSettings } from "@/lib/data";
import { buildStoreThemeVars } from "@/lib/storeTheme";
import { storeSourceSerif, storeFigtree, storePlexMono } from "@/lib/storeFonts";

/**
 * Overrides the root layout's static `viewport` export for these 7 routes
 * only — `themeColor` tints the browser's own chrome (Android's status bar,
 * and on recent Chrome versions the edge-to-edge bottom system nav bar too)
 * to match the *store* theme instead of the main site's, since this route
 * group has its own independent theme (see buildStoreThemeVars above).
 * Picked footerBg specifically: it's what both StoreHeader (top) and
 * StickyMobileBar (bottom, via --bar) already render in, so the OS chrome
 * blends with the actual persistent UI at both edges of the screen rather
 * than sitting as a mismatched plain-white/black strip above/below it.
 * Re-declares width/initialScale/viewportFit alongside it rather than
 * relying on it merging with the root's — safer than assuming undocumented
 * per-field merge behavior across a route-group override.
 */
export async function generateViewport(): Promise<Viewport> {
  const settings = await getCachedSiteSettings();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: settings.themeTokens.footerBg,
  };
}

/**
 * Chrome for the 7 store-detail routes (/stores/[slug] + its 6 PPC-sitelink
 * variants) — its own fonts and theme tokens, independent of the rest of the
 * site (see app/(site)/layout.tsx). StoreHeader is deliberately NOT rendered
 * here even though it's visually "chrome": it needs the current store's
 * offer summary, and this layout has no reliable way to get the slug for it
 * — Next.js doesn't populate `params` in a layout shared by sibling routes
 * with different static prefixes before their common [slug] segment
 * (verified empirically), and reading the pathname via headers() would force
 * this entire route group into dynamic rendering, defeating the 24h ISR this
 * app relies on to keep PPC landing pages warm (see stores/[slug]/page.tsx's
 * revalidate comment). So StoreHeader is rendered by StoreDetailViewV2
 * instead, using data its page.tsx already fetched correctly.
 *
 * Theme variables are computed server-side from the site's single shared
 * theme (settings.themeTokens — the same "Theme Colors" admin fields the
 * rest of the site uses; see lib/storeTheme.ts) and applied via inline style
 * on this wrapper div (not <html>, since the store vars are named
 * differently from the site-wide --brand-primary/--surface/etc. tokens and
 * must not leak onto (site) pages) — never from client JS, so there's no
 * flash between a default and the configured theme.
 *
 * `#store-modal-root` exists so HandoffModal (portal-rendered) mounts
 * *inside* this theme-scoped div instead of document.body — CSS custom
 * properties set via inline style only cascade to DOM descendants of the
 * element they're set on, and a portal to document.body would escape that
 * scope entirely, leaving every var(--page)/var(--text)/etc. in the modal
 * unresolved (this was a real bug the first time this pattern was tried:
 * the modal rendered with no background).
 *
 * StoreFooter is rendered by StoreDetailViewV2 (not here) for the same
 * reason StoreHeader is — it needs per-locale copy from the current route's
 * country param, which this layout doesn't reliably receive (see the
 * StoreHeader note above).
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getCachedSiteSettings();
  const themeVars = buildStoreThemeVars(settings.themeTokens);

  return (
    <div
      className={`store-scope flex min-h-full flex-col ${storeSourceSerif.variable} ${storeFigtree.variable} ${storePlexMono.variable}`}
      style={{ ...(themeVars as React.CSSProperties), fontFamily: "var(--font-figtree), sans-serif", background: "var(--page)", color: "var(--text)" }}
    >
      {/* min-w-0: this <main> is a flex item of the flex-col wrapper above.
          Flex items default to min-width:auto, which refuses to shrink
          below their content's natural width — with a wide horizontally-
          scrollable rail nested deep inside (e.g. RelatedArticles), that
          silently grew *this* element to fit all the rail's content instead
          of constraining it to the viewport, which left the rail's own
          overflow-x:auto with nothing to actually scroll (its box had
          already grown to fit everything). Classic flexbox-overflow bug;
          min-w-0 is the standard fix. */}
      <main className="min-w-0 flex-1">{children}</main>
      <div id="store-modal-root" />
    </div>
  );
}
