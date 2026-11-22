import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase, Coupon, Store } from "@monocoupon/db";
import { CouponBoard, type CouponRow, type StoreGroup } from "./CouponBoard";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

export default async function CouponsListPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeFilter } = await searchParams;
  await connectToDatabase();

  const filter = storeFilter ? { store: storeFilter } : {};
  const [coupons, stores] = await Promise.all([
    // Same order as the public store page (apps/web/lib/data.ts COUPON_ORDER),
    // so what you see here is exactly what visitors see.
    Coupon.find(filter).sort({ sortOrder: 1, isFeatured: -1, createdAt: -1 }).lean(),
    Store.find({}).sort({ name: 1 }).select("name slug logo").lean(),
  ]);

  const storeById = new Map(stores.map((s) => [String(s._id), s]));
  const groups = new Map<string, StoreGroup>();
  for (const c of coupons) {
    const storeId = String(c.store);
    const store = storeById.get(storeId);
    if (!groups.has(storeId)) {
      groups.set(storeId, {
        storeId,
        storeName: store?.name ?? "Unknown store",
        storeSlug: store?.slug ?? c.storeSlug,
        storeLogo: store?.logo ?? null,
        coupons: [],
      });
    }
    const row: CouponRow = {
      id: String(c._id),
      title: c.title,
      description: c.description ?? "",
      type: c.type as "code" | "deal",
      code: c.code ?? null,
      discountType: (c.discountType ?? "other") as CouponRow["discountType"],
      discountValue: c.discountValue ?? null,
      expiryDate: c.expiryDate ? new Date(c.expiryDate).toISOString() : null,
      isActive: Boolean(c.isActive),
      isVerified: Boolean(c.isVerified),
      isFeatured: Boolean(c.isFeatured),
      isExclusive: Boolean(c.isExclusive),
      lastCheckedAt: c.lastCheckedAt ? new Date(c.lastCheckedAt).toISOString() : null,
      clicks: c.clicks ?? 0,
      views: c.views ?? 0,
      countries: (c.i18n ?? []).map((e) => e.country.toUpperCase()),
      hasAffiliateUrl: Boolean(c.affiliateUrl),
    };
    groups.get(storeId)!.coupons.push(row);
  }
  const storeGroups = [...groups.values()].sort((a, b) => a.storeName.localeCompare(b.storeName));

  const total = coupons.length;
  const active = coupons.filter((c) => c.isActive).length;
  const unverified = coupons.filter((c) => !c.isVerified).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Coupons</h1>
          <p className="mt-1 text-sm text-text-muted">
            {total} total · {active} active · {unverified} not verified
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/coupons/bulk-new"
            className="rounded-base border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Bulk Create
          </Link>
          <Link
            href="/coupons/new"
            className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
          >
            New Coupon
          </Link>
        </div>
      </div>

      <form className="flex gap-2">
        <select
          name="store"
          defaultValue={storeFilter ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={String(s._id)} value={String(s._id)}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-base border border-border px-4 py-2 text-sm hover:bg-surface-muted">
          Filter
        </button>
      </form>

      {storeGroups.length === 0 ? (
        <div className="rounded-base border border-border bg-surface p-10 text-center text-sm text-text-muted">
          No coupons found.
        </div>
      ) : (
        <CouponBoard groups={storeGroups} webUrl={process.env.WEB_APP_URL?.split(",").map((u) => u.trim()).filter(Boolean).at(-1) ?? null} />
      )}
    </div>
  );
}
