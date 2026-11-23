"use client";

import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import { GiftIcon } from "@/components/CouponIcons";
import { OfferVoucher } from "@/components/store/OfferVoucher";
import { StoreMark } from "@/components/store/StoreMark";
import { resolveOfferVoucherText } from "@/components/store/storeText";
import { copyCouponCode, trackCouponClick } from "@/lib/couponInteraction";
import { deriveOffer } from "@/lib/offerContent";
import { useSiteName } from "@/components/SiteNameProvider";
import { getDictionary } from "@/lib/i18n";
import { buildCatalogTiles } from "@/lib/catalogItems";
import type { StoreCard, CouponCard, ProductCard as ProductCardData, BundleCard as BundleCardData } from "@/lib/data";

/**
 * One store's section on the /deals index, laid out like the /stores/[slug]
 * hero (StoreHero.tsx): store identity, the offer headline, a link to the
 * store page and the product cards on the left; the exact same OfferVoucher
 * on its own on the right (stacked identity -> voucher -> products on
 * mobile). The dark backdrop is applied once at the page level (see
 * app/(site)/deals/page.tsx), not per section. `buildCatalogTiles` (shared
 * with StoreHero) mixes in at most one bundle among the products, capped at
 * 3 tiles.
 *
 * Deliberately skips HandoffModal ("welcome back" tab-focus modal) and the
 * StickyMobileBar — both are store-page-specific chrome that assumes a
 * single-store context; this card only needs the voucher's own CTA + click
 * tracking, which it wires up itself below.
 */
export function DealVoucherCard({
  store,
  coupon,
  products,
  bundles,
  country,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  store: StoreCard;
  coupon: CouponCard | null;
  products: ProductCardData[];
  bundles: BundleCardData[];
  country?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
}) {
  // Computed client-side (not passed down as a prop from the server page)
  // because Dictionary["offerVoucher"] carries functions (voucherLabel,
  // serialLine) — those can't cross the server/client boundary as props.
  // (The store page avoids this by resolving those templates on the server —
  // see components/store/storeText.ts.)
  const dict = getDictionary(country);
  const siteName = useSiteName();
  const offer = deriveOffer(store, store.offer, coupon, store.websiteUrl ?? "", country, siteName);
  if (!offer.hasOffer) return null;

  const tiles = buildCatalogTiles(products, bundles);

  function handleCtaClick() {
    const meta = { storeSlug: store.slug, couponId: coupon?._id ?? null, couponCode: offer.code, destinationUrl: offer.affiliateUrl };
    copyCouponCode(offer.code, meta);
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
  }

  function handleTileClick(url: string) {
    const meta = { storeSlug: store.slug, couponId: coupon?._id ?? null, couponCode: offer.code, destinationUrl: url };
    copyCouponCode(offer.code, meta);
    trackCouponClick(googleAdsConversionId, googleAdsConversionLabel, meta);
  }

  const categoryName = store.categories?.[0]?.name;

  // Same arrangement as the store page hero (StoreHero.tsx): identity +
  // headline + product cards on the left, the voucher on its own on the
  // right. Mobile source order: identity -> voucher -> products.
  return (
    <article className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8">
      {/* 1. Identity + headline */}
      {/* Centered on tablet (single column under a centered voucher), left-aligned once the voucher moves to its own column — same as StoreHero. */}
      <div className="flex flex-col gap-4 md:items-center md:text-center lg:col-start-1 lg:row-start-1 lg:items-start lg:text-left">
        <div className="flex items-center gap-3 md:text-left">
          <StoreMark
            logo={store.logo}
            letter={offer.monogramLetter}
            name={store.name}
            priority={false}
            className="h-11 w-11 rounded-[13px] text-lg shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)] ring-2 ring-white/15 md:h-12 md:w-12 md:rounded-[14px] md:text-xl"
            style={{ background: "var(--page)", color: "var(--primary)" }}
          />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-extrabold leading-tight md:text-[18px]" style={{ color: "var(--page)" }}>
              {store.name}
              {categoryName && (
                <span className="font-medium" style={{ color: "var(--on-primary-faint)" }}>
                  {" "}
                  · {categoryName}
                </span>
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--success)" }}>
              <span className="sv-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
              {dict.storeHero.liveOffer(offer.verifiedDateLong)}
            </p>
          </div>
        </div>

        <p className="font-store-serif text-balance text-[32px] font-bold leading-[1.04] tracking-[-0.03em] md:text-[48px]" style={{ color: "var(--page)" }}>
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(100deg, var(--accent) 10%, color-mix(in srgb, var(--accent) 45%, #ffd8b0) 90%)" }}
          >
            {offer.discountLabel}
          </span>{" "}
          {offer.discountSuffix}
        </p>

        <Link
          href={`/stores/${store.slug}`}
          className="group inline-flex w-fit items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--on-primary-soft)" }}
        >
          View all {store.name} deals
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>

      {/* 2. Voucher — compact, with its default "paste it at checkout" note. */}
      <div className="relative w-full md:mx-auto md:max-w-[440px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:max-w-none lg:self-start">
        <div
          className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 opacity-40 md:-inset-16"
          style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
          aria-hidden="true"
        />
        <OfferVoucher
          storeName={store.name}
          storeLogo={store.logo}
          monogramLetter={offer.monogramLetter}
          offer={offer}
          storeSlug={store.slug}
          couponId={coupon?._id ?? null}
          onCtaClick={handleCtaClick}
          dict={resolveOfferVoucherText(dict.offerVoucher, store.name, offer)}
        />
      </div>

      {/* 3. Products — the same cards as the store page hero. */}
      {tiles.length > 0 && (
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2">
          <p className="font-store-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--on-primary-dim)" }}>
            Shop with this deal
          </p>
          {/* scroll-px-4 matches the px-4 inset so the first card doesn't snap flush to the screen edge. */}
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:scroll-px-0 md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
            {tiles.map((tile) => {
              const hasDiscount = Boolean(tile.originalPrice && tile.originalPrice > tile.price);
              const percentOff = hasDiscount ? Math.ceil(((tile.originalPrice! - tile.price) / tile.originalPrice!) * 100) : null;
              return (
                <a
                  key={`${tile.kind}-${tile.id}`}
                  href={tile.url}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  onClick={() => handleTileClick(tile.url)}
                  className="group flex w-[172px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_16px_32px_-18px_rgba(0,0,0,0.8)] transition-transform duration-200 hover:-translate-y-1 md:w-auto"
                  style={{ background: "var(--page)" }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                    <RemoteImage
                      src={tile.image}
                      alt={tile.name}
                      sizes="(min-width: 768px) 220px, 172px"
                      className="h-full w-full"
                      imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {percentOff !== null && (
                      <span
                        className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold shadow-sm"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                      >
                        -{percentOff}%
                      </span>
                    )}
                    {tile.kind === "bundle" && (
                      <span
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ background: "var(--text)", color: "var(--page)" }}
                        aria-label={dict.storeHero.bundleAriaLabel}
                      >
                        <GiftIcon />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2.5">
                    <p className="line-clamp-1 text-[13px] font-bold leading-snug" style={{ color: "var(--text)" }}>
                      {tile.name}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
                        <span className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
                          {formatPrice(tile.price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-[11.5px] line-through" style={{ color: "var(--muted-text)" }}>
                            {formatPrice(tile.originalPrice!)}
                          </span>
                        )}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[11.5px] font-bold" style={{ color: "var(--accent-ink)" }}>
                        {dict.storeHero.shop} →
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

/** Same price format as the store hero: cents only when there are any ("$35" / "$35.98"). */
function formatPrice(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
