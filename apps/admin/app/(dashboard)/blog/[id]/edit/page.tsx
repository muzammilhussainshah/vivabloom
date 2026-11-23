import type { Metadata } from "next";
import { FormPage, Thumb, Badge, siteUrl } from "@/components/ui";
import { notFound } from "next/navigation";
import { connectToDatabase, BlogPost, Category, Store, Product } from "@monocoupon/db";
import { BLOG_COUNTRIES } from "@monocoupon/validation";
import { BlogPostForm } from "../../BlogPostForm";
import { updateBlogPost } from "../../actions";

export const metadata: Metadata = { title: "Edit Blog Post" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const [post, categories, stores, products] = await Promise.all([
    BlogPost.findById(id).lean(),
    Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
    Product.find({}).sort({ name: 1 }).lean(),
  ]);
  if (!post) notFound();

  const action = updateBlogPost.bind(null, id);

  return (
    <FormPage
      backHref="/blog"
      backLabel="All posts"
      title={post.title}
      subtitle={`/blog/${post.slug}`}
      media={<Thumb src={post.coverImage} alt={post.title} size="lgWide" />}
      meta={
        <Badge tone={post.status === "published" ? "success" : post.status === "scheduled" ? "warning" : "neutral"} dot>
          <span className="capitalize">{post.status ?? "draft"}</span>
        </Badge>
      }
      viewHref={post.status === "published" ? siteUrl(`/blog/${post.slug}`) : null}
      width="lg"
    >
      <BlogPostForm
        action={action}
        submitLabel="Save Changes"
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
        initialData={{
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverImage: post.coverImage,
          category: String(post.category),
          tags: post.tags ?? [],
          author: post.author,
          status: post.status ?? "draft",
          publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          ogImage: post.ogImage,
          relatedStoreIds: (post.relatedStores ?? []).map((s) => String(s)),
          aiTopic: post.aiTopic,
          aiProductIds: (post.aiProducts ?? []).map((p) => String(p)),
          aiCountry: post.aiCountry,
        }}
      />
    </FormPage>
  );
}
