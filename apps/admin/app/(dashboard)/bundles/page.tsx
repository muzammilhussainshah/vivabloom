import type { Metadata } from "next";
import { connectToDatabase, Bundle, Store } from "@monocoupon/db";
import { deleteBundle } from "./actions";
import {
  ActiveBadge,
  Badge,
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
  const [bundles, stores, total] = await Promise.all([
    Bundle.find(filter).populate("store", "name slug logo").sort({ createdAt: -1 }).lean(),
    Store.find({}, "name").sort({ name: 1 }).lean(),
    Bundle.estimatedDocumentCount(),
  ]);
  const activeCount = bundles.filter((b) => b.isActive).length;

  return (
    <PageShell>
      <PageHeader
        title="Bundles"
        count={total}
        description="Multi-product packs shown alongside a store's deal and in the welcome-back modal."
        actions={
          <ButtonLink href="/bundles/new">
            <PlusIcon />
            New bundle
          </ButtonLink>
        }
      />

      <Toolbar summary={`${bundles.length} shown · ${activeCount} active`}>
        <form className="flex flex-wrap items-center gap-2">
          <AutoSubmitSelect name="store" defaultValue={storeFilter ?? ""} aria-label="Filter by store">
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={String(s._id)} value={String(s._id)}>
                {s.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <ClearFilters href="/bundles" active={Boolean(storeFilter)} />
        </form>
      </Toolbar>

      <TableCard>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Bundle</th>
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
          {bundles.map((b) => {
            const store = b.store as unknown as { name: string; slug: string; logo?: string | null } | null;
            const id = String(b._id);
            return (
              <tr key={id} className={table.tr}>
                <td className={`${table.td} max-w-[380px]`}>
                  <ItemCell
                    href={`/bundles/${id}/edit`}
                    title={b.name}
                    subtitle={
                      <span className="flex items-center gap-2">
                        <span>/{b.slug}</span>
                        {b.extraDiscountPercent ? <Badge tone="brand">+{b.extraDiscountPercent}% extra</Badge> : null}
                      </span>
                    }
                    thumb={<Thumb src={b.image} alt={b.name} />}
                  />
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
                  <Price price={b.price} originalPrice={b.originalPrice} />
                </td>
                <td className={table.tdRight}>
                  <Stats views={b.views} clicks={b.clicks} />
                </td>
                <td className={table.td}>
                  <ActiveBadge active={b.isActive ?? true} />
                </td>
                <td className={table.td}>
                  <RowActions>
                    <ViewAction href={siteUrl(`/products/${b.slug}`)} />
                    <EditAction href={`/bundles/${id}/edit`} />
                    <DeleteButton action={deleteBundle.bind(null, id)} itemName={b.name} itemType="bundle" />
                  </RowActions>
                </td>
              </tr>
            );
          })}
          {bundles.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title={storeFilter ? "No bundles for this store" : "No bundles yet"}
                  description={storeFilter ? "Try another store, or add one." : "Create a bundle to offer a multi-product pack."}
                  action={
                    <ButtonLink href="/bundles/new">
                      <PlusIcon />
                      New bundle
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
