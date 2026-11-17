import type { Metadata } from "next";
import { getPublishedBlogPosts, getBlogPostsPage } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { BlogCard } from "@/components/BlogCard";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

// A search query makes this page dynamic; the default (no query) listing
// still benefits from ISR caching via generateMetadata/revalidate.
export const revalidate = 600;

export const metadata: Metadata = { title: "Blog", alternates: { canonical: "/blog" } };

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  const posts = query
    ? (await getBlogPostsPage({ skip: 0, limit: 60, q: query })).posts
    : await getPublishedBlogPosts();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])} />
      {!query && <JsonLd data={itemListJsonLd(posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` })))} />}
      <PageHeader
        eyebrow={query ? "Search" : "VivaBloom Insights"}
        title={query ? `Results for “${query}”` : "The Blog"}
        description={
          query
            ? `${posts.length} ${posts.length === 1 ? "article" : "articles"} found.`
            : "Well-researched guides on supplements, wellness routines and shopping smarter — so you can buy with confidence."
        }
      />
      {posts.length === 0 ? (
        <p className="text-sm text-text-muted">
          {query ? `No articles match “${query}”.` : "No articles yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
