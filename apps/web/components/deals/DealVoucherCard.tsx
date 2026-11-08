"use client";

import { RemoteImage } from "@/components/RemoteImage";
import { GiftIcon } from "@/components/CouponIcons";
import { OfferVoucher } from "@/components/store/OfferVoucher";
import { copyCouponCode, trackCouponClick } from "@/lib/couponInteraction";
import { deriveOffer } from "@/lib/offerContent";
import { getDictionary } from "@/lib/i18n";
import { buildCatalogTiles } from "@/lib/catalogItems";
import type { StoreCard, CouponCard, ProductCard as ProductCardData, BundleCard as BundleCardData } from "@/lib/data";

/**
 * One store's row on the /deals index: the exact same OfferVoucher used on
 * /stores/[slug]. The dark "hero" band StoreHero.tsx puts behind the voucher
 * there (background: var(--primary)) is applied once, at the page level (see
 * app/(site)/deals/page.tsx), not per card — an earlier version wrapped each
 * card in its own copy of that background, which just stacked a second
 * rounded dark box on top of the already-dark page. The voucher's default
 * "paste it at checkout" line is swapped for a small product/bundle strip via
 * OfferVoucher's `footerNote` slot — since this index shows only one coupon
 * per store (unlike the full AllDealsSection list on the store page), that's
 * where a visitor who isn't ready to leave the site gets sent instead.
 * `buildCatalogTiles` (shared with StoreHero's click-confirmation strip)
 * mixes in at most one bundle among the products, capped at 3 tiles total —
 * there's only room in the card for that many.
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
  // Same reason StoreDetailViewV2 calls getDictionary itself instead of
  // receiving dict from its (server) page.
  const dict = getDictionary(country);
  const offer = deriveOffer(store, store.offer, coupon, store.websiteUrl ?? "", country);
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

  return (
    <div className="flex h-full flex-col">
      <OfferVoucher
        storeName={store.name}
        storeLogo={store.logo}
        monogramLetter={offer.monogramLetter}
        offer={offer}
        storeSlug={store.slug}
        couponId={coupon?._id ?? null}
        onCtaClick={handleCtaClick}
        dict={dict.offerVoucher}
        footerNote={
          tiles.length > 0 ? (
            <div className="mt-3">
              <p className="text-center font-store-mono text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--muted-text)" }}>
                Shop with this deal
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {tiles.map((tile) => {
                  const hasDiscount = Boolean(tile.originalPrice && tile.originalPrice > tile.price);
                  return (
                    <a
                      key={`${tile.kind}-${tile.id}`}
                      href={tile.url}
                      target="_blank"
                      rel="nofollow sponsored noopener"
                      onClick={() => handleTileClick(tile.url)}
                      className="flex flex-col gap-1"
                    >
                      <div className="relative">
                        <RemoteImage src={tile.image} alt={tile.name} sizes="100px" className="aspect-square w-full rounded-[8px]" />
                        {tile.kind === "bundle" && (
                          <span
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                            aria-label="Bundle"
                          >
                            <GiftIcon />
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-[10px] font-semibold" style={{ color: "var(--text)" }}>
                        {tile.name}
                      </p>
                      <p className="font-store-mono text-[10px] font-bold" style={{ color: "var(--text)" }}>
                        ${tile.price.toFixed(2)}
                        {hasDiscount && (
                          <span className="ml-1 font-medium line-through" style={{ color: "var(--muted-text)" }}>
                            ${tile.originalPrice!.toFixed(2)}
                          </span>
                        )}
                      </p>
                    </a>
                  );
                })}
              </div>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
