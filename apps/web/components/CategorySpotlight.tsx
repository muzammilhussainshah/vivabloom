import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { tintForSlug, tintGradient } from "@/lib/categoryTint";
import type { BlogPostCard, CategoryRef } from "@/lib/data";

/** "1,234" under 10k, "12.3K" beyond. */
function formatViews(views: number) {
  if (views >= 10000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString("en-US");
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
    <section
      className="rounded-2xl border border-border bg-surface-muted p-5 sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white"
          style={{ background: tint.from }}
        >
          {category.name}
        </span>
        <Link href={`/category/${category.slug}`} className="text-sm font-semibold text-brand-primary hover:underline">
          More in {category.name} →
        </Link>
      </div>
      <div className={`grid grid-cols-1 gap-5 md:grid-cols-[1.3fr_1fr] ${align === "right" ? "md:[direction:rtl] [&>*]:[direction:ltr]" : ""}`}>
        <Link href={`/blog/${lead.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-brand-primary">
          {lead.coverImage ? (
            <RemoteImage
              src={lead.coverImage}
              alt={lead.title}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[16/10] w-full"
              imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="aspect-[16/10] w-full" style={{ background: tintGradient(category.slug) }} />
          )}
          <div className="flex flex-col gap-2 p-5">
            <h3 className="text-balance font-serif text-xl font-bold leading-tight text-text group-hover:text-brand-primary sm:text-2xl">
              {lead.title}
            </h3>
            {lead.excerpt && <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{lead.excerpt}</p>}
            {typeof lead.views === "number" && <span className="text-xs text-text-muted">{formatViews(lead.views)} views</span>}
          </div>
        </Link>

        <div className="flex flex-col gap-5">
          {secondary.map((post) => (
            <Link
              key={post._id}
              href={`/blog/${post.slug}`}
              className="group flex flex-1 items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand-primary"
            >
              {post.coverImage ? (
                <RemoteImage
                  src={post.coverImage}
                  alt={post.title}
                  sizes="96px"
                  className="aspect-square w-24 shrink-0 rounded-2xl"
                  imgClassName="object-cover"
                />
              ) : (
                <div className="aspect-square w-24 shrink-0 rounded-2xl" style={{ background: tintGradient(post.category?.slug ?? post.slug) }} />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <p className="line-clamp-3 font-serif text-base font-semibold leading-snug text-text group-hover:text-brand-primary">
                  {post.title}
                </p>
                {typeof post.views === "number" && <span className="text-xs text-text-muted">{formatViews(post.views)} views</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
