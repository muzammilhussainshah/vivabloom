import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, Store } from "@monocoupon/db";
import { BulkCouponForm } from "./BulkCouponForm";
import { createBulkCoupons } from "../actions";

export const metadata: Metadata = { title: "Bulk Create Coupons" };

export default async function BulkNewCouponPage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/coupons" className="text-sm text-brand-primary hover:underline">
        ← All coupons
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Bulk Create Coupons</h1>
        <p className="mt-1 text-sm text-text-muted">
          Pick a store, tweak the titles if needed, and create its usual set of coupons in one go — they all share the
          same code/URL below.
        </p>
      </div>
      <BulkCouponForm
        action={createBulkCoupons}
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </div>
  );
}
