import type { Metadata } from "next";
import { FormPage } from "@/components/ui";
import { connectToDatabase, Category } from "@monocoupon/db";
import { StoreForm } from "../StoreForm";
import { createStore } from "../actions";

export const metadata: Metadata = { title: "New Store" };

export default async function NewStorePage() {
  await connectToDatabase();
  const categories = await Category.find({}).sort({ sortOrder: 1 }).lean();

  return (
    <FormPage backHref="/stores" backLabel="All stores" title="New store" subtitle="Creates the store's landing page.">
      <StoreForm
        action={createStore}
        submitLabel="Create Store"
        categoryOptions={categories.map((c) => ({ id: String(c._id), name: c.name }))}
      />
    </FormPage>
  );
}
