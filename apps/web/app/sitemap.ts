import type { MetadataRoute } from "next";
import { connectToDatabase, Store, Category, BlogPost, Product, Bundle } from "@monocoupon/db";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connectToDatabase();

  const [stores, categories, posts, products, bundles] = await Promise.all([
    Store.find({ isActive: true }, "slug updatedAt").lean(),
    Category.find({ isActive: true }, "slug updatedAt").lean(),
    BlogPost.find({ status: "published" }, "slug updatedAt").lean(),
    Product.find({ isActive: true }, "slug updatedAt").lean(),
    Bundle.find({ isActive: true }, "slug updatedAt").lean(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/stores`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/cookie-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const storeRoutes: MetadataRoute.Sitemap = stores.map((s) => ({
    url: `${SITE_URL}/stores/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  // Categories now cover both stores and blog posts, so /category/[slug] is
  // the only category route — the old separate /blog/category/[slug] routes
  // are gone.
  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/category/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const blogRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Bundles share the /products/[slug] URL space with products (a bundle is
  // presented as "just another product" there), so both feed the same route.
  const productRoutes: MetadataRoute.Sitemap = [...products, ...bundles].map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...storeRoutes, ...categoryRoutes, ...blogRoutes, ...productRoutes];
}
