import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllCategorySlugs, getCategoryDetail } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { BlogCard } from "@/components/BlogCard";
import { ProductCard } from "@/components/ProductCard";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

export const revalidate = 600;

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryDetail(slug);
  if (!data) return { title: "Category not found" };
  return {
    title: `${data.category.name} Coupons, Deals & Articles`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCategoryDetail(slug);
  if (!data) notFound();
  const { category, stores, posts, products } = data;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 sm:px-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
          { name: category.name, path: `/category/${category.slug}` },
        ])}
      />
      {stores.length > 0 && (
        <JsonLd data={itemListJsonLd(stores.map((s) => ({ name: s.name, path: `/stores/${s.slug}` })))} />
      )}
      {posts.length > 0 && (
        <JsonLd data={itemListJsonLd(posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` })))} />
      )}
      <Link href="/categories" className="text-sm text-brand-primary hover:underline">
        ← All categories
      </Link>
      <div>
        <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">{category.name}</h1>
        {category.description && <p className="mt-1 text-text-muted">{category.description}</p>}
      </div>

      {products.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl font-bold">{category.name} Products</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {products.map((product, i) => (
              <ProductCard key={product._id} product={product} priority={i < 4} />
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl font-bold">{category.name} Articles</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post._id} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
