import type { Metadata } from "next";
import { FormPage } from "@/components/ui";
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
    <FormPage backHref="/categories" backLabel="All categories" title="New category" subtitle="Group stores and blog posts under a shared topic.">
      <CategoryForm
        action={createCategory}
        submitLabel="Create Category"
        initialData={name ? { name, slug: "", isActive: true, sortOrder: 0 } : undefined}
        aiContext={storeUrl ? { storeUrl, siteTitle, siteDescription } : undefined}
      />
    </FormPage>
  );
}
