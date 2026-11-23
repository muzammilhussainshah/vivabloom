import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import "@/components/store/store.css";
import { getDealsIndex, getCachedSiteSettings } from "@/lib/data";
import { deriveOffer } from "@/lib/offerContent";
import { buildStoreThemeVars } from "@/lib/storeTheme";
import { storeSourceSerif, storeFigtree, storePlexMono } from "@/lib/storeFonts";
import { DealVoucherCard } from "@/components/deals/DealVoucherCard";

export const metadata: Metadata = { title: "Deals and Discounts", alternates: { canonical: "/deals" } };

// Aggregates every store's offer onto one page — admin edits to any store's
// coupons/offer should show up within the hour rather than needing an
// on-demand revalidate wired up per store, unlike the single-store pages
// this reuses (see stores/[slug]/page.tsx's 24h ISR comment).
export const revalidate = 3600;

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category: categorySlug } = await searchParams;
  const [{ entries, categories }, settings] = await Promise.all([getDealsIndex(), getCachedSiteSettings()]);

  const themeVars = buildStoreThemeVars(settings.themeTokens);

  const filtered = categorySlug ? entries.filter((entry) => entry.store.categories?.some((c) => c.slug === categorySlug)) : entries;

  // deriveOffer is cheap (no I/O) but is the only source of truth for
  // "does this store actually have a verified offer to show" — a store with
  // neither an authored Store.offer nor any active Coupon renders nothing
  // here, same rule /stores/[slug] uses to fall back to EmptyOfferState.
  // Also requires at least one product or bundle: every card on this index
  // shows a "shop with this deal" strip alongside the voucher
  // (DealVoucherCard), so a store with no catalog yet would render a voucher
  // with nothing under it — skip it here rather than show an incomplete
  // card; it still appears normally on its own /stores/[slug] page.
  const visible = filtered.filter(
    (entry) =>
      (entry.products.length > 0 || entry.bundles.length > 0) &&
      deriveOffer(entry.store, entry.store.offer, entry.coupon, entry.store.websiteUrl ?? "", null).hasOffer
  );

  return (
    <div
      // -mb-12 cancels the site <Footer>'s mt-12 so this full-bleed green runs
      // straight into the footer instead of leaving a strip of page background.
      className={`store-scope relative isolate -mb-12 overflow-hidden ${storeSourceSerif.variable} ${storeFigtree.variable} ${storePlexMono.variable}`}
      style={
        {
          ...themeVars,
          fontFamily: "var(--font-figtree), sans-serif",
          // Whole page on the exact backdrop of the store page hero
          // (StoreHero.tsx): near-black brand field lit by an accent glow top
          // right and a primary glow bottom left, plus the dot grain below —
          // so each store section here looks like its /stores/[slug] hero.
          background:
            "radial-gradient(900px 560px at 88% -8%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 62%), radial-gradient(1000px 640px at -12% 112%, color-mix(in srgb, var(--primary) 75%, transparent), transparent 62%), var(--footer)",
          color: "var(--page)",
        } as CSSProperties
      }
    >
      {/* Fine dot grain — same texture as the store page hero. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1240px] px-4 pb-20 pt-14 sm:px-8 md:pb-24 md:pt-16">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--success)" }}>
            {visible.length > 0 ? `${visible.length} verified ${visible.length === 1 ? "offer" : "offers"}` : "Verified offers"}
          </p>
          <h1 className="font-store-serif mt-4 text-4xl font-bold sm:text-5xl" style={{ color: "var(--page)" }}>
            Deals &amp; Discounts
          </h1>
          <p className="mt-3 text-base" style={{ color: "var(--on-primary-soft)" }}>
            One hand-checked coupon per store, paired with the products it actually applies to — not a pile of stale codes.
          </p>
        </div>

        <div className="mt-9 flex flex-wrap justify-center gap-2 border-b pb-7" style={{ borderColor: "rgba(246,243,236,0.14)" }}>
          <CategoryChip href="/deals" active={!categorySlug} label="All Stores" />
          {categories.map((category) => (
            <CategoryChip key={category._id} href={`/deals?category=${category.slug}`} active={categorySlug === category.slug} label={category.name} />
          ))}
        </div>

        {visible.length === 0 ? (
          <div
            className="mx-auto mt-12 flex max-w-md flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0l-8.3-8.3Z" />
                <circle cx="8" cy="8" r="1.4" />
              </svg>
            </span>
            <p className="font-store-serif text-xl font-semibold" style={{ color: "var(--page)" }}>
              No verified deals here yet
            </p>
            <p className="text-sm" style={{ color: "var(--on-primary-soft)" }}>
              We only list offers we&apos;ve tested ourselves. Check back soon, or browse the stores we track.
            </p>
            <Link
              href="/stores"
              className="mt-2 rounded-full px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              Browse all stores
            </Link>
          </div>
        ) : (
          // One full-width section per store, laid out like the store page
          // hero (see DealVoucherCard), stacked with a hairline between them.
          <div className="mt-12 flex flex-col gap-14 md:mt-14 [&>*+*]:border-t [&>*+*]:border-white/10 [&>*+*]:pt-14">
            {visible.map((entry) => (
              // No googleAdsConversionId/Label here, deliberately: the "Coupon
              // Outbound Click" Ads conversion is scoped to /stores/[slug] and
              // its PPC variants only — this index page reuses DealVoucherCard's
              // click handling for its own affiliate_click engagement tracking,
              // but trackCouponClick's null/null guard skips the Ads gtag ping.
              <DealVoucherCard key={entry.store._id} store={entry.store} coupon={entry.coupon} products={entry.products} bundles={entry.bundles} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
      style={
        active
          ? { background: "var(--accent)", color: "var(--on-accent)" }
          : { background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }
      }
    >
      {label}
    </Link>
  );
}
