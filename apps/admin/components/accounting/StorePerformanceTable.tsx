import { formatCents, formatPercent } from "@/lib/accounting/money";
import type { DailyNetPoint } from "@/lib/accounting/aggregate";
import { MoneyText } from "./MoneyText";
import { NetSparkline } from "./NetSparkline";

/** Shared Spent/Earned/Net/ROI store-wise table — used by the dashboard's Monthly/Lifetime tables (with a per-store trend column) and the Daily Summary page (without one, since a single day has no trend to show). */
export function StorePerformanceTable({
  title,
  rows,
  netByStore,
}: {
  title: string;
  rows: { storeId: string; name: string; spentCents: number; earnedCents: number; netCents: number; roi: number | null }[];
  /** Omit to render without the trend column — e.g. for a single-day view, where a trend line has nothing to show. */
  netByStore?: Map<string, DailyNetPoint[]>;
}) {
  return (
    <div className="overflow-x-auto rounded-base border border-border bg-surface">
      <p className="border-b border-border p-3 text-xs font-medium text-text-muted">{title}</p>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-muted text-left">
          <tr>
            <th className="p-3">Store</th>
            <th className="p-3 text-right">Spent</th>
            <th className="p-3 text-right">Earned</th>
            <th className="p-3 text-right">Net</th>
            <th className="p-3 text-right">ROI</th>
            {netByStore && <th className="p-3">Daily net trend</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.storeId} className="border-b border-border last:border-0">
              <td className="p-3 align-middle font-medium">{r.name}</td>
              <td className="p-3 align-middle text-right tabular-nums">{formatCents(r.spentCents)}</td>
              <td className="p-3 align-middle text-right tabular-nums">{formatCents(r.earnedCents)}</td>
              <td className="p-3 align-middle text-right">
                <MoneyText cents={r.netCents} />
              </td>
              <td className="p-3 align-middle text-right tabular-nums">{formatPercent(r.roi)}</td>
              {netByStore && (
                <td className="p-2 align-middle">
                  <NetSparkline data={netByStore.get(r.storeId) ?? []} />
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={netByStore ? 6 : 5} className="p-6 text-center text-text-muted">
                No entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
