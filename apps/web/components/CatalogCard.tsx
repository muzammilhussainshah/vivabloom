import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { GiftIcon } from "./CouponIcons";
import type { CatalogItem } from "@/lib/data";

/**
 * The one tile shape for the whole /products feature — a product and a
 * bundle render identically (image, name, price) since a bundle is treated
 * as "just another product" here, flagged only by a small badge. Always
 * links internally to /products/[slug]; both kinds have a detail page there
 * now, so unlike ProductCard/BundleCard used elsewhere on the site, this
 * never goes straight to an outbound merchant URL.
 */
export function CatalogCard({ item, priority = false }: { item: CatalogItem; priority?: boolean }) {
  const { data, kind } = item;
  const hasDiscount = !!(data.originalPrice && data.originalPrice > data.price);
  const percentOff = hasDiscount
    ? Math.ceil(((data.originalPrice! - data.price) / data.originalPrice!) * 100)
    : null;

  return (
    <Link
      href={`/products/${data.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-muted transition-colors"
    >
      <div className="relative">
        <RemoteImage
          src={data.image}
          alt={data.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="aspect-square w-full bg-surface-muted"
          priority={priority}
        />
        {kind === "bundle" && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-secondary px-2.5 py-0.5 text-xs font-semibold text-white">
            <GiftIcon />
            Bundle
          </span>
        )}
        {percentOff !== null && (
          <span className="absolute right-2 top-2 rounded-full bg-brand-secondary px-2.5 py-0.5 text-xs font-semibold text-white">
            -{percentOff}%
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium text-text group-hover:text-brand-primary">{data.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">${data.price.toFixed(2)}</span>
          {hasDiscount && (
            <span className="text-xs text-text-muted line-through">${data.originalPrice!.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
