/** Parses a "YYYY-MM" param into UTC month bounds, defaulting to the current month for anything missing/malformed. */
export function resolveMonth(monthParam?: string): { year: number; month: number; label: string; gte: Date; lte: Date; prev: string; next: string; isCurrent: boolean } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed

  const match = monthParam?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]) - 1;
  }

  const gte = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const lte = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const label = gte.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const prevDate = new Date(Date.UTC(year, month - 1, 1));
  const nextDate = new Date(Date.UTC(year, month + 1, 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  const isCurrent = year === now.getUTCFullYear() && month === now.getUTCMonth();

  return { year, month, label, gte, lte, prev: fmt(prevDate), next: fmt(nextDate), isCurrent };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a "YYYY-MM-DD" param into UTC day bounds, defaulting to today for anything missing/malformed. */
export function resolveDay(dateParam?: string): { dateStr: string; label: string; gte: Date; lte: Date; prev: string; next: string; isToday: boolean } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const isValid = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(Date.parse(dateParam));
  const gte = isValid ? new Date(`${dateParam}T00:00:00.000Z`) : today;
  const lte = new Date(gte.getTime() + DAY_MS - 1);

  const dateStr = gte.toISOString().slice(0, 10);
  const label = gte.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const prev = new Date(gte.getTime() - DAY_MS).toISOString().slice(0, 10);
  const next = new Date(gte.getTime() + DAY_MS).toISOString().slice(0, 10);
  const isToday = dateStr === today.toISOString().slice(0, 10);

  return { dateStr, label, gte, lte, prev, next, isToday };
}
