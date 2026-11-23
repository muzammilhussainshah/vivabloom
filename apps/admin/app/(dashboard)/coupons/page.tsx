import type { Metadata } from "next";
import { Badge, ButtonLink, EmptyState, PageHeader, PageShell, PlusIcon, Toolbar, siteUrl } from "@/components/ui";
import { AutoSubmitSelect, ClearFilters } from "@/components/ui/client";
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
    <PageShell>
      <PageHeader
        title="Coupons"
        count={total}
        description="Drag coupons within a store to set the order visitors see on its page."
        actions={
          <>
            <ButtonLink href="/coupons/bulk-new" variant="secondary">
              Bulk create
            </ButtonLink>
            <ButtonLink href="/coupons/new">
              <PlusIcon />
              New coupon
            </ButtonLink>
          </>
        }
      />

      <Toolbar
        summary={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="success" dot>
              {active} active
            </Badge>
            <Badge tone={unverified > 0 ? "warning" : "neutral"} dot>
              {unverified} not verified
            </Badge>
          </span>
        }
      >
        <form className="flex flex-wrap items-center gap-2">
          <AutoSubmitSelect name="store" defaultValue={storeFilter ?? ""} aria-label="Filter by store">
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={String(s._id)} value={String(s._id)}>
                {s.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <ClearFilters href="/coupons" active={Boolean(storeFilter)} />
        </form>
      </Toolbar>

      {storeGroups.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white">
          <EmptyState
            title={storeFilter ? "No coupons for this store" : "No coupons yet"}
            description="Add a coupon to show it on the store page."
            action={
              <ButtonLink href="/coupons/new">
                <PlusIcon />
                New coupon
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <CouponBoard groups={storeGroups} webUrl={siteUrl("")} />
      )}
    </PageShell>
  );
}
