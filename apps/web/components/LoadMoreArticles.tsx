"use client";

import { useState } from "react";
import { BlogCard } from "./BlogCard";
import type { BlogPostCard } from "@/lib/data";

const PAGE_SIZE = 9;

/**
 * The "Showing X of Y articles" grid with a Load More button. Seeded with the
 * first page rendered on the server, then appends further pages from
 * /api/blog/posts on demand.
 */
export function LoadMoreArticles({
  initialPosts,
  total,
}: {
  initialPosts: BlogPostCard[];
  total: number;
}) {
  const [posts, setPosts] = useState<BlogPostCard[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = posts.length < total;

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blog/posts?skip=${posts.length}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("Failed to load more articles.");
      const data = (await res.json()) as { posts: BlogPostCard[] };
      setPosts((prev) => [...prev, ...data.posts]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more articles.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-text-muted">
        Showing <span className="font-semibold text-text">{posts.length}</span> of{" "}
        <span className="font-semibold text-text">{total}</span> articles
      </p>

      {posts.length === 0 ? (
        <p className="text-sm text-text-muted">No articles yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post._id} post={post} />
          ))}
        </div>
      )}

      {error && <p className="text-center text-sm text-brand-secondary">{error}</p>}

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-full bg-brand-primary px-8 py-3 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load More Articles"}
          </button>
        </div>
      )}
    </div>
  );
}
