/** Dollars (as typed by an admin, e.g. "12.5") -> integer cents. Rounds, never truncates, so 12.345 -> 1235 not 1234. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatCents(cents: number, options?: { sign?: boolean }): string {
  const dollars = cents / 100;
  const formatted = Math.abs(dollars).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = dollars < 0 ? "-" : options?.sign && dollars > 0 ? "+" : "";
  return `${sign}$${formatted}`;
}

/**
 * Net %(ROI) = Net / Spent * 100. Undefined when spent is 0 — there's no
 * meaningful "return" on zero investment, so this returns null rather than
 * the divide-by-zero garbage a spreadsheet would silently produce (e.g.
 * "1724.00%"). Callers render null as "—".
 */
export function roiPercent(spentCents: number, earnedCents: number): number | null {
  if (spentCents === 0) return null;
  return ((earnedCents - spentCents) / spentCents) * 100;
}

export function formatPercent(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
