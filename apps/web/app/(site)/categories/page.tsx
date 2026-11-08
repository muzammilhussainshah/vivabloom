import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getAllCategories, type CategoryCard } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { tintForSlug, tintGradient } from "@/lib/categoryTint";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 sm:px-8">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Categories", path: "/categories" }])} />
      <JsonLd
        data={itemListJsonLd(categories.map((c) => ({ name: c.name, path: `/category/${c.slug}` })))}
      />
      <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">Shop by Category</h1>
      {categories.length === 0 ? (
        <p className="text-sm text-text-muted">No categories yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((category) => {
            // A real category.image photo always sits under a dark overlay, so
            // white text stays correct there — the ink override only matters
            // for the gradient-tile fallback, where the gold tint is too
            // light for white text to read well.
            const ink = category.image ? "#fff" : tintForSlug(category.slug).ink;
            return (
              <Link
                key={category._id}
                href={`/category/${category.slug}`}
                className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-base p-4"
                style={category.image ? undefined : { background: tintGradient(category.slug) }}
              >
                {category.image && (
                  <>
                    <Image
                      src={category.image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                  </>
                )}
                <span className="relative font-serif text-lg font-bold" style={{ color: ink }}>
                  {category.name}
                </span>
                <span className="relative text-xs opacity-80" style={{ color: ink }}>
                  {countsLabel(category)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
