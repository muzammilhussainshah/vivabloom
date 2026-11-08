import type { Metadata } from "next";
import Link from "next/link";
import { CategoryForm } from "../CategoryForm";
import { createCategory } from "../actions";

export const metadata: Metadata = { title: "New Category" };

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; storeUrl?: string; siteTitle?: string; siteDescription?: string }>;
}) {
  const { name, storeUrl, siteTitle, siteDescription } = await searchParams;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/categories" className="text-sm text-brand-primary hover:underline">
        ← All categories
      </Link>
      <h1 className="text-2xl font-semibold">New Category</h1>
      <CategoryForm
        action={createCategory}
        submitLabel="Create Category"
        initialData={name ? { name, slug: "", isActive: true, sortOrder: 0 } : undefined}
        aiContext={storeUrl ? { storeUrl, siteTitle, siteDescription } : undefined}
      />
    </div>
  );
}
