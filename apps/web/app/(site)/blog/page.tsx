import type { Metadata } from "next";
import { getPublishedBlogPosts, getBlogPostsPage } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { BlogCard } from "@/components/BlogCard";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 sm:px-8">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])} />
      {!query && <JsonLd data={itemListJsonLd(posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` })))} />}
      <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">
        {query ? `Search results for “${query}”` : "Blog"}
      </h1>
      {posts.length === 0 ? (
        <p className="text-sm text-text-muted">
          {query ? `No articles match “${query}”.` : "No articles yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
