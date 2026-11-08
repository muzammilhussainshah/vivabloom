import Link from "next/link";
import { connectToDatabase, Store, AccountingEntry, AccountingSettlement } from "@monocoupon/db";
import { deleteEntry } from "./actions";
import { EntryForm, type EntryFormInitialData } from "./EntryForm";
import { ImportForm } from "./ImportForm";
import { formatCents } from "@/lib/accounting/money";
import { MoneyText } from "@/components/accounting/MoneyText";

interface EntriesSearchParams {
  enStore?: string;
  enFrom?: string;
  enTo?: string;
  editEntry?: string;
  error?: string;
}

function StatusBadge({ pendingCents, settledCents }: { pendingCents: number; settledCents: number }) {
  if (settledCents === 0) return <span className="text-xs text-text-muted">Pending</span>;
  if (pendingCents === 0) return <span className="text-xs text-brand-accent">Settled</span>;
  return <span className="text-xs" style={{ color: "#b8860b" }}>Partial</span>;
}

export async function EntriesTab({ searchParams }: { searchParams: EntriesSearchParams }) {
  const { enStore: store, enFrom: from, enTo: to, editEntry, error } = searchParams;
  await connectToDatabase();

  const stores = await Store.find({}, "name").sort({ name: 1 }).lean();
  const storeOptions = stores.map((s) => ({ id: String(s._id), name: s.name }));

  const filter: Record<string, unknown> = {};
  if (store) filter.store = store;
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) dateFilter.$lte = new Date(`${to}T23:59:59.999Z`);
    filter.date = dateFilter;
  }

  const entries = await AccountingEntry.find(filter).populate("store", "name").sort({ date: -1 }).limit(500).lean();
  const entryIds = entries.map((e) => e._id);
  const settled = entryIds.length
    ? await AccountingSettlement.aggregate([{ $match: { entry: { $in: entryIds } } }, { $group: { _id: "$entry", total: { $sum: "$amountCents" } } }])
    : [];
  const settledMap = new Map(settled.map((s) => [String(s._id), s.total as number]));

  let editInitialData: EntryFormInitialData | undefined;
  if (editEntry) {
    const entry = entries.find((e) => String(e._id) === editEntry) ?? (await AccountingEntry.findById(editEntry).lean());
    if (entry) {
      editInitialData = {
        store: String(entry.store instanceof Object && "_id" in entry.store ? entry.store._id : entry.store),
        date: entry.date.toISOString().slice(0, 10),
        spent: (entry.spentCents / 100).toFixed(2),
        earned: (entry.earnedCents / 100).toFixed(2),
        notes: entry.notes ?? "",
      };
    }
  }

  const queryString = new URLSearchParams({
    tab: "entries",
    ...(store ? { enStore: store } : {}),
    ...(from ? { enFrom: from } : {}),
    ...(to ? { enTo: to } : {}),
  }).toString();
  const returnTo = `/accounting?${queryString}`;

  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = e.date.toISOString().slice(0, 10);
    const list = grouped.get(key) ?? [];
    list.push(e);
    grouped.set(key, list);
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-base border border-brand-secondary bg-surface p-3 text-sm text-brand-secondary">{error}</p>}

      <EntryForm stores={storeOptions} initialData={editInitialData} returnTo={returnTo} isEditing={!!editInitialData} />

      <ImportForm />

      <form className="flex flex-wrap items-end gap-3 rounded-base border border-border bg-surface p-4">
        <input type="hidden" name="tab" value="entries" />
        <div className="flex flex-col gap-1">
          <label htmlFor="f-store" className="text-xs text-text-muted">
            Store
          </label>
          <select id="f-store" name="enStore" defaultValue={store ?? ""} className="rounded-base border border-border bg-surface px-3 py-2 text-sm">
            <option value="">All stores</option>
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-from" className="text-xs text-text-muted">
            From
          </label>
          <input id="f-from" type="date" name="enFrom" defaultValue={from ?? ""} className="rounded-base border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-to" className="text-xs text-text-muted">
            To
          </label>
          <input id="f-to" type="date" name="enTo" defaultValue={to ?? ""} className="rounded-base border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-base border border-border px-4 py-2 text-sm hover:bg-surface-muted">
          Filter
        </button>
        {(store || from || to) && (
          <Link href="/accounting?tab=entries" className="text-sm text-text-muted hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-col gap-4">
        {Array.from(grouped.entries()).map(([dateKey, rows]) => {
          const dayTotal = rows.reduce((acc, r) => ({ spent: acc.spent + r.spentCents, earned: acc.earned + r.earnedCents }), { spent: 0, earned: 0 });
          return (
            <div key={dateKey} className="overflow-x-auto rounded-base border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border bg-surface-muted p-3">
                <p className="text-sm font-semibold">
                  {new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
                </p>
                <p className="text-xs text-text-muted">
                  Spent {formatCents(dayTotal.spent)} · Earned {formatCents(dayTotal.earned)} ·{" "}
                  <MoneyText cents={dayTotal.earned - dayTotal.spent} />
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-text-muted">
                  <tr>
                    <th className="p-3">Store</th>
                    <th className="p-3 text-right">Spent</th>
                    <th className="p-3 text-right">Earned</th>
                    <th className="p-3 text-right">Net</th>
                    <th className="p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const storeDoc = r.store as unknown as { _id: unknown; name: string };
                    const settledCents = settledMap.get(String(r._id)) ?? 0;
                    const pendingCents = Math.max(0, r.earnedCents - settledCents);
                    return (
                      <tr key={String(r._id)} className="border-b border-border last:border-0">
                        <td className="p-3 font-medium">{storeDoc?.name ?? "—"}</td>
                        <td className="p-3 text-right tabular-nums">{formatCents(r.spentCents)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCents(r.earnedCents)}</td>
                        <td className="p-3 text-right">
                          <MoneyText cents={r.earnedCents - r.spentCents} />
                        </td>
                        <td className="p-3">
                          <StatusBadge pendingCents={pendingCents} settledCents={settledCents} />
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-3">
                            <Link href={`${returnTo}&editEntry=${r._id}`} className="text-brand-primary hover:underline">
                              Edit
                            </Link>
                            <form action={deleteEntry.bind(null, String(r._id))}>
                              <input type="hidden" name="returnTo" value={returnTo} />
                              <button type="submit" className="text-brand-secondary hover:underline">
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
        {grouped.size === 0 && <p className="p-6 text-center text-text-muted">No entries match these filters.</p>}
      </div>
    </div>
  );
}
