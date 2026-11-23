import type { Metadata } from "next";
import { FormPage } from "@/components/ui";
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
    <FormPage backHref="/blog" backLabel="All posts" title="New blog post" subtitle="Write or generate a new article." width="lg">
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
    </FormPage>
  );
}
