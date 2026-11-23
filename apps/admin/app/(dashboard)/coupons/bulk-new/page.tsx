import type { Metadata } from "next";
import { FormPage } from "@/components/ui";
import { connectToDatabase, Store } from "@monocoupon/db";
import { BulkCouponForm } from "./BulkCouponForm";
import { createBulkCoupons } from "../actions";

export const metadata: Metadata = { title: "Bulk Create Coupons" };

export default async function BulkNewCouponPage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <FormPage
      backHref="/coupons"
      backLabel="All coupons"
      title="Bulk create coupons"
      subtitle="Pick a store, tweak the titles if needed, and create its usual set of coupons in one go — they all share the same code/URL below."
    >
      <BulkCouponForm
        action={createBulkCoupons}
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </FormPage>
  );
}
