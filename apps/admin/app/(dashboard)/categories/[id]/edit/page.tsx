import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connectToDatabase, Category } from "@monocoupon/db";
import { CategoryForm } from "../../CategoryForm";
import { updateCategory } from "../../actions";

export const metadata: Metadata = { title: "Edit Category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const category = await Category.findById(id).lean();
  if (!category) notFound();

  const action = updateCategory.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/categories" className="text-sm text-brand-primary hover:underline">
        ← All categories
      </Link>
      <h1 className="text-2xl font-semibold">Edit Category</h1>
      <CategoryForm
        action={action}
        submitLabel="Save Changes"
        initialData={{
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          image: category.image,
          seoTitle: category.seoTitle,
          seoDescription: category.seoDescription,
          isActive: category.isActive ?? true,
          sortOrder: category.sortOrder ?? 0,
        }}
      />
    </div>
  );
}
