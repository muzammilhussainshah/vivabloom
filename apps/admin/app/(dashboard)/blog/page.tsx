import type { Metadata } from "next";
import { connectToDatabase, BlogPost, Category } from "@monocoupon/db";
import { deleteBlogPost, publishNow } from "./actions";
import {
  Badge,
  ButtonLink,
  EditAction,
  EmptyState,
  ItemCell,
  PageHeader,
  PageShell,
  PlusIcon,
  RowActions,
  Stats,
  TableCard,
  Thumb,
  Toolbar,
  ViewAction,
  formatDate,
  siteUrl,
  table,
} from "@/components/ui";
import { ActionButton, AutoSubmitSelect, ClearFilters, DeleteButton, SearchField } from "@/components/ui/client";

export const metadata: Metadata = { title: "Blog Posts" };
export const dynamic = "force-dynamic";

const STATUS_TONE = { published: "success", draft: "neutral", scheduled: "warning" } as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function BlogPostsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const { status, category: categoryFilter, q } = await searchParams;
  await connectToDatabase();

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (categoryFilter) filter.category = categoryFilter;
  if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };

  const [posts, categories, total] = await Promise.all([
    BlogPost.find(filter, "-content").populate("category", "name").sort({ createdAt: -1 }).lean(),
    Category.find({}, "name").sort({ name: 1 }).lean(),
    BlogPost.estimatedDocumentCount(),
  ]);
  const publishedCount = posts.filter((p) => p.status === "published").length;
  const hasFilters = Boolean(status || categoryFilter || q);

  return (
    <PageShell>
      <PageHeader
        title="Blog posts"
        count={total}
        description="Articles for the blog and the store pages' related reading."
        actions={
          <>
            <ButtonLink href="/categories" variant="secondary">
              Manage categories
            </ButtonLink>
            <ButtonLink href="/blog/new">
              <PlusIcon />
              New post
            </ButtonLink>
          </>
        }
      />

      <Toolbar summary={`${posts.length} shown · ${publishedCount} published`}>
        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchField name="q" defaultValue={q} placeholder="Search by title…" clearHref="/blog" />
          <AutoSubmitSelect name="status" defaultValue={status ?? ""} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
          </AutoSubmitSelect>
          <AutoSubmitSelect name="category" defaultValue={categoryFilter ?? ""} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {c.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <ClearFilters href="/blog" active={hasFilters} />
        </form>
      </Toolbar>

      <TableCard>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Post</th>
            <th className={table.th}>Category</th>
            <th className={table.th}>Status</th>
            <th className={table.th}>Date</th>
            <th className={table.thRight}>Views</th>
            <th className={table.thRight}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => {
            const id = String(p._id);
            const category = p.category as unknown as { name: string } | null;
            const tone = STATUS_TONE[p.status as keyof typeof STATUS_TONE] ?? "neutral";
            return (
              <tr key={id} className={table.tr}>
                <td className={`${table.td} max-w-[420px]`}>
                  <ItemCell
                    href={`/blog/${id}/edit`}
                    title={p.title}
                    subtitle={p.author ? `/${p.slug} · by ${p.author}` : `/${p.slug}`}
                    thumb={<Thumb src={p.coverImage} alt={p.title} size="wide" />}
                  />
                </td>
                <td className={table.td}>{category ? <Badge>{category.name}</Badge> : <span className="text-text-muted">—</span>}</td>
                <td className={table.td}>
                  <Badge tone={tone} dot>
                    <span className="capitalize">{p.status}</span>
                  </Badge>
                </td>
                <td className={`${table.td} whitespace-nowrap text-text-muted`}>
                  {formatDate(p.publishedAt) ?? "—"}
                  {p.status === "scheduled" && p.publishedAt && <div className="text-xs text-amber-700">goes live</div>}
                </td>
                <td className={table.tdRight}>
                  <Stats views={p.views} />
                </td>
                <td className={table.td}>
                  <RowActions>
                    {p.status !== "published" && (
                      <ActionButton action={publishNow.bind(null, id)} pendingLabel="Publishing…">
                        Publish now
                      </ActionButton>
                    )}
                    <ViewAction href={p.status === "published" ? siteUrl(`/blog/${p.slug}`) : null} />
                    <EditAction href={`/blog/${id}/edit`} />
                    <DeleteButton action={deleteBlogPost.bind(null, id)} itemName={p.title} itemType="post" />
                  </RowActions>
                </td>
              </tr>
            );
          })}
          {posts.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title={hasFilters ? "No posts match these filters" : "No posts yet"}
                  description={hasFilters ? "Try a different status, category or search." : "Write your first article."}
                  action={
                    <ButtonLink href="/blog/new">
                      <PlusIcon />
                      New post
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
