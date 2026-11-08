"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectToDatabase, BlogPost, BlogTopicSuggestion, Category } from "@monocoupon/db";
import { blogPostSchema } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  const relatedStores = formData.getAll("relatedStores").map(String);
  const aiProducts = formData.getAll("aiProducts").map(String);
  // Trim, drop empties, and de-dupe (case-insensitively) so the same tag can't
  // be stored twice with different spacing/casing.
  const seen = new Set<string>();
  const tags = formData
    .getAll("tags")
    .map((t) => String(t).trim())
    .filter((t) => {
      if (!t) return false;
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return blogPostSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt") ?? "",
    content: formData.get("content"),
    coverImage: formData.get("coverImage") || null,
    category: formData.get("category"),
    tags,
    author: formData.get("author") || "VivaBloom",
    status: formData.get("status") || "draft",
    publishedAt: formData.get("publishedAt") || null,
    seoTitle: formData.get("seoTitle") || null,
    seoDescription: formData.get("seoDescription") || null,
    ogImage: formData.get("ogImage") || null,
    relatedStores,
    aiTopic: formData.get("aiTopic") || null,
    aiProducts,
    aiCountry: formData.get("aiCountry") || null,
  });
}

// Once a suggested topic turns into a saved post, it shouldn't be offered
// again — pull it out of that store's (and country's) remaining suggestion batch.
async function consumeTopicSuggestion(
  relatedStores: string[],
  aiTopic: string | null | undefined,
  aiCountry: string | null | undefined
) {
  const storeId = relatedStores[0];
  if (!storeId || !aiTopic?.trim()) return;
  await BlogTopicSuggestion.updateOne(
    { store: storeId, country: aiCountry ?? null },
    { $pull: { topics: aiTopic.trim() } }
  );
}

async function pathsForPost(postSlug: string, categoryId: string) {
  await connectToDatabase();
  const category = await Category.findById(categoryId).lean();
  const paths = ["/blog", "/", "/sitemap.xml", `/blog/${postSlug}`];
  if (category) paths.push(`/category/${category.slug}`);
  return paths;
}

export async function createBlogPost(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const existing = await BlogPost.findOne({ slug: parsed.data.slug });
  if (existing) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const { publishedAt, ...rest } = parsed.data;
  const resolvedPublishedAt =
    rest.status === "published" ? new Date(publishedAt || Date.now()) : publishedAt ? new Date(publishedAt) : null;

  const post = await BlogPost.create({ ...rest, publishedAt: resolvedPublishedAt });
  await logAudit("blogPost.create", { entityType: "BlogPost", entityId: String(post._id) });
  await consumeTopicSuggestion(rest.relatedStores, rest.aiTopic, rest.aiCountry);

  revalidatePath("/blog");
  await revalidateWebPaths(await pathsForPost(parsed.data.slug, parsed.data.category));
  redirect("/blog");
}

export async function updateBlogPost(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const slugTaken = await BlogPost.findOne({ slug: parsed.data.slug, _id: { $ne: id } });
  if (slugTaken) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const post = await BlogPost.findById(id);
  if (!post) {
    return { error: "Post not found." };
  }
  const oldSlug = post.slug;
  const oldCategoryId = String(post.category);

  const { publishedAt, ...rest } = parsed.data;
  const resolvedPublishedAt =
    rest.status === "published"
      ? new Date(publishedAt || post.publishedAt || Date.now())
      : publishedAt
        ? new Date(publishedAt)
        : null;

  Object.assign(post, rest, { publishedAt: resolvedPublishedAt });
  await post.save();
  await logAudit("blogPost.update", { entityType: "BlogPost", entityId: id });
  await consumeTopicSuggestion(rest.relatedStores, rest.aiTopic, rest.aiCountry);

  revalidatePath("/blog");
  const paths = await pathsForPost(parsed.data.slug, parsed.data.category);
  if (oldSlug !== parsed.data.slug) paths.push(`/blog/${oldSlug}`);
  if (oldCategoryId !== parsed.data.category) paths.push(...(await pathsForPost(oldSlug, oldCategoryId)));
  await revalidateWebPaths(paths);
  redirect("/blog");
}

export async function deleteBlogPost(id: string) {
  await connectToDatabase();
  const post = await BlogPost.findByIdAndDelete(id);

  revalidatePath("/blog");
  if (post) {
    await logAudit("blogPost.delete", { entityType: "BlogPost", entityId: id });
    await revalidateWebPaths(await pathsForPost(post.slug, String(post.category)));
  }
  redirect("/blog");
}

export async function publishNow(id: string) {
  await connectToDatabase();
  const post = await BlogPost.findById(id);
  if (post) {
    post.status = "published";
    if (!post.publishedAt) post.publishedAt = new Date();
    await post.save();
    await logAudit("blogPost.publish", { entityType: "BlogPost", entityId: id });
  }

  revalidatePath("/blog");
  if (post) {
    await revalidateWebPaths(await pathsForPost(post.slug, String(post.category)));
  }
  redirect("/blog");
}
