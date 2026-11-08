import { RemoteImage } from "@/components/RemoteImage";

/**
 * The small store-identity tile used in the hero's identity row and the
 * voucher's stub — a real store logo when one's set (Store.logo), falling
 * back to a Source Serif 4 monogram letter otherwise. `className` carries
 * sizing/rounding, `style` carries the background/text color for the
 * letter-fallback case (kept as a colored tile either way, for a consistent
 * look whether or not this particular store has a logo yet).
 */
export function StoreMark({
  logo,
  letter,
  name,
  className,
  style,
  priority = true,
}: {
  logo?: string | null;
  letter: string;
  name: string;
  className: string;
  style: React.CSSProperties;
  /** Defaults to true — every existing call site (hero identity row, voucher stub) is a single above-the-fold mark. Pass false when rendering several marks of the same logo in a list (e.g. one per row in AllDealsSection) so they don't all compete for eager/priority loading. */
  priority?: boolean;
}) {
  if (logo) {
    return (
      <span className={`relative shrink-0 overflow-hidden ${className}`} style={style}>
        {/* priority: this mark is (by default) in the above-the-fold hero/
            voucher band, never in a lazy-loaded list — RemoteImage defaults
            to loading="lazy", which on a store logo meant it often never
            rendered in time (or at all, depending on the browser's
            near-viewport heuristics), leaving the letter fallback showing
            even for stores with a real logo set.

            object-cover (not object-contain + padding): most uploaded store
            logos are a flat/opaque image with their own hard rectangular
            edges. object-contain plus padding left that rectangle floating
            inset within the rounded tile, so the tile's own rounding was
            invisible — the picture's straight edges were the only thing
            touching the corners. Filling the tile edge-to-edge means the
            *tile's* rounding is what actually clips the visible image, at
            the cost of cropping a sliver of the logo — an acceptable trade
            for a small identity badge, unlike a full product photo. */}
        <RemoteImage src={logo} alt={name} sizes="100px" className="h-full w-full rounded-[inherit]" imgClassName="object-cover" priority={priority} />
      </span>
    );
  }

  return (
    <span className={`font-store-serif flex shrink-0 items-center justify-center font-bold ${className}`} style={style} aria-hidden="true">
      {letter}
    </span>
  );
}
