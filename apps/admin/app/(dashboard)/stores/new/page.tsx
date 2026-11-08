import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, Category } from "@monocoupon/db";
import { StoreForm } from "../StoreForm";
import { createStore } from "../actions";

export const metadata: Metadata = { title: "New Store" };

export default async function NewStorePage() {
  await connectToDatabase();
  const categories = await Category.find({}).sort({ sortOrder: 1 }).lean();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/stores" className="text-sm text-brand-primary hover:underline">
        ← All stores
      </Link>
      <h1 className="text-2xl font-semibold">New Store</h1>
      <StoreForm
        action={createStore}
        submitLabel="Create Store"
        categoryOptions={categories.map((c) => ({ id: String(c._id), name: c.name }))}
      />
    </div>
  );
}
