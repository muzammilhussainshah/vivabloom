import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase, Category } from "@monocoupon/db";
import { deleteCategory } from "./actions";
import { CategoryAISuggest } from "./CategoryAISuggest";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesListPage() {
  await connectToDatabase();
  const categories = await Category.find({}).sort({ sortOrder: 1 }).lean();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Link
          href="/categories/new"
          className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          New Category
        </Link>
      </div>

      <CategoryAISuggest />

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Status</th>
              <th className="p-3">Order</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={String(c._id)} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 font-mono text-text-muted">{c.slug}</td>
                <td className="p-3">
                  {c.isActive ? (
                    <span className="text-brand-accent">Active</span>
                  ) : (
                    <span className="text-text-muted">Inactive</span>
                  )}
                </td>
                <td className="p-3">{c.sortOrder}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link href={`/categories/${c._id}/edit`} className="text-brand-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteCategory.bind(null, String(c._id))}>
                      <button type="submit" className="text-brand-secondary hover:underline">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
