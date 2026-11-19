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

export function CategoryIcon({ name, slug, size, strokeWidth }: { name: string; slug: string; size: number; strokeWidth: number }) {
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A category card for the /categories page. Top: a banner — the admin image
 * when there is one, otherwise a soft tint of the category's colour with its
 * line icon centred in a frosted badge over a fine dot texture (so a missing
 * image still reads as designed). Body: index number, serif name, a short
 * description, store/article counts as a stat row, and an "Explore" footer
 * whose arrow fills in on hover.
 */
export function CategoryTile({
  index,
  slug,
  name,
  description,
  image,
  storeCount = 0,
  postCount = 0,
  sizes,
}: {
  index: number;
  slug: string;
  name: string;
  description?: string;
  image?: string | null;
  storeCount?: number;
  postCount?: number;
  sizes: string;
}) {
  const color = tintForSlug(slug).from;
  const blurb = description?.trim() || `Guides, verified deals and trusted stores for ${name.toLowerCase()}.`;

  return (
    <Link
      href={`/category/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]"
    >
      <div
        className="relative isolate flex h-44 items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle at 85% 10%, color-mix(in srgb, ${color} 34%, transparent), transparent 60%), color-mix(in srgb, ${color} 12%, var(--surface-muted))`,
        }}
      >
        {image ? (
          <Image src={image} alt="" fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-40"
              style={{
                backgroundImage: `radial-gradient(color-mix(in srgb, ${color} 45%, transparent) 1px, transparent 1px)`,
                backgroundSize: "16px 16px",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              }}
            />
            <span
              className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-white/80 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.3)] ring-1 ring-white backdrop-blur transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105"
              style={{ color }}
            >
              <CategoryIcon name={name} slug={slug} size={34} strokeWidth={1.6} />
            </span>
          </>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/85 px-2.5 py-1 font-serif text-xs font-semibold tabular-nums text-text shadow-sm backdrop-blur">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <h2 className="font-serif text-2xl font-bold leading-tight text-text transition-colors group-hover:text-brand-primary">
          {name}
        </h2>
        <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{blurb}</p>

        <p className="mt-1 flex items-center gap-5 text-sm text-text-muted">
          <span className="flex items-baseline gap-1.5">
            <span className="font-serif text-lg font-bold text-text">{storeCount}</span>
            {storeCount === 1 ? "store" : "stores"}
          </span>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <span className="flex items-baseline gap-1.5">
            <span className="font-serif text-lg font-bold text-text">{postCount}</span>
            {postCount === 1 ? "article" : "articles"}
          </span>
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-semibold text-brand-primary">Explore category</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-brand-primary transition-all duration-200 group-hover:border-brand-primary group-hover:bg-brand-primary group-hover:text-white">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}
