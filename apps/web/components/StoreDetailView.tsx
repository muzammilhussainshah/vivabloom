import { JsonLd } from "@/components/JsonLd";
import { CouponTicket } from "@/components/CouponTicket";
import { ProductHighlightStrip } from "@/components/ProductHighlightStrip";
import { StoreProductGrid, type GridItem } from "@/components/StoreProductGrid";
import { StoreFaq } from "@/components/StoreFaq";
import { BlogViewBeacon } from "@/components/BlogViewBeacon";
import { breadcrumbJsonLd, faqPageJsonLd, storeOffersJsonLd } from "@/lib/seo";
import type { StoreCard, CouponCard, ProductCard as ProductCardData, BundleCard as BundleCardData } from "@/lib/data";

/** Drops one random bundle into a random slot among the products, so it reads as part of the mix rather than bolted on at the end. */
function buildProductGrid(products: ProductCardData[], bundles: BundleCardData[]): GridItem[] {
  const items: GridItem[] = products.map((p) => ({ kind: "product", data: p }));
  if (bundles.length === 0) return items;
  const bundle = bundles[Math.floor(Math.random() * bundles.length)];
  const insertAt = Math.floor(Math.random() * (items.length + 1));
  items.splice(insertAt, 0, { kind: "bundle", data: bundle });
  return items;
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11.5 3.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-.3.7l-8.5 8.5a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4l8.5-8.5a1 1 0 0 1 .7-.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="15.5" cy="7.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12.5 2 4 13.5h6L10.5 22 20 9.5h-6L12.5 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-text">{value}</p>
        <p className="text-xs font-medium text-text-muted">{label}</p>
      </div>
    </div>
  );
}

/**
 * The full store-page UI: coupons, products, stats, FAQ. Shared by the
 * canonical /stores/[slug] page and its PPC-sitelink variants (e.g.
 * /never-pay-full/[slug]) — those pages exist purely to give Google Ads
 * sitelinks distinct-looking landing pages, and differ only in the `heading`
 * text passed in. See lib/storeVariants.ts for the variant copy and
 * lib/storeVariantPage.tsx for how each variant route is wired up.
 */
export function StoreDetailView({
  store,
  coupons,
  products,
  bundles = [],
  heading,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  store: StoreCard;
  coupons: CouponCard[];
  products: ProductCardData[];
  bundles?: BundleCardData[];
  heading: string;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  const productGrid = buildProductGrid(products, bundles);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 pb-10 pt-4">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: store.name, path: `/stores/${store.slug}` },
        ])}
      />
      {coupons.length > 0 && <JsonLd data={storeOffersJsonLd(store, coupons)} />}
      {store.faqs && store.faqs.length > 0 && <JsonLd data={faqPageJsonLd(store.faqs)} />}
      {/* Coupon/store pages count as a "view" toward blog posts in the same category(ies) — mocked engagement, not real analytics. */}
      {store.categories?.map((category) => (
        <BlogViewBeacon key={category._id} type="category" id={category._id} />
      ))}

      <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl font-extrabold text-brand-secondary sm:text-5xl">{heading}</h1>
        </section>

        {(products.length > 0 || bundles.length > 0) && (
          <ProductHighlightStrip
            products={products}
            coupons={coupons}
            bundles={bundles}
            storeName={store.name}
            storeLogo={store.logo}
            storeSlug={store.slug}
            googleAdsConversionId={googleAdsConversionId}
            googleAdsConversionLabel={googleAdsConversionLabel}
          />
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Active Coupons</h2>
          {coupons.length === 0 ? (
            <p className="text-sm text-text-muted">No coupons for {store.name} right now — check back soon.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {coupons.map((coupon) => (
                <CouponTicket
                  key={coupon._id}
                  coupon={coupon}
                  storeName={store.name}
                  storeLogo={store.logo}
                  storeSlug={store.slug}
                  bundles={bundles}
                  googleAdsConversionId={googleAdsConversionId}
                  googleAdsConversionLabel={googleAdsConversionLabel}
                />
              ))}
            </div>
          )}
        </section>

        {productGrid.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Products</h2>
            <StoreProductGrid
              items={productGrid}
              coupons={coupons}
              bundles={bundles}
              storeName={store.name}
              storeLogo={store.logo}
              storeSlug={store.slug}
              googleAdsConversionId={googleAdsConversionId}
              googleAdsConversionLabel={googleAdsConversionLabel}
            />
          </section>
        )}
      </div>

      {store.stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<TagIcon />} label="Total Coupons" value={store.stats.totalCoupons} accent="bg-brand-primary/10 text-brand-primary" />
          <StatCard icon={<BoltIcon />} label="Active Deals" value={store.stats.activeDeals} accent="bg-brand-secondary/10 text-brand-secondary" />
          <StatCard icon={<EyeIcon />} label="Views" value={store.stats.views} accent="bg-brand-accent/10 text-brand-accent" />
          <StatCard icon={<StarIcon />} label="Rating" value={`${store.stats.rating.toFixed(1)} / 5`} accent="bg-brand-primary/10 text-brand-primary" />
        </section>
      )}

      {store.faqs && store.faqs.length > 0 && <StoreFaq faqs={store.faqs} />}
    </div>
  );
}
