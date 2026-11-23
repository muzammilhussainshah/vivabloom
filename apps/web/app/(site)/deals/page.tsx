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
  const { category } = await searchParams;
  const categorySlug = typeof category === "string" && category ? category : undefined;
  const [{ entries, categories }, settings] = await Promise.all([getDealsIndex(), getCachedSiteSettings()]);

  const themeVars = buildStoreThemeVars(settings.themeTokens);

  // deriveOffer is cheap (no I/O) but is the only source of truth for
  // "does this store actually have a verified offer to show" — a store with
  // neither an authored Store.offer nor any active Coupon renders nothing
  // here, same rule /stores/[slug] uses to fall back to EmptyOfferState.
  // Also requires at least one product or bundle: every card on this index
  // shows a "shop with this deal" strip alongside the voucher
  // (DealVoucherCard), so a store with no catalog yet would render a voucher
  // with nothing under it — skip it here rather than show an incomplete
  // card; it still appears normally on its own /stores/[slug] page.
  // Computed across ALL categories first, so the filter tabs can show counts.
  const eligible = entries
    .filter((entry) => entry.products.length > 0 || entry.bundles.length > 0)
    .map((entry) => ({ entry, offer: deriveOffer(entry.store, entry.store.offer, entry.coupon, entry.store.websiteUrl ?? "", null) }))
    .filter(({ offer }) => offer.hasOffer);

  const inCategory = (entry: (typeof entries)[number], slug: string) => entry.store.categories?.some((c) => c.slug === slug) ?? false;
  const visible = (categorySlug ? eligible.filter(({ entry }) => inCategory(entry, categorySlug)) : eligible).map(({ entry }) => entry);
  const countFor = (slug: string) => eligible.filter(({ entry }) => inCategory(entry, slug)).length;
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  // Hero stats.
  const bestDiscount = Math.max(0, ...eligible.map(({ offer }) => Number.parseInt(offer.discountLabel, 10)).filter((n) => Number.isFinite(n)));
  const lastChecked = eligible
    .map(({ offer }) => offer.verifiedDate?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);
  const lastCheckedLabel = lastChecked
    ? new Date(lastChecked).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;
  const categoriesWithOffers = categories.filter((c) => countFor(c.slug) > 0).length;

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

      <div className="relative mx-auto max-w-[1240px] px-4 pb-20 pt-12 sm:px-8 md:pb-24 md:pt-16">
        {/* Hero: the pitch on the left, three proof points on the right. */}
        <header className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div className="max-w-2xl">
            <p
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--on-primary-soft)" }}
            >
              <span className="sv-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
              {lastCheckedLabel ? `Every offer hand-checked · last check ${lastCheckedLabel}` : "Every offer hand-checked"}
            </p>
            <h1 className="font-store-serif mt-5 text-[40px] font-bold leading-[1.02] tracking-[-0.02em] sm:text-[56px]" style={{ color: "var(--page)" }}>
              Deals &amp; Discounts
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed md:text-[17px]" style={{ color: "var(--on-primary-soft)" }}>
              One verified coupon per store, paired with the products it actually applies to. No padded lists, no expired codes.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {[
              { label: eligible.length === 1 ? "Verified offer" : "Verified offers", value: String(eligible.length) },
              { label: categoriesWithOffers === 1 ? "Category" : "Categories", value: String(categoriesWithOffers) },
              { label: "Best discount", value: bestDiscount > 0 ? `${bestDiscount}%` : "—" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex min-w-[96px] flex-col gap-1 rounded-2xl px-4 py-3.5 sm:min-w-[120px]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <dt className="order-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--on-primary-faint)" }}>
                  {stat.label}
                </dt>
                <dd className="font-store-serif order-1 text-[26px] font-bold leading-none sm:text-[30px]" style={{ color: "var(--page)" }}>
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        {/* Filter: a segmented control with per-category counts. */}
        <nav aria-label="Filter deals by category" className="mt-10 flex flex-col gap-3 md:mt-12 md:flex-row md:items-center md:justify-between">
          <div
            className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <div
              className="inline-flex min-w-max items-center gap-1 rounded-2xl p-1.5 backdrop-blur"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <FilterTab href="/deals" active={!categorySlug} label="All" count={eligible.length} />
              {categories.map((category) => (
                <FilterTab
                  key={category._id}
                  href={`/deals?category=${category.slug}`}
                  active={categorySlug === category.slug}
                  label={category.name}
                  count={countFor(category.slug)}
                />
              ))}
            </div>
          </div>
          <p className="text-sm" style={{ color: "var(--on-primary-faint)" }}>
            Showing <span className="font-semibold" style={{ color: "var(--page)" }}>{visible.length}</span>{" "}
            {visible.length === 1 ? "offer" : "offers"}
            {activeCategory ? ` in ${activeCategory.name}` : ""}
          </p>
        </nav>
        <div className="mt-6 h-px w-full" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02))" }} aria-hidden="true" />

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
          <div className="mt-10 flex flex-col gap-14 md:mt-12 [&>*+*]:border-t [&>*+*]:border-white/10 [&>*+*]:pt-14">
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

      {/* Light closing band: ends the dark deals area before the (also dark)
          site footer, so the two don't run together into one block. */}
      <section className="relative" style={{ background: "var(--page)", color: "var(--text)" }}>
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-8 md:py-16">
          <div
            className="flex flex-col gap-6 rounded-3xl p-6 md:flex-row md:items-center md:justify-between md:p-10"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="max-w-xl">
              <p className="font-store-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent-ink)" }}>
                More ways to save
              </p>
              <h2 className="font-store-serif mt-2 text-[26px] font-bold leading-tight md:text-[32px]" style={{ color: "var(--text)" }}>
                Looking for another store?
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
                We only list a deal once we&apos;ve checked it. Browse every store we track, or read our buying guides before you shop.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/stores"
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--primary)", color: "var(--page)" }}
              >
                Browse all stores
              </Link>
              <Link
                href="/blog"
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)", color: "var(--text)", background: "var(--page)" }}
              >
                Read buying guides
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** One segment of the category filter: label + offer count; the active one is a raised light pill. Empty categories stay reachable but dimmed. */
function FilterTab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  const empty = count === 0 && !active;
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${
        active ? "shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]" : "hover:bg-white/[0.07]"
      } ${empty ? "opacity-45" : ""}`}
      style={active ? { background: "var(--page)", color: "var(--text)" } : { color: "var(--on-primary-soft)" }}
    >
      {label}
      <span
        className="min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums leading-none"
        style={active ? { background: "var(--accent)", color: "var(--on-accent)" } : { background: "rgba(255,255,255,0.1)", color: "var(--on-primary-soft)" }}
      >
        {count}
      </span>
    </Link>
  );
}
