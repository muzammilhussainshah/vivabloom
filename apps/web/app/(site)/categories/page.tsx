import type { Metadata } from "next";
import { getAllCategories, type CategoryCard } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { CategoryTile } from "@/components/CategoryTile";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Categories", alternates: { canonical: "/categories" } };

/** Categories are shared between stores and blog posts — show whichever counts are non-zero. */
function countsLabel(category: CategoryCard) {
  const parts: string[] = [];
  if (category.storeCount) parts.push(`${category.storeCount} store${category.storeCount === 1 ? "" : "s"}`);
  if (category.postCount) parts.push(`${category.postCount} article${category.postCount === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : "No stores or articles yet";
}

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Categories", path: "/categories" }])} />
      <JsonLd
        data={itemListJsonLd(categories.map((c) => ({ name: c.name, path: `/category/${c.slug}` })))}
      />
      <PageHeader
        eyebrow="Explore"
        title="Shop by Category"
        description="Every topic we cover — guides, verified deals and trusted stores, organised in one place."
      />
      {categories.length === 0 ? (
        <p className="text-sm text-text-muted">No categories yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((category) => (
            <CategoryTile
              key={category._id}
              slug={category.slug}
              name={category.name}
              image={category.image}
              countLabel={countsLabel(category)}
              sizes="(min-width: 768px) 25vw, 50vw"
            />
          ))}
        </div>
      )}
    </div>
  );
}
