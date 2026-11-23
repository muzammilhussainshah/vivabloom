import type { Metadata } from "next";
import { FormPage } from "@/components/ui";
import { connectToDatabase, Store } from "@monocoupon/db";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";

export const metadata: Metadata = { title: "New Product" };

export default async function NewProductPage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <FormPage backHref="/products" backLabel="All products" title="New product" subtitle="Add a product to a store's “Shop with this deal” strip.">
      <ProductForm
        action={createProduct}
        submitLabel="Create Product"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </FormPage>
  );
}
