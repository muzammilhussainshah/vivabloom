import Image from "next/image";

/**
 * next/image wrapper for arbitrary admin-supplied remote images (unknown
 * intrinsic dimensions, so it uses `fill`). The wrapper element establishes
 * the box (aspect ratio / fixed size) via `className`; the image covers it.
 *
 * Automatically gives every image a responsive srcset + AVIF/WebP + lazy
 * loading. Pass `priority` for above-the-fold images (e.g. the hero) so they
 * preload instead of lazy-loading, and always pass an accurate `sizes` so the
 * browser downloads the smallest variant that fits.
 */
export function RemoteImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
  imgClassName = "object-cover",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** Sets the box size — must include position/aspect (e.g. "relative aspect-video w-full"). */
  className?: string;
  /** object-fit and related classes on the <img> itself. */
  imgClassName?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={imgClassName} />
    </div>
  );
}
