import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, Store } from "@monocoupon/db";
import { BundleForm } from "../BundleForm";
import { createBundle } from "../actions";

export const metadata: Metadata = { title: "New Bundle" };

export default async function NewBundlePage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/bundles" className="text-sm text-brand-primary hover:underline">
        ← All bundles
      </Link>
      <h1 className="text-2xl font-semibold">New Bundle</h1>
      <BundleForm
        action={createBundle}
        submitLabel="Create Bundle"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </div>
  );
}
