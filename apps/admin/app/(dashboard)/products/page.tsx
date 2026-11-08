import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase, Product, Store } from "@monocoupon/db";
import { deleteProduct } from "./actions";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsListPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeFilter } = await searchParams;
  await connectToDatabase();

  const filter = storeFilter ? { store: storeFilter } : {};
  const [products, stores] = await Promise.all([
    Product.find(filter).populate("store", "name slug").sort({ createdAt: -1 }).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/products/new"
          className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          New Product
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
            {products.map((p) => {
              const store = p.store as unknown as { name: string; slug: string } | null;
              return (
                <tr key={String(p._id)} className="border-b border-border last:border-0">
                  <td className="p-3">{store?.name ?? "—"}</td>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-text-muted">
                    ${p.price.toFixed(2)}
                    {p.originalPrice && p.originalPrice > p.price && (
                      <span className="ml-2 text-xs line-through">${p.originalPrice.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={p.isActive ? "text-brand-accent" : "text-text-muted"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/products/${p._id}/edit`} className="text-brand-primary hover:underline">
                        Edit
                      </Link>
                      <form action={deleteProduct.bind(null, String(p._id))}>
                        <button type="submit" className="text-brand-secondary hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
