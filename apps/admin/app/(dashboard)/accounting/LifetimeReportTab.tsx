import Link from "next/link";
import { getStoreMoneySummaries, getStoreReceivables, getDailyNetByStore, getDailyTotals, sumTotals, type DailyNetPoint } from "@/lib/accounting/aggregate";
import { formatCents, formatPercent, roiPercent } from "@/lib/accounting/money";
import { StatTile } from "@/components/analytics/StatTile";
import { MoneyText } from "@/components/accounting/MoneyText";
import { NetSparkline } from "@/components/accounting/NetSparkline";

function isValidDateStr(s?: string): s is string {
  return !!s && !Number.isNaN(Date.parse(s));
}

function formatShortDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

interface LifetimeRow {
  storeId: string;
  name: string;
  spentCents: number;
  /** Revenue recognized: gross minus Returns only — a write-off does NOT reduce this (see StoreMoneySummary.earnedCents). */
  earnedCents: number;
  netCents: number;
  roi: number | null;
  recoveredCents: number;
  pendingCents: number;
  lostCents: number;
  returnedCents: number;
  realizedNetCents: number;
  realizedRoi: number | null;
}

/**
 * The full-truth lifetime view. "Earned" is revenue recognized — gross
 * minus Returns only, since a return means the sale itself was invalid. It
 * deliberately does NOT subtract Lost: a write-off is a collection problem
 * (shown via Pending/Lost), not a revenue one — you did legitimately earn
 * that money, you just won't see the cash. "Net"/"ROI" DO subtract both
 * Lost and Returned (Earned isn't their basis — see the calc below), so a
 * store you've written off, or a sale that got refunded, still stops
 * showing as profitable here the moment it's adjusted. "Realized
 * Net"/"Realized ROI" (Recovered - Spent) are the strictest, cash-only view
 * — they ignore Pending entirely, even money you still expect.
 */
function LifetimeTable({ title, rows, netByStore }: { title: string; rows: LifetimeRow[]; netByStore: Map<string, DailyNetPoint[]> }) {
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
            <th className="p-3 text-right">Recovered</th>
            <th className="p-3 text-right">Pending</th>
            <th className="p-3 text-right">Lost</th>
            <th className="p-3 text-right">Returned</th>
            <th className="p-3 text-right">Realized Net</th>
            <th className="p-3 text-right">Realized ROI</th>
            <th className="p-3">Daily net trend</th>
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
              <td className="p-3 align-middle text-right tabular-nums">{formatCents(r.recoveredCents)}</td>
              <td className="p-3 align-middle text-right tabular-nums">{formatCents(r.pendingCents)}</td>
              <td className="p-3 align-middle text-right tabular-nums">{r.lostCents > 0 ? formatCents(r.lostCents) : "—"}</td>
              <td className="p-3 align-middle text-right tabular-nums">{r.returnedCents > 0 ? formatCents(r.returnedCents) : "—"}</td>
              <td className="p-3 align-middle text-right">
                <MoneyText cents={r.realizedNetCents} />
              </td>
              <td className="p-3 align-middle text-right tabular-nums">{formatPercent(r.realizedRoi)}</td>
              <td className="p-2 align-middle">
                <NetSparkline data={netByStore.get(r.storeId) ?? []} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={12} className="p-6 text-center text-text-muted">
                No entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export async function LifetimeReportTab({ searchParams }: { searchParams: { ltFrom?: string; ltTo?: string } }) {
  const { ltFrom, ltTo } = searchParams;

  const hasCustomRange = isValidDateStr(ltFrom) && isValidDateStr(ltTo);
  const range = hasCustomRange ? { $gte: new Date(`${ltFrom}T00:00:00.000Z`), $lte: new Date(`${ltTo}T23:59:59.999Z`) } : undefined;
  const label = hasCustomRange ? `${formatShortDate(ltFrom!)} – ${formatShortDate(ltTo!)}` : "Lifetime";

  const [summaries, receivables, netByStore, dailyTotals] = await Promise.all([
    getStoreMoneySummaries(range),
    getStoreReceivables(range),
    getDailyNetByStore(range),
    getDailyTotals(range),
  ]);

  const totals = sumTotals(summaries);
  const summaryByStore = new Map(summaries.map((s) => [s.storeId, s]));
  const rows: LifetimeRow[] = receivables.map((r) => {
    const spentCents = summaryByStore.get(r.storeId)?.spentCents ?? 0;
    // r.earnedCents from getStoreReceivables is the raw/gross accrued total
    // (it's already used as-is for the Pending calc there). The table's
    // "Earned" column nets it against Returns only (revenue recognition);
    // Net/ROI use a separate basis that also subtracts Lost (profitability
    // — a write-off is money you'll never collect, so it shouldn't count
    // toward how profitable a store looks).
    const netEarnedCents = r.earnedCents - r.lostCents - r.returnedCents;
    return {
      ...r,
      spentCents,
      earnedCents: r.earnedCents - r.returnedCents,
      netCents: netEarnedCents - spentCents,
      roi: roiPercent(spentCents, netEarnedCents),
      realizedNetCents: r.recoveredCents - spentCents,
      realizedRoi: roiPercent(spentCents, r.recoveredCents),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="lifetime-report" />
        <div className="flex flex-col gap-1">
          <label htmlFor="lt-from-input" className="text-xs text-text-muted">
            From
          </label>
          <input id="lt-from-input" type="date" name="ltFrom" defaultValue={ltFrom ?? ""} className="rounded-base border border-border bg-surface px-2.5 py-1.5 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lt-to-input" className="text-xs text-text-muted">
            To
          </label>
          <input id="lt-to-input" type="date" name="ltTo" defaultValue={ltTo ?? ""} className="rounded-base border border-border bg-surface px-2.5 py-1.5 text-xs" />
        </div>
        <button type="submit" className="rounded-base border border-border px-3 py-1.5 text-xs hover:bg-surface-muted">
          Apply
        </button>
        {hasCustomRange && (
          <Link href="/accounting?tab=lifetime-report" className="text-xs text-text-muted hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Spent" value={formatCents(totals.spentCents)} />
        <StatTile label="Earned" value={formatCents(totals.earnedCents)} />
        <StatTile label="Net" value={formatCents(totals.netCents)} hint={totals.netCents >= 0 ? "Profit" : "Loss"} />
        <StatTile label="ROI" value={formatPercent(totals.roi)} />
      </div>

      <div className="rounded-base border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium text-text-muted">All stores combined — {label}</p>
        <NetSparkline data={dailyTotals} fullWidth height={260} />
      </div>

      <LifetimeTable title={`Store-wise — ${label}`} rows={rows} netByStore={netByStore} />
    </div>
  );
}
