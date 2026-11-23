import type { Metadata } from "next";
import { FormPage, Thumb, ActiveBadge, Badge, siteUrl } from "@/components/ui";
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
  const couponStore = stores.find((s) => String(s._id) === String(coupon.store));

  return (
    <FormPage
      backHref="/coupons"
      backLabel="All coupons"
      title={coupon.title}
      subtitle={couponStore ? `Coupon for ${couponStore.name}` : undefined}
      media={<Thumb src={couponStore?.logo} alt={couponStore?.name ?? ""} size="lg" fit="contain" fallback={couponStore?.name ?? "C"} />}
      meta={
        <>
          <ActiveBadge active={coupon.isActive ?? true} />
          {coupon.isVerified ? <Badge tone="info" dot>Verified</Badge> : <Badge tone="warning" dot>Not verified</Badge>}
        </>
      }
      viewHref={couponStore ? siteUrl(`/stores/${couponStore.slug}`) : null}
    >
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
    </FormPage>
  );
}
