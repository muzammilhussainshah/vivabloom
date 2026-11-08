import { RemoteImage } from "./RemoteImage";
import { GiftIcon } from "./CouponIcons";
import type { BundleCard as BundleCardData } from "@/lib/data";

/**
 * Same card shape/grid slot as ProductCard so it drops into the same grid
 * seamlessly, but visually flagged as a bundle (ribbon + accent border) since
 * it's mixed in among plain products and needs to stand out as the "spend a
 * bit more, save a lot more" option.
 */
export function BundleCard({
  bundle,
  priority = false,
  onClick,
}: {
  bundle: BundleCardData;
  priority?: boolean;
  /** Optional side effect to run alongside the anchor's own navigation — e.g. the store page's copy-code + confirmation-modal behavior. */
  onClick?: () => void;
}) {
  const hasSavings = !!(bundle.originalPrice && bundle.originalPrice > bundle.price);
  const percentOff = hasSavings
    ? Math.ceil(((bundle.originalPrice! - bundle.price) / bundle.originalPrice!) * 100)
    : null;
  const hasExtra = !!(bundle.extraDiscountPercent && bundle.extraDiscountPercent > 0);

  return (
    <a
      href={bundle.bundleUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-brand-accent/40 bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative">
        <RemoteImage
          src={bundle.image}
          alt={bundle.name}
          sizes="(min-width: 640px) 33vw, 50vw"
          className="aspect-square w-full bg-surface-muted"
          priority={priority}
        />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-base bg-brand-accent px-2 py-0.5 text-xs font-semibold text-white">
          <GiftIcon />
          Bundle
        </span>
        {percentOff !== null && (
          <span className="absolute right-2 top-2 rounded-base bg-brand-secondary px-2 py-0.5 text-xs font-semibold text-white">
            -{percentOff}%
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium text-text">{bundle.name}</p>
        {hasExtra && (
          <p className="text-sm font-bold text-brand-secondary">+{bundle.extraDiscountPercent}% extra off</p>
        )}
      </div>
    </a>
  );
}
