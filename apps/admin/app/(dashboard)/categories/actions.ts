"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectToDatabase, Category } from "@monocoupon/db";
import { categorySchema } from "@monocoupon/validation";
import { revalidateWebPaths } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    icon: formData.get("icon") || null,
    image: formData.get("image") || null,
    seoTitle: formData.get("seoTitle") || null,
    seoDescription: formData.get("seoDescription") || null,
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export async function createCategory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const existing = await Category.findOne({ slug: parsed.data.slug });
  if (existing) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const category = await Category.create(parsed.data);
  await logAudit("category.create", { entityType: "Category", entityId: String(category._id) });

  revalidatePath("/categories");
  await revalidateWebPaths(["/categories", "/", "/blog", "/sitemap.xml"]);
  redirect("/categories");
}

export async function updateCategory(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const slugTaken = await Category.findOne({ slug: parsed.data.slug, _id: { $ne: id } });
  if (slugTaken) {
    return { error: `Slug "${parsed.data.slug}" is already in use.` };
  }

  const category = await Category.findById(id);
  if (!category) {
    return { error: "Category not found." };
  }
  const oldSlug = category.slug;

  Object.assign(category, parsed.data);
  await category.save();
  await logAudit("category.update", { entityType: "Category", entityId: id });

  revalidatePath("/categories");
  const paths = ["/categories", "/", "/blog", "/sitemap.xml", `/category/${parsed.data.slug}`];
  if (oldSlug !== parsed.data.slug) paths.push(`/category/${oldSlug}`);
  await revalidateWebPaths(paths);
  redirect("/categories");
}

export async function deleteCategory(id: string) {
  await connectToDatabase();
  const category = await Category.findByIdAndDelete(id);

  revalidatePath("/categories");
  if (category) {
    await logAudit("category.delete", { entityType: "Category", entityId: id });
    await revalidateWebPaths(["/categories", "/", "/blog", "/sitemap.xml", `/category/${category.slug}`]);
  }
  redirect("/categories");
}
