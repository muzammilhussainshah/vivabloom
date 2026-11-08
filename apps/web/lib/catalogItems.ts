import type { ProductCard as ProductCardData, BundleCard as BundleCardData } from "@/lib/data";

export interface CatalogTile {
  kind: "product" | "bundle";
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number | null;
  url: string;
}

/**
 * Cheap deterministic hash → a stable index in [0, max). Used in place of
 * Math.random() below: this runs inside a "use client" component, which
 * renders once on the server (initial HTML) and again in the browser during
 * hydration — a real Math.random() call picks a different value each time,
 * so the two renders disagreed on which bundle (and where) to show, which
 * React flags as a hydration mismatch. Hashing a stable id instead makes both
 * renders agree while still varying "randomly" from one store/bundle to the
 * next.
 */
function stableIndex(seed: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % max;
}

/** Country override -> English, field by field — same fallback rule used everywhere else in this app (see deriveOffer in offerContent.ts). */
function localizedProductUrl(product: ProductCardData, country?: string | null): string {
  const entry = country ? product.i18n?.find((e) => e.country === country) : null;
  return entry?.productUrl || product.productUrl;
}

function localizedBundleUrl(bundle: BundleCardData, country?: string | null): string {
  const entry = country ? bundle.i18n?.find((e) => e.country === country) : null;
  return entry?.bundleUrl || bundle.bundleUrl;
}

/**
 * Up to `limit` tiles mixing a store's products and bundles: products plus,
 * when the store has any, exactly one bundle mixed in (the higher-value
 * upsell) — at a (deterministically) varied position within the visible set,
 * not just appended at the end, so it reads as part of the mix rather than
 * bolted on. Shared by StoreHero's click-confirmation strip and the /deals
 * index's "shop with this deal" strip (DealVoucherCard) — both cap at 3 for
 * the same reason: there's only room for so many tiles before the card runs
 * out of space. `country` resolves each tile's referral URL to that
 * country's override when one exists (see localizedProductUrl/
 * localizedBundleUrl above); omit it (DealVoucherCard, which has no locale
 * context) to always use the English URL.
 */
export function buildCatalogTiles(products: ProductCardData[], bundles: BundleCardData[], limit = 3, country?: string | null): CatalogTile[] {
  const productItems: CatalogTile[] = products.map((p) => ({
    kind: "product",
    id: p._id,
    name: p.name,
    image: p.image,
    price: p.price,
    originalPrice: p.originalPrice,
    url: localizedProductUrl(p, country),
  }));

  if (bundles.length === 0) return productItems.slice(0, limit);

  const bundle = bundles[stableIndex(bundles.map((b) => b._id).join(","), bundles.length)];
  const bundleItem: CatalogTile = {
    kind: "bundle",
    id: bundle._id,
    name: bundle.name,
    image: bundle.image,
    price: bundle.price,
    originalPrice: bundle.originalPrice,
    url: localizedBundleUrl(bundle, country),
  };

  const slots = productItems.slice(0, limit - 1); // leave room for the bundle within the visible set
  const insertAt = stableIndex(bundle._id, slots.length + 1);
  slots.splice(insertAt, 0, bundleItem);
  return slots;
}
