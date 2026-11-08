import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase, BlogPost, Category } from "@monocoupon/db";
import { deleteBlogPost, publishNow } from "./actions";

export const metadata: Metadata = { title: "Blog Posts" };
export const dynamic = "force-dynamic";

export default async function BlogPostsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const { status, category: categoryFilter } = await searchParams;
  await connectToDatabase();

  const filter: Record<string, string> = {};
  if (status) filter.status = status;
  if (categoryFilter) filter.category = categoryFilter;

  const [posts, categories] = await Promise.all([
    BlogPost.find(filter).populate("category", "name").sort({ createdAt: -1 }).lean(),
    Category.find({}, "name").sort({ name: 1 }).lean(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Blog Posts</h1>
        <div className="flex gap-3">
          <Link
            href="/categories"
            className="rounded-base border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Manage Categories
          </Link>
          <Link
            href="/blog/new"
            className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
          >
            New Post
          </Link>
        </div>
      </div>

      <form className="flex gap-2">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <select
          name="category"
          defaultValue={categoryFilter ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={String(c._id)} value={String(c._id)}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-base border border-border px-4 py-2 text-sm hover:bg-surface-muted">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Category</th>
              <th className="p-3">Status</th>
              <th className="p-3">Published</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => {
              const category = p.category as unknown as { name: string } | null;
              return (
                <tr key={String(p._id)} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{p.title}</td>
                  <td className="p-3 text-text-muted">{category?.name ?? "—"}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                  <td className="p-3 text-text-muted">
                    {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-3">
                      {p.status !== "published" && (
                        <form action={publishNow.bind(null, String(p._id))}>
                          <button type="submit" className="text-brand-accent hover:underline">
                            Publish now
                          </button>
                        </form>
                      )}
                      <Link href={`/blog/${p._id}/edit`} className="text-brand-primary hover:underline">
                        Edit
                      </Link>
                      <form action={deleteBlogPost.bind(null, String(p._id))}>
                        <button type="submit" className="text-brand-secondary hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No posts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
