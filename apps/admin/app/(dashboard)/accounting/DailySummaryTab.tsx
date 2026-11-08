import Link from "next/link";
import { getStoreMoneySummaries, sumTotals } from "@/lib/accounting/aggregate";
import { resolveDay } from "@/lib/accounting/period";
import { formatCents, formatPercent } from "@/lib/accounting/money";
import { StatTile } from "@/components/analytics/StatTile";
import { StorePerformanceTable } from "@/components/accounting/StorePerformanceTable";
import { StoreBarChart } from "@/components/accounting/StoreBarChart";
import { StoreShareChart } from "@/components/accounting/StoreShareChart";

export async function DailySummaryTab({ searchParams }: { searchParams: { date?: string } }) {
  const day = resolveDay(searchParams.date);

  const dayStoreSummaries = await getStoreMoneySummaries({ $gte: day.gte, $lte: day.lte });
  const dayTotals = sumTotals(dayStoreSummaries);

  const barData = dayStoreSummaries.map((s) => ({ name: s.name, spent: s.spentCents / 100, earned: s.earnedCents / 100 }));
  const shareData = dayStoreSummaries.map((s) => ({ name: s.name, value: s.earnedCents / 100 }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/accounting?tab=day&date=${day.prev}`}
              className="rounded-base border border-border px-2.5 py-1 text-sm hover:bg-surface-muted"
              aria-label="Previous day"
            >
              ←
            </Link>
            <h2 className="text-sm font-semibold">{day.label}</h2>
            <Link
              href={`/accounting?tab=day&date=${day.next}`}
              className="rounded-base border border-border px-2.5 py-1 text-sm hover:bg-surface-muted"
              aria-label="Next day"
            >
              →
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <form className="flex items-center gap-2">
              <input type="hidden" name="tab" value="day" />
              <input type="date" name="date" defaultValue={day.dateStr} className="rounded-base border border-border bg-surface px-2.5 py-1.5 text-sm" />
              <button type="submit" className="rounded-base border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">
                Go
              </button>
            </form>
            {!day.isToday && (
              <Link href="/accounting?tab=day" className="text-xs text-brand-primary hover:underline">
                Back to today
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Spent" value={formatCents(dayTotals.spentCents)} />
          <StatTile label="Earned" value={formatCents(dayTotals.earnedCents)} />
          <StatTile label="Net" value={formatCents(dayTotals.netCents)} hint={dayTotals.netCents >= 0 ? "Profit" : "Loss"} />
          <StatTile label="ROI" value={formatPercent(dayTotals.roi)} />
        </div>
      </section>

      {dayStoreSummaries.length > 0 ? (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-base border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-medium text-text-muted">Spent vs. Earned by store</p>
              <StoreBarChart data={barData} />
            </div>
            <div className="rounded-base border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-medium text-text-muted">Earnings share by store</p>
              <StoreShareChart data={shareData} />
            </div>
          </section>

          <StorePerformanceTable title={`Store-wise — ${day.label}`} rows={dayStoreSummaries} />
        </>
      ) : (
        <p className="rounded-base border border-border bg-surface p-6 text-center text-sm text-text-muted">
          No entries for this date —{" "}
          <Link href="/accounting?tab=entries" className="text-brand-primary hover:underline">
            add one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
