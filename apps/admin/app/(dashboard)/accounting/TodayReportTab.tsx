import Link from "next/link";
import { getStoreMoneySummaries, getDailyNetByStore, getDailyTotals, sumTotals } from "@/lib/accounting/aggregate";
import { resolveMonth } from "@/lib/accounting/period";
import { formatCents, formatPercent } from "@/lib/accounting/money";
import { StatTile } from "@/components/analytics/StatTile";
import { StorePerformanceTable } from "@/components/accounting/StorePerformanceTable";
import { NetSparkline } from "@/components/accounting/NetSparkline";

function isValidDateStr(s?: string): s is string {
  return !!s && !Number.isNaN(Date.parse(s));
}

function formatShortDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export async function TodayReportTab({ searchParams }: { searchParams: { trMonth?: string; trFrom?: string; trTo?: string } }) {
  const { trMonth, trFrom, trTo } = searchParams;
  const period = resolveMonth(trMonth);

  const hasCustomRange = isValidDateStr(trFrom) && isValidDateStr(trTo);
  const range = hasCustomRange
    ? { $gte: new Date(`${trFrom}T00:00:00.000Z`), $lte: new Date(`${trTo}T23:59:59.999Z`) }
    : { $gte: period.gte, $lte: period.lte };
  const label = hasCustomRange ? `${formatShortDate(trFrom!)} – ${formatShortDate(trTo!)}` : period.label;

  const [summaries, netByStore, dailyTotals] = await Promise.all([getStoreMoneySummaries(range), getDailyNetByStore(range), getDailyTotals(range)]);
  const totals = sumTotals(summaries);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/accounting?tab=today-report&trMonth=${period.prev}`} className="rounded-base border border-border px-2.5 py-1 text-sm hover:bg-surface-muted" aria-label="Previous month">
            ←
          </Link>
          <h2 className="text-sm font-semibold">{label}</h2>
          <Link href={`/accounting?tab=today-report&trMonth=${period.next}`} className="rounded-base border border-border px-2.5 py-1 text-sm hover:bg-surface-muted" aria-label="Next month">
            →
          </Link>
        </div>
        {!period.isCurrent && !hasCustomRange && (
          <Link href="/accounting?tab=today-report" className="text-xs text-brand-primary hover:underline">
            Back to this month
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="today-report" />
        <div className="flex flex-col gap-1">
          <label htmlFor="tr-from-input" className="text-xs text-text-muted">
            From
          </label>
          <input id="tr-from-input" type="date" name="trFrom" defaultValue={trFrom ?? ""} className="rounded-base border border-border bg-surface px-2.5 py-1.5 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tr-to-input" className="text-xs text-text-muted">
            To
          </label>
          <input id="tr-to-input" type="date" name="trTo" defaultValue={trTo ?? ""} className="rounded-base border border-border bg-surface px-2.5 py-1.5 text-xs" />
        </div>
        <button type="submit" className="rounded-base border border-border px-3 py-1.5 text-xs hover:bg-surface-muted">
          Apply
        </button>
        {hasCustomRange && (
          <Link href={trMonth ? `/accounting?tab=today-report&trMonth=${trMonth}` : "/accounting?tab=today-report"} className="text-xs text-text-muted hover:underline">
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

      <StorePerformanceTable title={`Store-wise — ${label}`} rows={summaries} netByStore={netByStore} />
    </div>
  );
}
