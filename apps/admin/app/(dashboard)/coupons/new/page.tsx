import type { Metadata } from "next";
import { FormPage } from "@/components/ui";
import { connectToDatabase, Store } from "@monocoupon/db";
import { CouponForm } from "../CouponForm";
import { createCoupon } from "../actions";

export const metadata: Metadata = { title: "New Coupon" };

export default async function NewCouponPage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <FormPage backHref="/coupons" backLabel="All coupons" title="New coupon" subtitle="Add a code or deal to a store's page.">
      <CouponForm
        action={createCoupon}
        submitLabel="Create Coupon"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </FormPage>
  );
}
