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
      // White tile behind a real logo, whatever background the caller passes
      // (that color is for the letter fallback): logos are usually exported on
      // white, so on a coloured tile they showed as a white box floating in it.
      <span className={`relative shrink-0 overflow-hidden ${className}`} style={{ ...style, background: "#fff" }}>
        {/* priority: this mark is (by default) in the above-the-fold hero/
            voucher band, never in a lazy-loaded list — RemoteImage defaults
            to loading="lazy", which on a store logo meant it often never
            rendered in time (or at all, depending on the browser's
            near-viewport heuristics), leaving the letter fallback showing
            even for stores with a real logo set.

            object-contain + padding, so the WHOLE logo is always visible.
            This used to be object-cover (edge-to-edge, tile rounding clips
            the image), but logos are often wide wordmarks on a transparent
            background (e.g. a 144x107 "I·M·8" PNG) and cover cropped the
            sides off them — a brand mark with letters missing is worse than
            a rectangle sitting inset in the tile. The tile's own background
            (the cream page color) shows around the logo. */}
        <RemoteImage src={logo} alt={name} sizes="100px" className="h-full w-full rounded-[inherit]" imgClassName="object-contain p-[14%]" priority={priority} />
      </span>
    );
  }

  return (
    <span className={`font-store-serif flex shrink-0 items-center justify-center font-bold ${className}`} style={style} aria-hidden="true">
      {letter}
    </span>
  );
}
