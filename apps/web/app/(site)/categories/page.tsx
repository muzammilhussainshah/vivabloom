import type { Metadata } from "next";
import { getAllCategories } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { CategoryTile } from "@/components/CategoryTile";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Categories", alternates: { canonical: "/categories" } };

export default async function CategoriesPage() {
  const categories = await getAllCategories();
  const totals = [
    { label: "Categories", value: categories.length },
    { label: "Stores", value: categories.reduce((n, c) => n + (c.storeCount ?? 0), 0) },
    { label: "Articles", value: categories.reduce((n, c) => n + (c.postCount ?? 0), 0) },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Categories", path: "/categories" }])} />
      <JsonLd
        data={itemListJsonLd(categories.map((c) => ({ name: c.name, path: `/category/${c.slug}` })))}
      />

      <div className="flex flex-col gap-8 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          eyebrow="Explore"
          title="Shop by Category"
          description="Every topic we cover — guides, verified deals and trusted stores, organised in one place."
          divider={false}
        />
        {categories.length > 0 && (
          <dl className="flex shrink-0 divide-x divide-border rounded-2xl border border-border bg-surface-muted py-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            {totals.map((t) => (
              <div key={t.label} className="flex flex-col gap-0.5 px-6">
                <dt className="order-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t.label}</dt>
                <dd className="order-1 font-serif text-3xl font-bold leading-none text-text">{t.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-text-muted">No categories yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, i) => (
            <CategoryTile
              key={category._id}
              index={i}
              slug={category.slug}
              name={category.name}
              description={category.description}
              image={category.image}
              storeCount={category.storeCount}
              postCount={category.postCount}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ))}
        </div>
      )}
    </div>
  );
}
