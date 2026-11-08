import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, Store } from "@monocoupon/db";
import { CouponForm } from "../CouponForm";
import { createCoupon } from "../actions";

export const metadata: Metadata = { title: "New Coupon" };

export default async function NewCouponPage() {
  await connectToDatabase();
  const stores = await Store.find({}).sort({ name: 1 }).lean();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/coupons" className="text-sm text-brand-primary hover:underline">
        ← All coupons
      </Link>
      <h1 className="text-2xl font-semibold">New Coupon</h1>
      <CouponForm
        action={createCoupon}
        submitLabel="Create Coupon"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
      />
    </div>
  );
}
