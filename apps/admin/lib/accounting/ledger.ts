import { connectToDatabase, AccountingEntry, AccountingSettlement, AccountingWriteOff, AccountingReturn } from "@monocoupon/db";
import type { Model, Types } from "mongoose";

export interface EntryWithPending {
  _id: Types.ObjectId;
  store: Types.ObjectId;
  date: Date;
  spentCents: number;
  earnedCents: number;
  notes?: string | null;
  settledCents: number;
  pendingCents: number;
}

/**
 * Loads a store's entries plus, for each, how much of its earnedCents has
 * already been settled (recovered or lost) — computed fresh from
 * AccountingSettlement every time rather than trusted from a stored field,
 * so it can never drift. Two queries total regardless of entry count.
 */
export async function getEntriesWithPending(filter: { store?: string; maxDate?: Date } = {}): Promise<EntryWithPending[]> {
  await connectToDatabase();
  const match: Record<string, unknown> = {};
  if (filter.store) match.store = filter.store;
  if (filter.maxDate) match.date = { $lte: filter.maxDate };

  const entries = await AccountingEntry.find(match).sort({ date: 1 }).lean();
  if (entries.length === 0) return [];

  const entryIds = entries.map((e) => e._id);
  const settled = await AccountingSettlement.aggregate([
    { $match: { entry: { $in: entryIds } } },
    { $group: { _id: "$entry", total: { $sum: "$amountCents" } } },
  ]);
  const settledMap = new Map<string, number>(settled.map((s) => [String(s._id), s.total as number]));

  return entries.map((e) => {
    const settledCents = settledMap.get(String(e._id)) ?? 0;
    return { ...e, settledCents, pendingCents: Math.max(0, e.earnedCents - settledCents) };
  });
}

/**
 * Applies a payment FIFO across a store's oldest unsettled entries, dated at
 * or before the payment's own date (a payment can't retroactively cover
 * earnings from days after it arrived). Writes one AccountingSettlement per
 * day it touches. Returns the leftover that had nowhere to go.
 */
export async function allocatePayment(opts: {
  storeId: string;
  paymentId: Types.ObjectId | string;
  amountCents: number;
  dateReceived: Date;
}): Promise<number> {
  const entries = await getEntriesWithPending({ store: opts.storeId, maxDate: opts.dateReceived });

  let remaining = opts.amountCents;
  const toCreate: { store: string; entry: Types.ObjectId; type: "recovered"; amountCents: number; payment: typeof opts.paymentId; date: Date }[] = [];

  for (const entry of entries) {
    if (remaining <= 0) break;
    if (entry.pendingCents <= 0) continue;
    const apply = Math.min(entry.pendingCents, remaining);
    toCreate.push({ store: opts.storeId, entry: entry._id, type: "recovered", amountCents: apply, payment: opts.paymentId, date: opts.dateReceived });
    remaining -= apply;
  }

  if (toCreate.length > 0) await AccountingSettlement.insertMany(toCreate);
  return remaining;
}

/**
 * Shared machinery behind both "mark as lost" and "mark as returned": FIFO a
 * negative adjustment across a store's currently-pending earnings, backed
 * by a parent record (like a payment's AccountingPayment) so the whole
 * event can be undone as one unit later via `undoPendingAdjustment` — e.g.
 * a write-off reversed because the store paid after all, or a return
 * reversed because it turned out to be a mistake. `amountCents` omitted
 * means "everything still pending"; if it's more than is actually pending,
 * it's clamped down — you can't adjust away money that was never owed.
 * Returns null (creates nothing) when there's nothing pending to adjust.
 */
async function markStorePendingAdjustment<TSettlementField extends string>(opts: {
  storeId: string;
  amountCents?: number;
  date: Date;
  reason?: string | null;
  type: "lost" | "returned";
  // Deliberately untyped-on-input (Mongoose's generated Model<T> is
  // invariant on its schema's exact field types, e.g. `store: ObjectId` vs
  // the plain `string` id we pass in) — this helper is private to this
  // file and both call sites below are fully typed, so the looseness here
  // is contained.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ParentModel: Model<any>;
  settlementField: TSettlementField;
}): Promise<{ eventId: Types.ObjectId; adjustedCents: number } | null> {
  const entries = (await getEntriesWithPending({ store: opts.storeId })).filter((e) => e.pendingCents > 0);
  const totalPending = entries.reduce((sum, e) => sum + e.pendingCents, 0);
  let remaining = Math.min(opts.amountCents ?? totalPending, totalPending);
  const adjusted = remaining;

  if (adjusted <= 0) return null;

  const event = await opts.ParentModel.create({ store: opts.storeId, amountCents: adjusted, date: opts.date, reason: opts.reason || null });

  const toCreate: Record<string, unknown>[] = [];
  for (const entry of entries) {
    if (remaining <= 0) break;
    const apply = Math.min(entry.pendingCents, remaining);
    toCreate.push({ store: opts.storeId, entry: entry._id, type: opts.type, amountCents: apply, [opts.settlementField]: event._id, date: opts.date, reason: opts.reason || null });
    remaining -= apply;
  }

  if (toCreate.length > 0) await AccountingSettlement.insertMany(toCreate);
  return { eventId: event._id, adjustedCents: adjusted };
}

/** Writes off a store's currently-pending earnings as unrecoverable (the store never paid a valid debt). See markStorePendingAdjustment. */
export async function markStoreLost(opts: { storeId: string; amountCents?: number; date: Date; reason?: string | null }) {
  const result = await markStorePendingAdjustment({ ...opts, type: "lost", ParentModel: AccountingWriteOff, settlementField: "writeOff" });
  return result ? { writeOffId: result.eventId, writtenOffCents: result.adjustedCents } : null;
}

/** Reverses a store's currently-pending earnings because the underlying sale was returned/refunded (the commission was never really earned). See markStorePendingAdjustment. */
export async function markStoreReturned(opts: { storeId: string; amountCents?: number; date: Date; reason?: string | null }) {
  const result = await markStorePendingAdjustment({ ...opts, type: "returned", ParentModel: AccountingReturn, settlementField: "returnEvent" });
  return result ? { returnId: result.eventId, returnedCents: result.adjustedCents } : null;
}

/**
 * Undoes a "mark as lost" event — cascade-deletes its settlements (reverting
 * those days back to pending) and the AccountingWriteOff record itself. Use
 * when a store pays after being written off: undo the write-off first, then
 * log the real payment as usual so FIFO recovery applies to those days.
 */
export async function undoWriteOff(writeOffId: string): Promise<void> {
  await connectToDatabase();
  await AccountingSettlement.deleteMany({ writeOff: writeOffId });
  await AccountingWriteOff.findByIdAndDelete(writeOffId);
}

/** Undoes a "mark as returned" event — cascade-deletes its settlements (reverting those days back to pending) and the AccountingReturn record itself. Use if a return was logged by mistake, or reversed. */
export async function undoReturn(returnId: string): Promise<void> {
  await connectToDatabase();
  await AccountingSettlement.deleteMany({ returnEvent: returnId });
  await AccountingReturn.findByIdAndDelete(returnId);
}
