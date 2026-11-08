import type { PipelineStage } from "mongoose";
import { connectToDatabase, AccountingEntry, AccountingSettlement, Store } from "@monocoupon/db";
import { roiPercent } from "./money";
import { getEntriesWithPending } from "./ledger";

export interface StoreMoneySummary {
  storeId: string;
  name: string;
  slug: string;
  spentCents: number;
  /**
   * Revenue recognized: gross minus Returns only. A write-off does NOT
   * reduce this — a return means the underlying sale was invalid, so it was
   * never really earned; a write-off means it WAS validly earned, you just
   * won't collect it (that's a receivables problem, shown via
   * Pending/Lost, not a revenue-recognition one).
   */
  earnedCents: number;
  /**
   * Gross minus BOTH Lost and Returned — what actually drives Net, ROI, and
   * store rankings/charts, since an uncollectable write-off is money you
   * were never going to keep. This is the figure that keeps a written-off
   * store from looking "most profitable."
   */
  netEarnedCents: number;
  /** The raw, unadjusted accrued amount, before subtracting anything. */
  grossEarnedCents: number;
  lostCents: number;
  returnedCents: number;
  netCents: number;
  roi: number | null;
}

export interface StoreReceivables {
  storeId: string;
  name: string;
  slug: string;
  earnedCents: number;
  recoveredCents: number;
  lostCents: number;
  returnedCents: number;
  pendingCents: number;
}

export interface Totals {
  spentCents: number;
  /** Revenue recognized — see StoreMoneySummary.earnedCents (Returns only, not Lost). */
  earnedCents: number;
  /** Profitability basis — see StoreMoneySummary.netEarnedCents (both Lost and Returned). */
  netEarnedCents: number;
  grossEarnedCents: number;
  lostCents: number;
  returnedCents: number;
  netCents: number;
  roi: number | null;
}

export function sumTotals(rows: { spentCents: number; earnedCents: number; netEarnedCents?: number; grossEarnedCents?: number; lostCents?: number; returnedCents?: number }[]): Totals {
  const spentCents = rows.reduce((s, r) => s + r.spentCents, 0);
  const earnedCents = rows.reduce((s, r) => s + r.earnedCents, 0);
  const netEarnedCents = rows.reduce((s, r) => s + (r.netEarnedCents ?? r.earnedCents), 0);
  const grossEarnedCents = rows.reduce((s, r) => s + (r.grossEarnedCents ?? r.earnedCents), 0);
  const lostCents = rows.reduce((s, r) => s + (r.lostCents ?? 0), 0);
  const returnedCents = rows.reduce((s, r) => s + (r.returnedCents ?? 0), 0);
  return { spentCents, earnedCents, netEarnedCents, grossEarnedCents, lostCents, returnedCents, netCents: netEarnedCents - spentCents, roi: roiPercent(spentCents, netEarnedCents) };
}

/**
 * Recovered/Lost/Returned settlement totals per store, attributed to the
 * date the money was originally *earned* (via the entry each settlement
 * resolves), not the date it was paid/written off/returned — so scoping
 * this to a range correctly restates whichever historical period that money
 * came from, the same way a real bad-debt write-off or cash-basis report
 * would. `dateMatch` filters on the entry's date; omitted means unscoped
 * (true lifetime).
 */
async function settlementTotalsByStore(dateMatch?: { $gte: Date; $lte: Date }): Promise<Map<string, { recoveredCents: number; lostCents: number; returnedCents: number }>> {
  await connectToDatabase();
  const pipeline: PipelineStage[] = [];
  if (dateMatch) {
    pipeline.push(
      { $lookup: { from: "accountingentries", localField: "entry", foreignField: "_id", as: "e" } },
      { $unwind: "$e" },
      { $match: { "e.date": dateMatch } }
    );
  }
  pipeline.push({ $group: { _id: { store: "$store", type: "$type" }, total: { $sum: "$amountCents" } } });

  const rows = await AccountingSettlement.aggregate(pipeline);
  const map = new Map<string, { recoveredCents: number; lostCents: number; returnedCents: number }>();
  for (const row of rows) {
    const key = String(row._id.store);
    const bucket = map.get(key) ?? { recoveredCents: 0, lostCents: 0, returnedCents: 0 };
    if (row._id.type === "recovered") bucket.recoveredCents += row.total;
    else if (row._id.type === "returned") bucket.returnedCents += row.total;
    else bucket.lostCents += row.total;
    map.set(key, bucket);
  }
  return map;
}

