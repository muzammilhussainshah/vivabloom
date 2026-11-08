import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connectToDatabase, Coupon, Store } from "@monocoupon/db";
import { CouponForm } from "../../CouponForm";
import { updateCoupon } from "../../actions";

export const metadata: Metadata = { title: "Edit Coupon" };

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const [coupon, stores] = await Promise.all([
    Coupon.findById(id).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
  ]);
  if (!coupon) notFound();

  const action = updateCoupon.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/coupons" className="text-sm text-brand-primary hover:underline">
        ← All coupons
      </Link>
      <h1 className="text-2xl font-semibold">Edit Coupon</h1>
      <CouponForm
        action={action}
        submitLabel="Save Changes"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
        initialData={{
          store: String(coupon.store),
          title: coupon.title,
          description: coupon.description,
          code: coupon.code,
          type: coupon.type,
          discountType: coupon.discountType ?? "other",
          discountValue: coupon.discountValue,
          merchantUrl: coupon.merchantUrl,
          affiliateUrl: coupon.affiliateUrl,
          startDate: coupon.startDate ? coupon.startDate.toISOString() : null,
          expiryDate: coupon.expiryDate ? coupon.expiryDate.toISOString() : null,
          isActive: coupon.isActive ?? true,
          isExclusive: coupon.isExclusive ?? false,
          isVerified: coupon.isVerified ?? false,
          isFeatured: coupon.isFeatured ?? false,
          sortOrder: coupon.sortOrder ?? 0,
        }}
      />
    </div>
  );
}
