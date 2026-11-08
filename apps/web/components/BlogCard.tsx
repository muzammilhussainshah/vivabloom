import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { tintGradient } from "@/lib/categoryTint";
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-muted transition-colors hover:border-brand-primary/40"
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
        <div
          className="aspect-[4/3] w-full"
          style={{ background: tintGradient(post.category?.slug ?? post.slug) }}
        />
      )}
      <div className="flex flex-col gap-2 p-5">
        {meta.length > 0 && (
          <p className="text-xs font-medium text-text-muted">{meta.join(" · ")}</p>
        )}
        <p className="line-clamp-2 font-serif text-lg font-semibold text-text group-hover:text-brand-primary">
          {post.title}
        </p>
        {post.excerpt && <p className="line-clamp-2 text-sm text-text-muted">{post.excerpt}</p>}
      </div>
    </Link>
  );
}
