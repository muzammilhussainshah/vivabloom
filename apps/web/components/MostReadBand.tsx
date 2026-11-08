import Link from "next/link";
import type { BlogPostCard } from "@/lib/data";

/** "1,234" under 10k, "12.3K" beyond. */
function formatViews(views: number) {
  if (views >= 10000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString("en-US");
}

/** Cream-banded "Most Read" section — numbered 01-05 by real (mocked-but-incrementing) view count. Mobile: stacked list. Desktop: row of 5. */
export function MostReadBand({ posts }: { posts: BlogPostCard[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="rounded-2xl border border-border bg-surface-muted px-6 py-10 text-text sm:px-10 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-2xl font-bold sm:text-4xl">Most Read This Month</h2>
            <p className="text-sm text-text-muted">The stories our readers keep coming back to.</p>
          </div>
          <Link href="/blog" className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-brand-primary hover:bg-surface">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="flex snap-x gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible">
          {posts.map((post, i) => (
            <Link
              key={post._id}
              href={`/blog/${post.slug}`}
              className="group flex w-56 shrink-0 snap-start flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand-primary sm:w-auto"
            >
              <span className="font-serif text-5xl font-extrabold leading-none text-brand-primary/40 transition-colors group-hover:text-brand-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="line-clamp-4 font-serif text-sm font-semibold leading-snug">{post.title}</p>
              <span className="mt-auto text-xs text-text-muted">
                {[post.category?.name, typeof post.views === "number" ? `${formatViews(post.views)} views` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
