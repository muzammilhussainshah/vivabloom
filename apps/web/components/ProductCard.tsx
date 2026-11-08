import { RemoteImage } from "./RemoteImage";
import type { ProductCard as ProductCardData } from "@/lib/data";

/**
 * Short tappable card — the whole card is a link that opens the merchant's
 * own product URL directly in a new tab. No code-copy behavior here since
 * products have a single outbound URL, not a coupon code.
 */
export function ProductCard({
  product,
  priority = false,
  onClick,
}: {
  product: ProductCardData;
  priority?: boolean;
  /** Optional side effect to run alongside the anchor's own navigation — e.g. the store page's copy-code + confirmation-modal behavior. Omitted on pages (category, blog) that mix products from several stores. */
  onClick?: () => void;
}) {
  const hasDiscount = !!(product.originalPrice && product.originalPrice > product.price);
  const percentOff = hasDiscount
    ? Math.ceil(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : null;

  return (
    <a
      href={product.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative">
        <RemoteImage
          src={product.image}
          alt={product.name}
          sizes="(min-width: 640px) 33vw, 50vw"
          className="aspect-square w-full bg-surface-muted"
          priority={priority}
        />
        {percentOff !== null && (
          <span className="absolute left-2 top-2 rounded-base bg-brand-secondary px-2 py-0.5 text-xs font-semibold text-white">
            -{percentOff}%
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium text-text">{product.name}</p>
      </div>
    </a>
  );
}
