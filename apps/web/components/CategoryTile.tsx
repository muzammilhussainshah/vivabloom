import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { tintForSlug } from "@/lib/categoryTint";

/** Line icons (24px grid, stroke = currentColor) matched to a category by keywords in its name/slug. */
const ICONS: { match: RegExp; icon: ReactNode }[] = [
  // Checked first: "lifestyle" contains "style", which would otherwise match fashion.
  {
    match: /lifestyle|wellness|living|life|mind/,
    icon: (
      <>
        <path d="M19.5 4.5C10.5 4.5 5 9 5 16v3.5h3.5c7 0 11-5.5 11-15Z" />
        <path d="M5 19.5l8.5-8.5" />
      </>
    ),
  },
  {
    match: /electron|tech|gadget|phone|computer|laptop|digital/,
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="11" rx="2" />
        <path d="M2 19.5h20" />
      </>
    ),
  },
  {
    match: /supplement|vitamin|nutrition|pill|protein/,
    icon: (
      <>
        <path d="M4.9 12.7l7.8-7.8a4.5 4.5 0 0 1 6.4 6.4l-7.8 7.8a4.5 4.5 0 0 1-6.4-6.4Z" />
        <path d="M8.8 8.8l6.4 6.4" />
      </>
    ),
  },
  {
    match: /fashion|cloth|apparel|wear|shoe|style/,
    icon: (
      <>
        <path d="M12 8.5V7.6a2.1 2.1 0 1 0-2.1-2.1" />
        <path d="M12 8.5 3.4 15.6A1.4 1.4 0 0 0 4.3 18h15.4a1.4 1.4 0 0 0 .9-2.4L12 8.5Z" />
      </>
    ),
  },
  {
    match: /travel|trip|hotel|flight|holiday|vacation/,
    icon: (
      <>
        <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
        <path d="M8.5 7.5V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 13h18" />
      </>
    ),
  },
  {
    match: /beauty|skin|cosmetic|makeup|hair/,
    icon: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />,
  },
  {
    match: /health|medical|care|wellbeing/,
    icon: <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />,
  },
  {
    match: /fitness|sport|gym|exercise|outdoor/,
    icon: <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
  },
  {
    match: /home|garden|furniture|kitchen|decor/,
    icon: (
      <>
        <path d="M3.5 11 12 4l8.5 7" />
        <path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5" />
      </>
    ),
  },
  {
    match: /food|grocery|drink|restaurant|coffee|snack/,
    icon: <path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 21V3c-2 0-3.5 2.6-3.5 6s1.5 4.5 3.5 4.5" />,
  },
];

const FALLBACK_ICON = (
  <>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0l-8.3-8.3Z" />
    <circle cx="8" cy="8" r="1.4" />
  </>
);

function iconFor(name: string, slug: string): ReactNode {
  const key = `${name} ${slug}`.toLowerCase();
  return ICONS.find((i) => i.match.test(key))?.icon ?? FALLBACK_ICON;
}

function CategoryIcon({ name, slug, size, strokeWidth }: { name: string; slug: string; size: number; strokeWidth: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconFor(name, slug)}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A category tile for the archive grids (homepage "Browse the Archive" and
 * /categories). With an admin-uploaded image it's a photo under a dark scrim;
 * without one it's a light card tinted with the category's colour, a matching
 * line icon and a large faded watermark of it — so a missing image still reads
 * as a designed tile instead of an empty coloured block.
 */
export function CategoryTile({
  slug,
  name,
  image,
  countLabel,
  sizes,
}: {
  slug: string;
  name: string;
  image?: string | null;
  countLabel: string;
  sizes: string;
}) {
  if (image) {
    return (
      <Link
        href={`/category/${slug}`}
        className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-2xl p-5"
      >
        <Image src={image} alt="" fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <span className="relative font-serif text-lg font-bold text-white">{name}</span>
        <span className="relative mt-0.5 flex items-center justify-between text-xs text-white/80">
          {countLabel}
          <ArrowIcon />
        </span>
      </Link>
    );
  }

  const color = tintForSlug(slug).from;
  return (
    <Link
      href={`/category/${slug}`}
      className="group relative isolate flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-border p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-14px_rgb(0_0_0/0.25)]"
      style={{
        background: `radial-gradient(circle at 100% 0%, color-mix(in srgb, ${color} 38%, transparent), transparent 65%), color-mix(in srgb, ${color} 13%, var(--surface-muted))`,
        borderColor: `color-mix(in srgb, ${color} 32%, var(--border))`,
      }}
    >
      {/* Large faded watermark of the icon, bleeding off the corner. */}
      <span
        className="pointer-events-none absolute -bottom-10 -right-10 -z-10 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
        style={{ color, opacity: 0.16 }}
      >
        <CategoryIcon name={name} slug={slug} size={140} strokeWidth={1.4} />
      </span>

      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
        style={{
          background: color,
          boxShadow: `0 6px 16px -6px color-mix(in srgb, ${color} 70%, transparent)`,
        }}
      >
        <CategoryIcon name={name} slug={slug} size={24} strokeWidth={1.8} />
      </span>

      <span className="flex flex-col gap-1">
        <span className="font-serif text-xl font-bold leading-tight text-text">{name}</span>
        <span className="text-xs font-medium text-text-muted">{countLabel}</span>
        <span
          className="mt-2 flex items-center gap-1 text-xs font-semibold"
          style={{ color: `color-mix(in srgb, ${color} 75%, #000)` }}
        >
          Explore
          <ArrowIcon />
        </span>
      </span>
    </Link>
  );
}
