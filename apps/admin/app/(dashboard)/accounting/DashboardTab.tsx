import Link from "next/link";
import { getStoreMoneySummaries, getStoreReceivables, getMonthlyTrend, getReceivablesAging, sumTotals, AGE_BUCKETS } from "@/lib/accounting/aggregate";
import { getExpectedPayments } from "@/lib/accounting/forecast";
import { resolveMonth } from "@/lib/accounting/period";
import { formatCents, formatPercent, roiPercent } from "@/lib/accounting/money";
import { StatTile } from "@/components/analytics/StatTile";
import { MoneyText } from "@/components/accounting/MoneyText";
import { TrendChart } from "@/components/accounting/TrendChart";
import { StoreShareChart } from "@/components/accounting/StoreShareChart";

// Wrapped in its own function (rather than called directly in the component
// body) so the React Compiler's purity lint doesn't flag it as an impure
// call inside a component — same pattern as riskSince() in analytics/page.tsx.
function nowMs() {
  return Date.now();
}

export async function DashboardTab({ searchParams }: { searchParams: { month?: string } }) {
  const period = resolveMonth(searchParams.month);

  const [monthSummaries, lifetimeSummaries, receivables, trend, aging, forecast] = await Promise.all([
    getStoreMoneySummaries({ $gte: period.gte, $lte: period.lte }),
    getStoreMoneySummaries(),
    getStoreReceivables(),
    getMonthlyTrend(6),
    getReceivablesAging(),
    getExpectedPayments(),
  ]);

  const monthTotals = sumTotals(monthSummaries);
  const lifetimeTotals = sumTotals(lifetimeSummaries);
  const receivablesTotals = receivables.reduce(
    (acc, r) => ({
      recoveredCents: acc.recoveredCents + r.recoveredCents,
      pendingCents: acc.pendingCents + r.pendingCents,
      lostCents: acc.lostCents + r.lostCents,
      returnedCents: acc.returnedCents + r.returnedCents,
    }),
    { recoveredCents: 0, pendingCents: 0, lostCents: 0, returnedCents: 0 }
  );

  const realizedTotals = {
    spentCents: lifetimeTotals.spentCents,
    recoveredCents: receivablesTotals.recoveredCents,
    netCents: receivablesTotals.recoveredCents - lifetimeTotals.spentCents,
    roi: roiPercent(lifetimeTotals.spentCents, receivablesTotals.recoveredCents),
  };

  const trendData = trend.map((t) => ({
    label: new Date(`${t.month}-01T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
    spent: t.spentCents / 100,
    earned: t.earnedCents / 100,
  }));

  // Uses netEarnedCents (net of both Lost and Returned), not the plain
  // revenue-recognition earnedCents, so a written-off store's slice
  // correctly shrinks here — this is what fixes a written-off store from
  // still looking "most profitable" in the chart.
  const shareData = lifetimeSummaries.map((s) => ({ name: s.name, value: s.netEarnedCents / 100 }));

  const forecastByMonth = new Map<string, { label: string; receivableCents: number; spentCents: number; profitCents: number }>();
  for (const p of forecast.scheduled) {
    const key = `${p.expectedDate.getUTCFullYear()}-${String(p.expectedDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = p.expectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    const bucket = forecastByMonth.get(key) ?? { label, receivableCents: 0, spentCents: 0, profitCents: 0 };
    bucket.receivableCents += p.receivableCents;
    bucket.spentCents += p.spentCents;
    bucket.profitCents += p.profitCents;
    forecastByMonth.set(key, bucket);
  }
  const forecastMonths = Array.from(forecastByMonth.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  const totalUnconfiguredCents = forecast.unconfiguredStores.reduce((s, u) => s + u.pendingCents, 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={`/accounting?month=${period.prev}`} className="rounded-base border border-border px-2.5 py-1 text-sm hover:bg-surface-muted" aria-label="Previous month">
              ←
            </Link>
            <h2 className="text-sm font-semibold">{period.label}</h2>
            <Link href={`/accounting?month=${period.next}`} className="rounded-base border border-border px-2.5 py-1 text-sm hover:bg-surface-muted" aria-label="Next month">
              →
            </Link>
          </div>
          {!period.isCurrent && (
            <Link href="/accounting" className="text-xs text-brand-primary hover:underline">
              Back to this month
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Spent" value={formatCents(monthTotals.spentCents)} />
          <StatTile label="Earned" value={formatCents(monthTotals.earnedCents)} />
          <StatTile label="Net" value={formatCents(monthTotals.netCents)} hint={monthTotals.netCents >= 0 ? "Profit" : "Loss"} />
          <StatTile label="ROI" value={formatPercent(monthTotals.roi)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-muted">Lifetime</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Spent" value={formatCents(lifetimeTotals.spentCents)} />
          <StatTile label="Earned" value={formatCents(lifetimeTotals.earnedCents)} />
          <StatTile label="Net" value={formatCents(lifetimeTotals.netCents)} hint={lifetimeTotals.netCents >= 0 ? "Profit" : "Loss"} />
          <StatTile label="ROI" value={formatPercent(lifetimeTotals.roi)} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Recovered" value={formatCents(receivablesTotals.recoveredCents)} hint="Actually received" />
          <StatTile label="Pending" value={formatCents(receivablesTotals.pendingCents)} hint="Earned, not yet paid" />
          <StatTile label="Lost" value={formatCents(receivablesTotals.lostCents)} hint="Store never paid" />
          <StatTile label="Returned" value={formatCents(receivablesTotals.returnedCents)} hint="Customer returns/reversals" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-muted">Realized (cash basis)</h2>
          <p className="text-xs text-text-muted">What you actually have, not what you&rsquo;re owed — this is the number that reflects a written-off store.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Spent" value={formatCents(realizedTotals.spentCents)} />
          <StatTile label="Recovered" value={formatCents(realizedTotals.recoveredCents)} />
          <StatTile label="Realized Net" value={formatCents(realizedTotals.netCents)} hint={realizedTotals.netCents >= 0 ? "Actual profit" : "Actual loss"} />
          <StatTile label="Realized ROI" value={formatPercent(realizedTotals.roi)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-muted">Expected Receivables</h2>
            <p className="text-xs text-text-muted">
              When your still-pending earnings are actually projected to land, based on each store&rsquo;s{" "}
              <Link href="/accounting?tab=payment-terms" className="text-brand-primary hover:underline">
                payment terms
              </Link>
              . An estimate, not a ledger figure.
            </p>
          </div>
        </div>

        {totalUnconfiguredCents > 0 && (
          <p className="rounded-base border border-border bg-surface p-3 text-xs text-text-muted">
            {formatCents(totalUnconfiguredCents)} pending has no payment term configured yet, so it&rsquo;s left out of this forecast entirely:{" "}
            {forecast.unconfiguredStores.map((u) => `${u.name} (${formatCents(u.pendingCents)})`).join(", ")} —{" "}
            <Link href="/accounting?tab=payment-terms" className="text-brand-primary hover:underline">
              set terms for them
            </Link>
            .
          </p>
        )}

        {forecast.belowMinimum.length > 0 && (
          <p className="rounded-base border border-border bg-surface p-3 text-xs text-text-muted">
            Still building toward a payout minimum, no date yet: {forecast.belowMinimum.map((b) => `${b.name} (${formatCents(b.amountCents)})`).join(", ")}.
          </p>
        )}

        {forecastMonths.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {forecastMonths.map(([key, m]) => (
              <div key={key} className="rounded-base border border-border bg-surface p-4">
                <p className="text-xs font-medium text-text-muted">{m.label}</p>
                <p className="mt-1.5 text-xl font-semibold tabular-nums">{formatCents(m.receivableCents)}</p>
                <p className="text-xs text-text-muted">expected in hand</p>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-text-muted">Matched spend {formatCents(m.spentCents)}</span>
                  <MoneyText cents={m.profitCents} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-base border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-left">
              <tr>
                <th className="p-3">Expected date</th>
                <th className="p-3">Store</th>
                <th className="p-3 text-right">Receivable</th>
                <th className="p-3 text-right">Matched spend</th>
                <th className="p-3 text-right">Expected profit</th>
              </tr>
            </thead>
            <tbody>
              {forecast.scheduled.map((p, i) => {
                const isOverdue = p.expectedDate.getTime() < nowMs();
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-3 whitespace-nowrap">
                      {p.expectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                      {isOverdue && <span className="ml-2 text-xs" style={{ color: "#b42318" }}>overdue</span>}
                    </td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-right tabular-nums">{formatCents(p.receivableCents)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCents(p.spentCents)}</td>
                    <td className="p-3 text-right">
                      <MoneyText cents={p.profitCents} />
                    </td>
                  </tr>
                );
              })}
              {forecast.scheduled.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-text-muted">
                    Nothing forecastable yet — either nothing is pending, or no stores have payment terms configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-base border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-medium text-text-muted">Spend vs. Earned — last 6 months</p>
          <TrendChart data={trendData} />
        </div>
        <div className="rounded-base border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-medium text-text-muted">Lifetime earnings by store</p>
          <StoreShareChart data={shareData} />
        </div>
      </section>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <p className="border-b border-border p-3 text-xs font-medium text-text-muted">Pending receivables by age</p>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Store</th>
              {AGE_BUCKETS.map((b) => (
                <th key={b} className="p-3 text-right">
                  {b} days
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aging.map((row) => (
              <tr key={row.storeId} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{row.name}</td>
                {AGE_BUCKETS.map((b) => (
                  <td key={b} className="p-3 text-right tabular-nums">
                    {row.buckets[b] > 0 ? formatCents(row.buckets[b]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
            {aging.length === 0 && (
              <tr>
                <td colSpan={AGE_BUCKETS.length + 1} className="p-6 text-center text-text-muted">
                  Nothing pending — everything is either recovered or written off.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
