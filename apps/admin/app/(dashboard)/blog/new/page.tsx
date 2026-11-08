import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, Category, Store, Product } from "@monocoupon/db";
import { BLOG_COUNTRIES } from "@monocoupon/validation";
import { BlogPostForm } from "../BlogPostForm";
import { createBlogPost } from "../actions";

export const metadata: Metadata = { title: "New Blog Post" };

export default async function NewBlogPostPage() {
  await connectToDatabase();
  const [categories, stores, products] = await Promise.all([
    Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
    Product.find({}).sort({ name: 1 }).lean(),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/blog" className="text-sm text-brand-primary hover:underline">
        ← All posts
      </Link>
      <h1 className="text-2xl font-semibold">New Blog Post</h1>
      <BlogPostForm
        action={createBlogPost}
        submitLabel="Create Post"
        categoryOptions={categories.map((c) => ({ id: String(c._id), name: c.name }))}
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
        productOptions={products.map((p) => ({
          id: String(p._id),
          name: p.name,
          price: p.price,
          productUrl: p.productUrl,
          storeId: String(p.store),
        }))}
        countryOptions={BLOG_COUNTRIES.map((c) => ({ code: c.code, name: c.name }))}
      />
    </div>
  );
}
