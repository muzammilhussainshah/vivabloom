import type { Metadata } from "next";
import { connectToDatabase, Product, Store } from "@monocoupon/db";
import { deleteProduct } from "./actions";
import {
  ActiveBadge,
  ButtonLink,
  EditAction,
  EmptyState,
  ItemCell,
  PageHeader,
  PageShell,
  PlusIcon,
  Price,
  RowActions,
  Stats,
  TableCard,
  Thumb,
  Toolbar,
  ViewAction,
  siteUrl,
  table,
} from "@/components/ui";
import { AutoSubmitSelect, ClearFilters, DeleteButton } from "@/components/ui/client";

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
  const [products, stores, total] = await Promise.all([
    Product.find(filter).populate("store", "name slug logo").sort({ createdAt: -1 }).lean(),
    Store.find({}, "name").sort({ name: 1 }).lean(),
    Product.estimatedDocumentCount(),
  ]);
  const activeCount = products.filter((p) => p.isActive).length;

  return (
    <PageShell>
      <PageHeader
        title="Products"
        count={total}
        description="Products shown in each store's “Shop with this deal” strip and on the product pages."
        actions={
          <ButtonLink href="/products/new">
            <PlusIcon />
            New product
          </ButtonLink>
        }
      />

      <Toolbar summary={`${products.length} shown · ${activeCount} active`}>
        <form className="flex flex-wrap items-center gap-2">
          <AutoSubmitSelect name="store" defaultValue={storeFilter ?? ""} aria-label="Filter by store">
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={String(s._id)} value={String(s._id)}>
                {s.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <ClearFilters href="/products" active={Boolean(storeFilter)} />
        </form>
      </Toolbar>

      <TableCard>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Product</th>
            <th className={table.th}>Store</th>
            <th className={table.thRight}>Price</th>
            <th className={table.thRight}>Performance</th>
            <th className={table.th}>Status</th>
            <th className={table.thRight}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const store = p.store as unknown as { name: string; slug: string; logo?: string | null } | null;
            const id = String(p._id);
            return (
              <tr key={id} className={table.tr}>
                <td className={`${table.td} max-w-[360px]`}>
                  <ItemCell href={`/products/${id}/edit`} title={p.name} subtitle={`/${p.slug}`} thumb={<Thumb src={p.image} alt={p.name} />} />
                </td>
                <td className={table.td}>
                  {store ? (
                    <span className="flex items-center gap-2">
                      <Thumb src={store.logo} size="sm" fit="contain" fallback={store.name} />
                      <span className="whitespace-nowrap text-text">{store.name}</span>
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className={table.tdRight}>
                  <Price price={p.price} originalPrice={p.originalPrice} />
                </td>
                <td className={table.tdRight}>
                  <Stats views={p.views} clicks={p.clicks} />
                </td>
                <td className={table.td}>
                  <ActiveBadge active={p.isActive ?? true} />
                </td>
                <td className={table.td}>
                  <RowActions>
                    <ViewAction href={siteUrl(`/products/${p.slug}`)} />
                    <EditAction href={`/products/${id}/edit`} />
                    <DeleteButton action={deleteProduct.bind(null, id)} itemName={p.name} itemType="product" />
                  </RowActions>
                </td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title={storeFilter ? "No products for this store" : "No products yet"}
                  description={storeFilter ? "Try another store, or add one." : "Add your first product to show it on the store pages."}
                  action={
                    <ButtonLink href="/products/new">
                      <PlusIcon />
                      New product
                    </ButtonLink>
                  }
                />
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </PageShell>
  );
}