/** Per-store Spent/Earned(net of write-offs and returns)/Net/ROI, optionally scoped to a date range. Only stores with at least one entry in scope are included. */
export async function getStoreMoneySummaries(dateMatch?: { $gte: Date; $lte: Date }): Promise<StoreMoneySummary[]> {
  await connectToDatabase();
  const match: Record<string, unknown> = {};
  if (dateMatch) match.date = dateMatch;

  const [entryTotals, stores, settledMap] = await Promise.all([
    AccountingEntry.aggregate([
      { $match: match },
      { $group: { _id: "$store", spentCents: { $sum: "$spentCents" }, earnedCents: { $sum: "$earnedCents" } } },
    ]),
    Store.find({}, "name slug").lean(),
    settlementTotalsByStore(dateMatch),
  ]);

  const storeMap = new Map(stores.map((s) => [String(s._id), s]));

  return entryTotals
    .map((row) => {
      const store = storeMap.get(String(row._id));
      const { lostCents, returnedCents } = settledMap.get(String(row._id)) ?? { recoveredCents: 0, lostCents: 0, returnedCents: 0 };
      const earnedCents = row.earnedCents - returnedCents;
      const netEarnedCents = row.earnedCents - lostCents - returnedCents;
      const netCents = netEarnedCents - row.spentCents;
      return {
        storeId: String(row._id),
        name: store?.name ?? "(deleted store)",
        slug: store?.slug ?? "",
        spentCents: row.spentCents,
        earnedCents,
        netEarnedCents,
        grossEarnedCents: row.earnedCents,
        lostCents,
        returnedCents,
        netCents,
        roi: roiPercent(row.spentCents, netEarnedCents),
      };
    })
    .sort((a, b) => b.netEarnedCents - a.netEarnedCents);
}

/** Recovered/Pending/Lost/Returned per store, optionally scoped to a date range (by the entry's own earning date). Omit `dateMatch` for true lifetime, unscoped by any period. */
export async function getStoreReceivables(dateMatch?: { $gte: Date; $lte: Date }): Promise<StoreReceivables[]> {
  await connectToDatabase();
  const entryMatch: Record<string, unknown> = {};
  if (dateMatch) entryMatch.date = dateMatch;

  const [entryTotals, settledMap, stores] = await Promise.all([
    AccountingEntry.aggregate([{ $match: entryMatch }, { $group: { _id: "$store", earnedCents: { $sum: "$earnedCents" } } }]),
    settlementTotalsByStore(dateMatch),
    Store.find({}, "name slug").lean(),
  ]);

  const storeMap = new Map(stores.map((s) => [String(s._id), s]));
  const earnedMap = new Map(entryTotals.map((e) => [String(e._id), e.earnedCents as number]));

  return Array.from(earnedMap.keys())
    .map((storeId) => {
      const store = storeMap.get(storeId);
      const earnedCents = earnedMap.get(storeId) ?? 0;
      const { recoveredCents, lostCents, returnedCents } = settledMap.get(storeId) ?? { recoveredCents: 0, lostCents: 0, returnedCents: 0 };
      return {
        storeId,
        name: store?.name ?? "(deleted store)",
        slug: store?.slug ?? "",
        earnedCents,
        recoveredCents,
        lostCents,
        returnedCents,
        pendingCents: Math.max(0, earnedCents - recoveredCents - lostCents - returnedCents),
      };
    })
    .sort((a, b) => b.pendingCents - a.pendingCents);
}

