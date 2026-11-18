import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllBlogPostSlugs, getBlogPost, type BlogPostCard } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { CoverPlaceholder } from "@/components/CoverPlaceholder";
import { RemoteImage } from "@/components/RemoteImage";
import { CatalogCard } from "@/components/CatalogCard";
import { BlogViewCounter } from "@/components/BlogViewCounter";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { BackLink } from "@/components/BackLink";

export const revalidate = 1800;

export async function generateStaticParams() {
  const slugs = await getAllBlogPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBlogPost(slug);
  if (!data) return { title: "Article not found" };
  return {
    title: data.post.title,
    description: data.post.excerpt,
    keywords: data.post.tags && data.post.tags.length > 0 ? data.post.tags : undefined,
    alternates: { canonical: `/blog/${slug}` },
  };
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 5.5H12.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 1.5V3.5M10 1.5V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 12.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Compact sidebar item for the related-articles list. */
function RelatedArticleItem({ post }: { post: BlogPostCard }) {
  const date = formatDate(post.publishedAt);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface-muted p-2.5 transition-all hover:border-brand-primary/30 hover:shadow-[0_8px_20px_-12px_rgb(0_0_0/0.2)]"
    >
      {post.coverImage ? (
        <RemoteImage
          src={post.coverImage}
          alt={post.title}
          sizes="64px"
          className="h-16 w-16 shrink-0 overflow-hidden rounded-lg"
          imgClassName="object-cover"
        />
      ) : (
        <CoverPlaceholder compact className="h-16 w-16 shrink-0 rounded-lg" />
      )}
      <div className="flex min-w-0 flex-col justify-center gap-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-text transition-colors group-hover:text-brand-primary">
          {post.title}
        </p>
        {date && <p className="text-xs text-text-muted">{date}</p>}
      </div>
    </Link>
  );
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBlogPost(slug);
  if (!data) notFound();
  const { post, relatedPosts, relatedItems } = data;
  const date = formatDate(post.publishedAt);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8">
      <JsonLd data={blogPostingJsonLd(post)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <BackLink href="/blog">All articles</BackLink>

      {/* Mobile-first: single column; on large screens the related-articles
          rail sits alongside the article. */}
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <article className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex flex-col gap-3">
            {post.category && (
              <Link
                href={`/category/${post.category.slug}`}
                className="w-fit text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent hover:underline"
              >
                {post.category.name}
              </Link>
            )}
            <h1 className="text-balance font-serif text-3xl font-bold leading-tight tracking-tight text-text sm:text-[2.6rem]">{post.title}</h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-text-muted">
              {date && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon />
                  {date}
                </span>
              )}
              {post.author && (
                <span className="inline-flex items-center gap-1.5">
                  <PersonIcon />
                  {post.author}
                </span>
              )}
              {typeof post.views === "number" && (
                <BlogViewCounter slug={post.slug} initialViews={post.views} />
              )}
            </div>

            {post.tags && post.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </header>

          {post.coverImage && (
            <RemoteImage
              src={post.coverImage}
              alt={post.title}
              priority
              sizes="(min-width: 1024px) 720px, 100vw"
              className="aspect-video w-full overflow-hidden rounded-2xl"
            />
          )}

          {/* content is HTML from the admin's Tiptap editor — trusted (admin-only authored), not user input */}
          <div
            className="text-[17px] leading-[1.75] text-text [&_h2]:mt-10 [&_h2]:mb-1 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:pl-1 [&_a]:text-brand-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_img]:my-6 [&_img]:rounded-2xl [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

        </article>

        {(relatedPosts.length > 0 || relatedItems.length > 0) && (
          <aside className="w-full lg:mt-1 lg:w-80 lg:shrink-0">
            <div className="flex flex-col gap-8 lg:sticky lg:top-24">
              {relatedPosts.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h2 className="font-serif text-xl font-semibold tracking-tight">Related Articles</h2>
                  <div className="flex flex-col gap-3">
                    {relatedPosts.map((p) => (
                      <RelatedArticleItem key={p._id} post={p} />
                    ))}
                  </div>
                </div>
              )}

              {relatedItems.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h2 className="font-serif text-xl font-semibold tracking-tight">You Might Like</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {relatedItems.map((item) => (
                      <CatalogCard key={`${item.kind}-${item.data._id}`} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
