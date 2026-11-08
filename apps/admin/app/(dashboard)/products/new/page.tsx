import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, Store } from "@monocoupon/db";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";

export const metadata: Metadata = { title: "New Product" };

export default async function NewProductPage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/products" className="text-sm text-brand-primary hover:underline">
        ← All products
      </Link>
      <h1 className="text-2xl font-semibold">New Product</h1>
      <ProductForm
        action={createProduct}
        submitLabel="Create Product"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </div>
  );
}