/** Spent/Earned(net of returns only — see StoreMoneySummary.earnedCents) trend by calendar month (UTC), most recent `monthsBack` months, oldest first. */
export async function getMonthlyTrend(monthsBack = 6): Promise<{ month: string; spentCents: number; earnedCents: number }[]> {
  await connectToDatabase();
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1));

  const [rows, returnedRows] = await Promise.all([
    AccountingEntry.aggregate([
      { $match: { date: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } },
          spentCents: { $sum: "$spentCents" },
          earnedCents: { $sum: "$earnedCents" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AccountingSettlement.aggregate([
      { $match: { type: "returned" } },
      { $lookup: { from: "accountingentries", localField: "entry", foreignField: "_id", as: "e" } },
      { $unwind: "$e" },
      { $match: { "e.date": { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$e.date", timezone: "UTC" } },
          returnedCents: { $sum: "$amountCents" },
        },
      },
    ]),
  ]);
  const returnedByMonth = new Map(returnedRows.map((r) => [r._id as string, r.returnedCents as number]));

  return rows.map((r) => ({ month: r._id as string, spentCents: r.spentCents, earnedCents: r.earnedCents - (returnedByMonth.get(r._id as string) ?? 0) }));
}

const AGE_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

function bucketForAge(days: number): AgeBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/** Still-pending earnings bucketed by how many days old they are, per store — the "how overdue is this" view. */
export async function getReceivablesAging(): Promise<{ storeId: string; name: string; slug: string; buckets: Record<AgeBucket, number> }[]> {
  await connectToDatabase();
  const [entries, stores] = await Promise.all([getEntriesWithPending(), Store.find({}, "name slug").lean()]);
  const storeMap = new Map(stores.map((s) => [String(s._id), s]));
  const now = Date.now();

  const byStore = new Map<string, Record<AgeBucket, number>>();
  for (const entry of entries) {
    if (entry.pendingCents <= 0) continue;
    const key = String(entry.store);
    const bucket = byStore.get(key) ?? { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const ageDays = Math.floor((now - entry.date.getTime()) / (24 * 60 * 60 * 1000));
    bucket[bucketForAge(ageDays)] += entry.pendingCents;
    byStore.set(key, bucket);
  }

  return Array.from(byStore.entries())
    .map(([storeId, buckets]) => {
      const store = storeMap.get(storeId);
      return { storeId, name: store?.name ?? "(deleted store)", slug: store?.slug ?? "", buckets };
    })
    .sort((a, b) => Object.values(b.buckets).reduce((s, v) => s + v, 0) - Object.values(a.buckets).reduce((s, v) => s + v, 0));
}

/** One store's day-by-day Spent/Earned/Net (raw — not adjusted for write-offs), oldest first — the shape the store-wise tables' trend chart needs, including the breakdown its tooltip shows. */
export interface DailyNetPoint {
  date: Date;
  spentCents: number;
  earnedCents: number;
  netCents: number;
}

/** Day-by-day Spent/Earned/Net per store, optionally scoped to a date range — for the trend chart on the store-wise tables. */
export async function getDailyNetByStore(dateMatch?: { $gte: Date; $lte: Date }): Promise<Map<string, DailyNetPoint[]>> {
  await connectToDatabase();
  const match: Record<string, unknown> = {};
  if (dateMatch) match.date = dateMatch;

  const rows = await AccountingEntry.find(match, "store date spentCents earnedCents").sort({ date: 1 }).lean();

  const byStore = new Map<string, DailyNetPoint[]>();
  for (const r of rows) {
    const key = String(r.store);
    const list = byStore.get(key) ?? [];
    list.push({ date: r.date, spentCents: r.spentCents, earnedCents: r.earnedCents, netCents: r.earnedCents - r.spentCents });
    byStore.set(key, list);
  }
  return byStore;
}

/** Day-by-day Spent/Earned(net of returns only — see StoreMoneySummary.earnedCents)/Net summed across every store, optionally scoped to a date range — the all-stores-combined trend chart on the store report pages. */
export async function getDailyTotals(dateMatch?: { $gte: Date; $lte: Date }): Promise<DailyNetPoint[]> {
  await connectToDatabase();
  const match: Record<string, unknown> = {};
  if (dateMatch) match.date = dateMatch;

  const returnedPipeline: PipelineStage[] = [
    { $match: { type: "returned" } },
    { $lookup: { from: "accountingentries", localField: "entry", foreignField: "_id", as: "e" } },
    { $unwind: "$e" },
  ];
  if (dateMatch) returnedPipeline.push({ $match: { "e.date": dateMatch } });
  returnedPipeline.push({ $group: { _id: "$e.date", returnedCents: { $sum: "$amountCents" } } });

  const [rows, returnedRows] = await Promise.all([
    AccountingEntry.aggregate([
      { $match: match },
      { $group: { _id: "$date", spentCents: { $sum: "$spentCents" }, earnedCents: { $sum: "$earnedCents" } } },
      { $sort: { _id: 1 } },
    ]),
    AccountingSettlement.aggregate(returnedPipeline),
  ]);
  const returnedByDate = new Map(returnedRows.map((r) => [new Date(r._id as Date).getTime(), r.returnedCents as number]));

  return rows.map((r) => {
    const date = r._id as Date;
    const returnedCents = returnedByDate.get(date.getTime()) ?? 0;
    const earnedCents = r.earnedCents - returnedCents;
    return { date, spentCents: r.spentCents, earnedCents, netCents: earnedCents - r.spentCents };
  });
}

export { AGE_BUCKETS };
