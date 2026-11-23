import type { Metadata } from "next";
import { FormPage, Thumb, ActiveBadge, siteUrl } from "@/components/ui";
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
    <FormPage
      backHref="/categories"
      backLabel="All categories"
      title={category.name}
      subtitle={`/category/${category.slug}`}
      media={<Thumb src={category.image} alt={category.name} size="lg" fallback={category.name} />}
      meta={<ActiveBadge active={category.isActive ?? true} />}
      viewHref={siteUrl(`/category/${category.slug}`)}
    >
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
    </FormPage>
  );
}
