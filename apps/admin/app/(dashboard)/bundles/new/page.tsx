import type { Metadata } from "next";
import { FormPage } from "@/components/ui";
import { connectToDatabase, Store } from "@monocoupon/db";
import { BundleForm } from "../BundleForm";
import { createBundle } from "../actions";

export const metadata: Metadata = { title: "New Bundle" };

export default async function NewBundlePage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <FormPage backHref="/bundles" backLabel="All bundles" title="New bundle" subtitle="Create a multi-product pack for a store.">
      <BundleForm
        action={createBundle}
        submitLabel="Create Bundle"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </FormPage>
  );
}
