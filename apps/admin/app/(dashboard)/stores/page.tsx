import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase, Store } from "@monocoupon/db";
import { deleteStore } from "./actions";

export const metadata: Metadata = { title: "Stores" };
export const dynamic = "force-dynamic";

export default async function StoresListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await connectToDatabase();

  const filter = q ? { name: { $regex: q, $options: "i" } } : {};
  const stores = await Store.find(filter)
    .populate("categories", "name")
    .sort({ isFeatured: -1, sortOrder: 1, name: 1 })
    .lean();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stores</h1>
        <Link
          href="/stores/new"
          className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          New Store
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search stores by name…"
          className="w-full max-w-sm rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        <button type="submit" className="rounded-base border border-border px-4 py-2 text-sm hover:bg-surface-muted">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Categories</th>
              <th className="p-3">Sort</th>
              <th className="p-3">Coupons</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={String(s._id)} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">
                  {s.name}
                  {s.isFeatured && <span className="ml-2 text-xs text-brand-secondary">★ Featured</span>}
                </td>
                <td className="p-3 text-text-muted">
                  {(s.categories as unknown as { name: string }[])?.map((c) => c.name).join(", ") || "—"}
                </td>
                <td className="p-3 text-text-muted">{s.sortOrder ?? 0}</td>
                <td className="p-3">{s.stats?.totalCoupons ?? 0}</td>
                <td className="p-3">
                  {s.isActive ? (
                    <span className="text-brand-accent">Active</span>
                  ) : (
                    <span className="text-text-muted">Inactive</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link href={`/stores/${s._id}/edit`} className="text-brand-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteStore.bind(null, String(s._id))}>
                      <button type="submit" className="text-brand-secondary hover:underline">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-text-muted">
                  No stores found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
