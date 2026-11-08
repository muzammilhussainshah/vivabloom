import { Fragment, type ReactNode } from "react";
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

/** Renders admin-entered text, treating both real newlines and a literal "\n" as line breaks. */
function withLineBreaks(text: string) {
  const lines = text.replace(/\n/g, "\n").split(/\r?\n/);
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

/** Image-first bento tile: the cover fills the tile, with the title laid over a dark scrim. */
function BentoTile({
  post,
  large = false,
  priority = false,
}: {
  post: BlogPostCard;
  large?: boolean;
  priority?: boolean;
}) {
  const date = formatDate(post.publishedAt);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group relative isolate flex overflow-hidden rounded-2xl ${
        large ? "min-h-[420px] sm:min-h-[520px] lg:row-span-3" : "min-h-[200px]"
      }`}
    >
      {post.coverImage ? (
        <RemoteImage
          src={post.coverImage}
          alt={post.title}
          sizes={large ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 35vw, 100vw"}
          className="absolute inset-0 h-full w-full"
          priority={priority}
          imgClassName="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: tintGradient(post.category?.slug ?? post.slug) }} />
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative mt-auto flex w-full flex-col gap-2 p-5 text-white sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
          {large && <span className="rounded-full bg-brand-primary px-3 py-1">Editor&apos;s Pick</span>}
          {post.category && <span className="rounded-full bg-white/20 px-3 py-1">{post.category.name}</span>}
        </div>
        <h2
          className={`text-balance font-serif font-bold leading-tight ${
            large ? "text-3xl sm:text-5xl" : "line-clamp-3 text-lg sm:text-xl"
          }`}
        >
          {post.title}
        </h2>
        {large && post.excerpt && <p className="line-clamp-2 max-w-[56ch] text-white/85 sm:text-lg">{post.excerpt}</p>}
        <p className="text-xs text-white/75">
          {[post.author, date, typeof post.views === "number" ? `${formatViews(post.views)} views` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}

/**
 * Homepage lead: a centered headline block (overline pill, headline,
 * description, two CTAs) above a bento grid — one large "Editor's Pick" tile
 * beside up to three stacked "Next Up" tiles. The headline/description come
 * from the admin-configured hero settings.
 */
export function FeaturedHero({
  post,
  nextUp,
  fallback,
}: {
  post: BlogPostCard | null;
  nextUp: BlogPostCard[];
  fallback: { overline: string; heading: ReactNode; description: ReactNode; heroImage?: string | null };
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-12 sm:px-8 sm:pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="rounded-full border border-brand-primary/20 bg-surface-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent ">
            {fallback.overline}
          </span>
          <h1 className="mt-5 text-balance font-serif text-5xl font-extrabold leading-[1.05] sm:text-7xl">
            <span className="text-text">
              {fallback.heading}
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-text-muted sm:text-lg">{fallback.description}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/blog"
              className="rounded-full bg-brand-primary px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              Start Reading
            </Link>
            <Link
              href="/deals"
              className="rounded-full border border-border bg-surface-muted px-7 py-3 text-sm font-semibold text-brand-accent transition-colors hover:border-brand-primary"
            >
              Browse Deals
            </Link>
          </div>
        </div>

        {post && (
          <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr] lg:grid-rows-3">
            <BentoTile post={post} large priority />
            {nextUp.slice(0, 3).map((item) => (
              <BentoTile key={item._id} post={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export { withLineBreaks };
