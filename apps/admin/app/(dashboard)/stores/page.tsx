import type { Metadata } from "next";
import { connectToDatabase, Product, Store } from "@monocoupon/db";
import { deleteStore } from "./actions";
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
  RowActions,
  TableCard,
  Thumb,
  Toolbar,
  ViewAction,
  siteUrl,
  table,
} from "@/components/ui";
import { ClearFilters, DeleteButton, SearchField } from "@/components/ui/client";

export const metadata: Metadata = { title: "Stores" };
export const dynamic = "force-dynamic";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function StoresListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await connectToDatabase();

  const filter = q ? { name: { $regex: escapeRegex(q), $options: "i" } } : {};
  const [stores, total, productCounts] = await Promise.all([
    Store.find(filter).populate("categories", "name").sort({ isFeatured: -1, sortOrder: 1, name: 1 }).lean(),
    Store.estimatedDocumentCount(),
    Product.aggregate<{ _id: unknown; count: number }>([{ $group: { _id: "$store", count: { $sum: 1 } } }]),
  ]);
  const productsByStore = new Map(productCounts.map((r) => [String(r._id), r.count]));
  const activeCount = stores.filter((s) => s.isActive).length;

  return (
    <PageShell>
      <PageHeader
        title="Stores"
        count={total}
        description="Every store with its own landing page. Featured stores are listed first."
        actions={
          <ButtonLink href="/stores/new">
            <PlusIcon />
            New store
          </ButtonLink>
        }
      />

      <Toolbar summary={`${stores.length} shown · ${activeCount} active`}>
        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchField name="q" defaultValue={q} placeholder="Search stores by name…" clearHref="/stores" />
          <ClearFilters href="/stores" active={Boolean(q)} />
        </form>
      </Toolbar>

      <TableCard>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Store</th>
            <th className={table.th}>Categories</th>
            <th className={table.thRight}>Coupons</th>
            <th className={table.thRight}>Products</th>
            <th className={table.thRight}>Sort</th>
            <th className={table.th}>Status</th>
            <th className={table.thRight}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => {
            const id = String(s._id);
            const categories = (s.categories as unknown as { _id: unknown; name: string }[] | undefined) ?? [];
            return (
              <tr key={id} className={table.tr}>
                <td className={`${table.td} max-w-[340px]`}>
                  <ItemCell
                    href={`/stores/${id}/edit`}
                    title={s.name}
                    subtitle={
                      <span className="flex items-center gap-2">
                        <span>/stores/{s.slug}</span>
                        {s.isFeatured && <Badge tone="warning">★ Featured</Badge>}
                      </span>
                    }
                    thumb={<Thumb src={s.logo} alt={s.name} fit="contain" fallback={s.name} />}
                  />
                </td>
                <td className={table.td}>
                  {categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c) => (
                        <Badge key={String(c._id)}>{c.name}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className={`${table.tdRight} font-semibold`}>{s.stats?.totalCoupons ?? 0}</td>
                <td className={`${table.tdRight} font-semibold`}>{productsByStore.get(id) ?? 0}</td>
                <td className={`${table.tdRight} text-text-muted`}>{s.sortOrder ?? 0}</td>
                <td className={table.td}>
                  <ActiveBadge active={s.isActive ?? true} />
                </td>
                <td className={table.td}>
                  <RowActions>
                    <ViewAction href={siteUrl(`/stores/${s.slug}`)} />
                    <EditAction href={`/stores/${id}/edit`} />
                    <DeleteButton action={deleteStore.bind(null, id)} itemName={s.name} itemType="store" />
                  </RowActions>
                </td>
              </tr>
            );
          })}
          {stores.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  title={q ? `No stores match “${q}”` : "No stores yet"}
                  description={q ? "Check the spelling or clear the search." : "Add a store to create its landing page."}
                  action={
                    <ButtonLink href="/stores/new">
                      <PlusIcon />
                      New store
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
