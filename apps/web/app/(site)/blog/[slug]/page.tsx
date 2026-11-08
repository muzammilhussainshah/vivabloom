import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllBlogPostSlugs, getBlogPost, type BlogPostCard } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { RemoteImage } from "@/components/RemoteImage";
import { ProductCard } from "@/components/ProductCard";
import { BlogViewCounter } from "@/components/BlogViewCounter";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo";

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
      className="group flex gap-3 rounded-base border border-brand-primary/20 p-2 transition-colors hover:border-brand-primary"
      style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)" }}
    >
      {post.coverImage && (
        <RemoteImage
          src={post.coverImage}
          alt={post.title}
          sizes="64px"
          className="h-16 w-16 shrink-0 rounded-base"
        />
      )}
      <div className="flex min-w-0 flex-col justify-center">
        <p className="line-clamp-2 text-sm font-medium text-text group-hover:text-brand-primary">
          {post.title}
        </p>
        {date && <p className="mt-1 text-xs text-brand-accent">{date}</p>}
      </div>
    </Link>
  );
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBlogPost(slug);
  if (!data) notFound();
  const { post, relatedPosts, relatedProducts } = data;
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
      <Link href="/blog" className="text-sm text-brand-primary hover:underline">
        ← All articles
      </Link>

      {/* Mobile-first: single column; on large screens the related-articles
          rail sits alongside the article. */}
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <article className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex flex-col gap-3">
            {post.category && (
              <Link
                href={`/category/${post.category.slug}`}
                className="text-xs font-semibold uppercase tracking-wide text-brand-secondary hover:underline"
              >
                {post.category.name}
              </Link>
            )}
            <h1 className="text-3xl font-bold sm:text-4xl">{post.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-brand-accent">
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
                    className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-accent"
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
              className="aspect-video w-full rounded-base"
            />
          )}

          {/* content is HTML from the admin's Tiptap editor — trusted (admin-only authored), not user input */}
          <div
            className="text-text [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-brand-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

        </article>

        {(relatedPosts.length > 0 || relatedProducts.length > 0) && (
          <aside className="w-full lg:w-80 lg:shrink-0">
            <div className="flex flex-col gap-8 lg:sticky lg:top-24">
              {relatedPosts.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Related Articles</h2>
                  <div className="flex flex-col gap-3">
                    {relatedPosts.map((p) => (
                      <RelatedArticleItem key={p._id} post={p} />
                    ))}
                  </div>
                </div>
              )}

              {relatedProducts.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">You Might Like</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {relatedProducts.map((product) => (
                      <ProductCard key={product._id} product={product} />
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
