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
      className={`store-scope relative overflow-hidden ${storeSourceSerif.variable} ${storeFigtree.variable} ${storePlexMono.variable}`}
      style={
        {
          ...themeVars,
          fontFamily: "var(--font-figtree), sans-serif",
          // Whole page on the same dark green the store pages use behind
          // their voucher (StoreHero.tsx's `var(--primary)` band) — not just
          // a wrapper around each card — so every voucher (light "ticket"
          // card by design) sits consistently on that backdrop the way it
          // does on /stores/[slug], instead of the page reverting to the
          // plain cream `var(--page)` background around each card.
          background: "var(--primary)",
          color: "var(--page)",
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-[300px] w-[300px] rounded-full md:h-[520px] md:w-[520px]"
        style={{ background: "var(--accent-stripe)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-store-mono text-xs uppercase tracking-[0.22em]" style={{ color: "var(--success)" }}>
            {visible.length} verified {visible.length === 1 ? "offer" : "offers"}
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
          <p className="mt-16 text-center" style={{ color: "var(--on-primary-soft)" }}>
            No verified deals in this category yet — check back soon.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 items-stretch gap-10 sm:grid-cols-2 2xl:grid-cols-3">
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
