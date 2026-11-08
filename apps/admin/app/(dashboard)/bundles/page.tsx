import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase, Bundle, Store } from "@monocoupon/db";
import { deleteBundle } from "./actions";

export const metadata: Metadata = { title: "Bundles" };
export const dynamic = "force-dynamic";

export default async function BundlesListPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeFilter } = await searchParams;
  await connectToDatabase();

  const filter = storeFilter ? { store: storeFilter } : {};
  const [bundles, stores] = await Promise.all([
    Bundle.find(filter).populate("store", "name slug").sort({ createdAt: -1 }).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bundles</h1>
        <Link
          href="/bundles/new"
          className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          New Bundle
        </Link>
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
              <th className="p-3">Name</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => {
              const store = b.store as unknown as { name: string; slug: string } | null;
              return (
                <tr key={String(b._id)} className="border-b border-border last:border-0">
                  <td className="p-3">{store?.name ?? "—"}</td>
                  <td className="p-3 font-medium">{b.name}</td>
                  <td className="p-3 text-text-muted">
                    ${b.price.toFixed(2)}
                    {b.originalPrice && b.originalPrice > b.price && (
                      <span className="ml-2 text-xs line-through">${b.originalPrice.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={b.isActive ? "text-brand-accent" : "text-text-muted"}>
                      {b.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/bundles/${b._id}/edit`} className="text-brand-primary hover:underline">
                        Edit
                      </Link>
                      <form action={deleteBundle.bind(null, String(b._id))}>
                        <button type="submit" className="text-brand-secondary hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {bundles.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No bundles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
