import { connectToDatabase, PaymentTerm, Store, type IPaymentTerm } from "@monocoupon/db";
import { getEntriesWithPending } from "./ledger";

const DAY_MS = 24 * 60 * 60 * 1000;

function endOfWeek(date: Date): Date {
  // The Sunday on/after `date` — weeks close Monday-through-Sunday.
  const daysToSunday = (7 - date.getUTCDay()) % 7;
  return new Date(date.getTime() + daysToSunday * DAY_MS);
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/** The closingDay-th of the month, on/after `date` — generalizes endOfMonth to a custom cutoff (e.g. 10 for a "10th-to-10th" cycle instead of a calendar month). */
function endOfCustomMonth(date: Date, closingDay: number): Date {
  const day = date.getUTCDate();
  return day <= closingDay
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), closingDay))
    : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, closingDay));
}

function nextOnOrAfterWeekday(date: Date, targetDow: number): Date {
  const diff = (targetDow - date.getUTCDay() + 7) % 7;
  return new Date(date.getTime() + diff * DAY_MS);
}

/** The date payment is expected to land, given a batch's closing date and its store's term. */
function computeExpectedDate(term: IPaymentTerm, closingDate: Date): Date {
  if (term.batchCycle === "monthly" && term.monthsOffset != null && term.payDayOfMonth != null) {
    return new Date(Date.UTC(closingDate.getUTCFullYear(), closingDate.getUTCMonth() + term.monthsOffset, term.payDayOfMonth));
  }

  const dueDate = new Date(closingDate.getTime() + (term.netDays ?? 0) * DAY_MS);

  if (term.batchCycle === "weekly" && term.payDayOfWeek != null) {
    return nextOnOrAfterWeekday(dueDate, term.payDayOfWeek);
  }

  if (term.batchCycle === "monthly" && term.payDayOfMonth != null) {
    const sameMonth = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), term.payDayOfMonth));
    return sameMonth.getTime() >= dueDate.getTime() ? sameMonth : new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, term.payDayOfMonth));
  }

  return dueDate;
}

function batchKeyFor(term: IPaymentTerm, entryDate: Date): { key: string; closingDate: Date } {
  if (term.batchCycle === "weekly") {
    const closingDate = endOfWeek(entryDate);
    return { key: closingDate.toISOString().slice(0, 10), closingDate };
  }
  if (term.batchCycle === "monthly") {
    const closingDate = term.closingDayOfMonth != null ? endOfCustomMonth(entryDate, term.closingDayOfMonth) : endOfMonth(entryDate);
    return { key: closingDate.toISOString().slice(0, 10), closingDate };
  }
  return { key: entryDate.toISOString().slice(0, 10), closingDate: entryDate };
}

export interface ExpectedPayment {
  storeId: string;
  name: string;
  expectedDate: Date;
  /** Estimate, not a ledger figure — see the note on spend-matching below. */
  receivableCents: number;
  spentCents: number;
  profitCents: number;
}

export interface ForecastResult {
  scheduled: ExpectedPayment[];
  /** Per store, pending money that exists but has no configured PaymentTerm — excluded from `scheduled` entirely so it isn't silently missing without explanation. */
  unconfiguredStores: { storeId: string; name: string; pendingCents: number }[];
  /** Per store (monthly-batch stores with a minimum only), pending money still short of that store's payout minimum — has no date yet, waiting to merge with a future batch. */
  belowMinimum: { storeId: string; name: string; amountCents: number }[];
}

/**
 * Projects every store's still-pending earnings forward to the calendar
 * date they're actually expected to be paid, per that store's PaymentTerm.
 * `spentCents`/`profitCents` are an estimate that matches each batch's ad
 * spend to the same days that produced its pending earnings — useful for
 * "what will this batch have actually cost me by the time it pays out", but
 * not a ledger-grade figure the way Spent/Recovered elsewhere are (a day
 * that's only partially recovered would have its full spend re-attributed
 * to the batch holding its remaining pending sliver).
 */
export async function getExpectedPayments(): Promise<ForecastResult> {
  await connectToDatabase();

  const [entries, terms, stores] = await Promise.all([
    getEntriesWithPending(),
    PaymentTerm.find({}).lean(),
    Store.find({}, "name").lean(),
  ]);

  const storeMap = new Map(stores.map((s) => [String(s._id), s]));
  const termByStore = new Map(terms.map((t) => [String(t.store), t]));

  const entriesByStore = new Map<string, typeof entries>();
  for (const e of entries) {
    if (e.pendingCents <= 0) continue;
    const key = String(e.store);
    const list = entriesByStore.get(key) ?? [];
    list.push(e);
    entriesByStore.set(key, list);
  }

  const scheduled: ExpectedPayment[] = [];
  const unconfiguredStores: ForecastResult["unconfiguredStores"] = [];
  const belowMinimum: ForecastResult["belowMinimum"] = [];

  for (const [storeId, storeEntries] of entriesByStore) {
    const name = storeMap.get(storeId)?.name ?? "(deleted store)";
    const term = termByStore.get(storeId);
    const pendingCents = storeEntries.reduce((s, e) => s + e.pendingCents, 0);

    if (!term) {
      unconfiguredStores.push({ storeId, name, pendingCents });
      continue;
    }

    const batches = new Map<string, { closingDate: Date; receivableCents: number; spentCents: number }>();
    for (const e of storeEntries) {
      const { key, closingDate } = batchKeyFor(term, e.date);
      const b = batches.get(key) ?? { closingDate, receivableCents: 0, spentCents: 0 };
      b.receivableCents += e.pendingCents;
      b.spentCents += e.spentCents;
      batches.set(key, b);
    }

    const sortedBatches = Array.from(batches.values()).sort((a, b) => a.closingDate.getTime() - b.closingDate.getTime());

    let carryReceivable = 0;
    let carrySpent = 0;
    for (const batch of sortedBatches) {
      const receivableCents = batch.receivableCents + carryReceivable;
      const spentCents = batch.spentCents + carrySpent;

      if (term.batchCycle === "monthly" && (term.minimumAmountCents ?? 0) > 0 && receivableCents < term.minimumAmountCents!) {
        carryReceivable = receivableCents;
        carrySpent = spentCents;
        continue;
      }

      scheduled.push({
        storeId,
        name,
        expectedDate: computeExpectedDate(term, batch.closingDate),
        receivableCents,
        spentCents,
        profitCents: receivableCents - spentCents,
      });
      carryReceivable = 0;
      carrySpent = 0;
    }

    if (carryReceivable > 0) {
      belowMinimum.push({ storeId, name, amountCents: carryReceivable });
    }
  }

  scheduled.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  return { scheduled, unconfiguredStores, belowMinimum };
}
