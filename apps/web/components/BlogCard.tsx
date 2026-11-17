import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { CoverPlaceholder } from "./CoverPlaceholder";
import type { BlogPostCard } from "@/lib/data";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "1,234" under 10k, "12.3K" beyond — keeps the meta row compact once a popular post racks up views. */
function formatViews(views: number) {
  if (views >= 10000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString("en-US");
}

export function BlogCard({ post }: { post: BlogPostCard }) {
  const date = formatDate(post.publishedAt);
  const meta = [date, typeof post.views === "number" ? `${formatViews(post.views)} views` : null].filter(Boolean);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-[0_10px_28px_-12px_rgb(0_0_0/0.18)]"
    >
      {post.coverImage ? (
        <RemoteImage
          src={post.coverImage}
          alt={post.title}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-[4/3] w-full"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <CoverPlaceholder className="aspect-[4/3] w-full" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        {post.category?.name && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">{post.category.name}</p>
        )}
        <p className="line-clamp-2 font-serif text-lg font-semibold leading-snug text-text transition-colors group-hover:text-brand-primary">
          {post.title}
        </p>
        {post.excerpt && <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{post.excerpt}</p>}
        {meta.length > 0 && (
          <p className="mt-auto pt-2 text-xs font-medium text-text-muted">{meta.join(" · ")}</p>
        )}
      </div>
    </Link>
  );
}
