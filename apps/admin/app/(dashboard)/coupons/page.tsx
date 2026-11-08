import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase, Coupon, Store } from "@monocoupon/db";
import { deleteCoupon, markVerified } from "./actions";

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
    Coupon.find(filter).populate("store", "name slug").sort({ createdAt: -1 }).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coupons</h1>
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

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Store</th>
              <th className="p-3">Title</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const store = c.store as unknown as { name: string; slug: string } | null;
              return (
                <tr key={String(c._id)} className="border-b border-border last:border-0">
                  <td className="p-3">{store?.name ?? "—"}</td>
                  <td className="p-3 font-medium">{c.title}</td>
                  <td className="p-3 text-text-muted">{c.type === "code" ? c.code || "code" : "deal"}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={c.isActive ? "text-brand-accent" : "text-text-muted"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                      {c.isVerified ? (
                        <span className="text-xs text-text-muted">
                          Verified {c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleDateString() : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">Not verified</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-3">
                      {!c.isVerified && (
                        <form action={markVerified.bind(null, String(c._id))}>
                          <button type="submit" className="text-brand-accent hover:underline">
                            Mark verified
                          </button>
                        </form>
                      )}
                      <Link href={`/coupons/${c._id}/edit`} className="text-brand-primary hover:underline">
                        Edit
                      </Link>
                      <form action={deleteCoupon.bind(null, String(c._id))}>
                        <button type="submit" className="text-brand-secondary hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No coupons found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
