import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { CoverPlaceholder } from "./CoverPlaceholder";
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

function metaLine(post: BlogPostCard) {
  return [post.author, formatDate(post.publishedAt), typeof post.views === "number" ? `${formatViews(post.views)} views` : null]
    .filter(Boolean)
    .join(" · ");
}

const CARD =
  "group overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:border-brand-primary/30 hover:shadow-[0_14px_34px_-16px_rgb(0_0_0/0.25)]";

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Editor's Pick: image on top (4:3, which matches how covers are designed so
 * product graphics aren't cropped), text on a clean card below. Covers often
 * carry their own text, so the title is never laid over them.
 */
function LeadCard({ post }: { post: BlogPostCard }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface-muted shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative">
        {post.coverImage ? (
          <RemoteImage
            src={post.coverImage}
            alt={post.title}
            sizes="(min-width: 1024px) 45vw, 100vw"
            priority
            className="aspect-[4/3] w-full"
            imgClassName="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder className="aspect-[4/3] w-full" />
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface-muted/95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-primary shadow-sm backdrop-blur">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" />
          </svg>
          Editor&apos;s Pick
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-6">
        {post.category && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">{post.category.name}</span>
        )}
        <h2 className="line-clamp-3 text-balance font-serif text-2xl font-bold leading-tight tracking-tight text-text transition-colors group-hover:text-brand-primary">
          {post.title}
        </h2>
        {post.excerpt && <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{post.excerpt}</p>}
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-4">
          <p className="text-xs font-medium text-text-muted">{metaLine(post)}</p>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-primary">
            Read
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** "Latest stories" card: square thumbnail + category, title and meta. */
function StoryRow({ post }: { post: BlogPostCard }) {
  return (
    <Link href={`/blog/${post.slug}`} className={`${CARD} flex items-center gap-4 p-3`}>
      {post.coverImage ? (
        <RemoteImage
          src={post.coverImage}
          alt={post.title}
          sizes="96px"
          className="aspect-square w-20 shrink-0 rounded-xl sm:w-24"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <CoverPlaceholder compact className="aspect-square w-20 shrink-0 rounded-xl sm:w-24" />
      )}
      <div className="flex min-w-0 flex-col gap-1 pr-1">
        {post.category && (
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary">{post.category.name}</span>
        )}
        <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand-primary">
          {post.title}
        </h3>
        <p className="text-xs text-text-muted">{formatDate(post.publishedAt)}</p>
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-serif text-2xl font-bold text-text sm:text-3xl">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>
    </div>
  );
}

/**
 * Homepage lead, magazine-style: on large screens the headline block
 * (overline, headline, description, CTAs, real site stats) sits left of the
 * Editor's Pick card; a "Latest stories" row of up to three posts follows.
 * The headline/description come from the admin-configured hero settings.
 */
export function FeaturedHero({
  post,
  nextUp,
  fallback,
  stats,
}: {
  post: BlogPostCard | null;
  nextUp: BlogPostCard[];
  fallback: { overline: string; heading: ReactNode; description: ReactNode; heroImage?: string | null };
  stats?: { articles: number; topics: number };
}) {
  const rows = nextUp.filter((p) => p._id !== post?._id).slice(0, 3);

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* Background: soft brand wash + faint dot grid, fading out downward. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(55% 60% at 85% 20%, color-mix(in srgb, var(--brand-primary) 14%, transparent), transparent 70%), radial-gradient(40% 50% at 0% 0%, color-mix(in srgb, var(--brand-accent) 8%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--brand-primary) 18%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to bottom, black, transparent 75%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 75%)",
        }}
      />

      <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-12 sm:px-8 lg:pb-16 lg:pt-16">
        <div className={`grid grid-cols-1 items-center gap-12 ${post ? "lg:grid-cols-[1.05fr_1fr] lg:gap-16" : ""}`}>
          <div className={`flex flex-col ${post ? "items-start text-left" : "mx-auto max-w-3xl items-center text-center"}`}>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-surface-muted px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" aria-hidden="true" />
              {fallback.overline}
            </span>
            <h1 className="mt-6 text-balance font-serif text-5xl font-bold leading-[1.02] tracking-tight text-text sm:text-6xl lg:text-[4.25rem]">
              {fallback.heading}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">{fallback.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/blog"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_var(--brand-primary)] transition-colors hover:bg-brand-primary-hover"
              >
                Start Reading
                <ArrowIcon />
              </Link>
              <Link
                href="/deals"
                className="inline-flex items-center rounded-full border border-border bg-surface-muted px-6 py-3 text-sm font-semibold text-text transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
              >
                Browse Deals
              </Link>
            </div>
            {stats && (
              <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
                <Stat value={String(stats.articles)} label={stats.articles === 1 ? "Article" : "Articles"} />
                <Stat value={String(stats.topics)} label={stats.topics === 1 ? "Topic" : "Topics"} />
                <Stat value="100%" label="Free to read" />
              </div>
            )}
          </div>

          {post && (
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              {/* Offset tinted panel behind the card for depth. */}
              <div
                aria-hidden="true"
                className="absolute -right-3 -top-3 -z-10 h-full w-full rotate-2 rounded-3xl sm:-right-5 sm:-top-5"
                style={{ background: "color-mix(in srgb, var(--brand-primary) 14%, var(--surface-muted))" }}
              />
              <LeadCard post={post} />
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="mt-14 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-2xl font-bold tracking-tight text-text">Latest stories</h2>
              <Link href="/blog" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary">
                View all
                <ArrowIcon />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {rows.map((item) => (
                <StoryRow key={item._id} post={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export { withLineBreaks };
