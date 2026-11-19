import Link from "next/link";
import Image from "next/image";
import { CategoryIcon } from "./CategoryTile";
import { tintForSlug } from "@/lib/categoryTint";
import type { HomeCategoryTile } from "@/lib/data";

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Homepage "Browse the Archive": a deep-green editorial band instead of a grid
 * of pastel tiles. Left: heading, live totals and a link to /categories.
 * Right: a numbered index of every category (icon or admin image, name, post
 * count). Reads well with 2 categories or 20 — past 5 the index splits into
 * two columns rather than growing a long single list.
 */
export function ArchiveIndex({ categories, totalArticles }: { categories: HomeCategoryTile[]; totalArticles: number }) {
  if (categories.length === 0) return null;
  const twoCol = categories.length > 5;

  return (
    <section className="relative isolate overflow-hidden rounded-[28px] bg-footer-bg px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
      {/* Soft brand glow + fine dot texture, so the band has depth rather than reading as a flat block. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-40 -z-10 h-[420px] w-[420px] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--brand-primary) 70%, transparent), transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      />

      <div className={`grid gap-10 ${twoCol ? "lg:grid-cols-[1fr_2fr]" : "lg:grid-cols-[5fr_7fr]"} lg:gap-16`}>
        <div className="flex flex-col gap-5">
          <span className="w-fit rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            Explore
          </span>
          <h2 className="font-serif text-4xl font-bold leading-[1.05] sm:text-5xl">Browse the Archive</h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-white/65">
            Every topic we cover, all in one place — pick a shelf and start reading.
          </p>

          <dl className="mt-2 flex gap-10 border-t border-white/10 pt-6">
            <div className="flex flex-col gap-1">
              <dt className="order-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Articles</dt>
              <dd className="order-1 font-serif text-3xl font-bold">{totalArticles}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="order-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Topics</dt>
              <dd className="order-1 font-serif text-3xl font-bold">{categories.length}</dd>
            </div>
          </dl>

          <Link
            href="/categories"
            className="group mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-footer-bg transition-colors hover:bg-white/90"
          >
            All categories
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              <ArrowIcon />
            </span>
          </Link>
        </div>

        <ul className={`grid self-center border-t border-white/10 ${twoCol ? "sm:grid-cols-2 sm:gap-x-10" : ""}`}>
          {categories.map((cat, i) => {
            const color = tintForSlug(cat.slug).from;
            const count =
              cat.postCount > 0 ? `${cat.postCount} ${cat.postCount === 1 ? "article" : "articles"}` : "Coming soon";
            return (
              <li key={cat._id} className="border-b border-white/10">
                <Link
                  href={`/category/${cat.slug}`}
                  className="group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-5 transition-colors hover:bg-white/[0.05] sm:gap-5"
                >
                  <span className="w-6 shrink-0 font-serif text-sm tabular-nums text-white/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {cat.image ? (
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
                      <Image src={cat.image} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                  ) : (
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10 transition-transform duration-300 group-hover:-rotate-6"
                      style={{
                        background: `color-mix(in srgb, ${color} 22%, transparent)`,
                        color: `color-mix(in srgb, ${color} 55%, white)`,
                      }}
                    >
                      <CategoryIcon name={cat.name} slug={cat.slug} size={24} strokeWidth={1.7} />
                    </span>
                  )}

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-serif text-xl font-semibold transition-transform duration-200 group-hover:translate-x-1 sm:text-2xl">
                      {cat.name}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/50">{count}</span>
                  </span>

                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition-all duration-200 group-hover:border-white group-hover:bg-white group-hover:text-footer-bg">
                    <ArrowIcon />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
