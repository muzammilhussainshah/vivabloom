import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { CoverPlaceholder } from "./CoverPlaceholder";
import { tintForSlug } from "@/lib/categoryTint";
import type { BlogPostCard, CategoryRef } from "@/lib/data";

/** "1,234" under 10k, "12.3K" beyond. */
function formatViews(views: number) {
  if (views >= 10000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString("en-US");
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function meta(post: BlogPostCard) {
  return [formatDate(post.publishedAt), typeof post.views === "number" ? `${formatViews(post.views)} views` : null]
    .filter(Boolean)
    .join(" · ");
}

const CARD =
  "group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-[0_16px_36px_-18px_rgb(0_0_0/0.3)]";

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A featured category block: 1 lead post (image + title + excerpt) + up to 2
 * secondary text links. Alternates image side on desktop via `align`; always
 * stacks image-above-text below `md` (mobile-first — side-by-side is an
 * enhancement, not the default).
 */
export function CategorySpotlight({
  category,
  posts,
  align,
}: {
  category: CategoryRef & { description?: string };
  posts: BlogPostCard[];
  align: "left" | "right";
}) {
  const [lead, ...rest] = posts;
  if (!lead) return null;
  const secondary = rest.slice(0, 2);
  const tint = tintForSlug(category.slug);

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span
            className="inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white"
            style={{ background: tint.from }}
          >
            {category.name}
          </span>
          {category.description && <p className="max-w-xl text-sm text-text-muted">{category.description}</p>}
        </div>
        <Link
          href={`/category/${category.slug}`}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary"
        >
          More in {category.name}
          <ArrowIcon />
        </Link>
      </div>

      <div
        className={`grid grid-cols-1 gap-5 ${secondary.length > 0 ? "md:grid-cols-[1.4fr_1fr]" : ""} ${
          align === "right" && secondary.length > 0 ? "md:[direction:rtl] [&>*]:[direction:ltr]" : ""
        }`}
      >
        {/* Lead story */}
        <Link href={`/blog/${lead.slug}`} className={CARD}>
          {lead.coverImage ? (
            <RemoteImage
              src={lead.coverImage}
              alt={lead.title}
              sizes="(min-width: 768px) 55vw, 100vw"
              className="aspect-[16/10] w-full"
              imgClassName="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <CoverPlaceholder className="aspect-[16/10] w-full" />
          )}
          <div className="flex flex-1 flex-col gap-2.5 p-6">
            <h3 className="text-balance font-serif text-xl font-bold leading-tight tracking-tight text-text transition-colors group-hover:text-brand-primary sm:text-2xl">
              {lead.title}
            </h3>
            {lead.excerpt && <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{lead.excerpt}</p>}
            <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-4">
              <span className="text-xs font-medium text-text-muted">{meta(lead)}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary">
                Read
                <ArrowIcon />
              </span>
            </div>
          </div>
        </Link>

        {/* Secondary stories: image grows to fill, so the stack ends flush with the lead card. */}
        {secondary.length > 0 && (
          <div className="flex h-full flex-col gap-5">
            {secondary.map((post) => (
              <Link key={post._id} href={`/blog/${post.slug}`} className={`${CARD} flex-1`}>
                {post.coverImage ? (
                  <RemoteImage
                    src={post.coverImage}
                    alt={post.title}
                    sizes="(min-width: 768px) 30vw, 100vw"
                    className="aspect-[16/9] w-full md:aspect-auto md:min-h-[120px] md:flex-1"
                    imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <CoverPlaceholder className="aspect-[16/9] w-full md:aspect-auto md:min-h-[120px] md:flex-1" />
                )}
                <div className="flex flex-col gap-1.5 p-4">
                  <p className="line-clamp-2 font-serif text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand-primary">
                    {post.title}
                  </p>
                  <span className="text-xs text-text-muted">{meta(post)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
