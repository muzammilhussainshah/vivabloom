import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { tintGradient } from "@/lib/categoryTint";
import type { BlogPostCard } from "@/lib/data";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "1,234" under 10k, "12.3K" beyond. */
function formatViews(views: number) {
  if (views >= 10000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString("en-US");
}

/** One dense list row (small thumb + title + date) — used by LoadMoreArticles for the catch-all "Fresh This Week" list instead of a repeated card grid. */
export function FreshWeekRow({ post }: { post: BlogPostCard }) {
  const date = formatDate(post.publishedAt);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex items-center gap-4 border-b border-border py-4 first:pt-0 last:border-b-0"
    >
      {post.coverImage ? (
        <RemoteImage
          src={post.coverImage}
          alt={post.title}
          sizes="56px"
          className="aspect-square w-14 shrink-0 rounded-base"
          imgClassName="object-cover"
        />
      ) : (
        <div
          className="aspect-square w-14 shrink-0 rounded-base"
          style={{ background: tintGradient(post.category?.slug ?? post.slug) }}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 font-serif text-base font-semibold text-text group-hover:text-brand-primary">
          {post.title}
        </p>
        <p className="text-xs text-text-muted">
          {[post.category?.name, date, typeof post.views === "number" ? `${formatViews(post.views)} views` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
