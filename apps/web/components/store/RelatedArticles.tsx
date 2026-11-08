import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import type { BlogPostCard } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";

/** Omitted entirely when there are no linked posts (BlogPost.relatedStores) — no fallback content to fabricate. */
export function RelatedArticles({ posts, dict }: { posts: BlogPostCard[]; dict: Dictionary["relatedArticles"] }) {
  if (posts.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-10 md:py-14">
      <div className="flex items-center justify-between">
        <h2 className="sv-subsection-heading font-store-serif" style={{ color: "var(--text)" }}>
          {dict.heading}
        </h2>
        <Link href="/blog" className="text-sm font-bold" style={{ color: "var(--secondary)" }}>
          {dict.allArticles} →
        </Link>
      </div>

      <div className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {posts.slice(0, 3).map((post) => (
          <Link
            key={post._id}
            href={`/blog/${post.slug}`}
            className="w-[220px] shrink-0 overflow-hidden rounded-[16px] md:w-auto"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="h-[150px] w-full" style={{ background: "var(--muted)" }}>
              {post.coverImage && <RemoteImage src={post.coverImage} alt={post.title} sizes="240px" className="h-full w-full" />}
            </div>
            <div className="flex flex-col gap-1.5 p-3.5">
              {post.category?.name && (
                <span className="font-store-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-text)" }}>
                  {post.category.name}
                </span>
              )}
              <p className="line-clamp-2 text-[15px] font-bold" style={{ color: "var(--text)" }}>
                {post.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
