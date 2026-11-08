"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectToDatabase, Store, AccountingEntry, AccountingPayment, AccountingSettlement, PaymentTerm } from "@monocoupon/db";
import { accountingEntrySchema, accountingPaymentSchema, accountingLostSchema, paymentTermSchema } from "@monocoupon/validation";
import { logAudit } from "@/lib/audit";
import { dollarsToCents } from "@/lib/accounting/money";
import { allocatePayment, markStoreLost, undoWriteOff, markStoreReturned, undoReturn } from "@/lib/accounting/ledger";

export type ActionState = { error?: string; success?: string } | undefined;

function returnPath(formData: FormData, fallback: string) {
  const raw = String(formData.get("returnTo") ?? "");
  // Only ever redirect back within this admin app's own accounting section —
  // returnTo is attacker-controllable form input, never trust it as an
  // absolute or cross-origin URL.
  return raw.startsWith("/accounting") ? raw : fallback;
}

function withQueryParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function upsertEntry(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = accountingEntrySchema.safeParse({
    store: formData.get("store"),
    date: formData.get("date"),
    spent: formData.get("spent"),
    earned: formData.get("earned"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);

  await AccountingEntry.findOneAndUpdate(
    { store: parsed.data.store, date },
    {
      store: parsed.data.store,
      date,
      spentCents: dollarsToCents(parsed.data.spent),
      earnedCents: dollarsToCents(parsed.data.earned),
      notes: parsed.data.notes,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit("accounting.entry.upsert", { entityType: "AccountingEntry", entityId: `${parsed.data.store}:${parsed.data.date}` });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=entries"));
}

export async function deleteEntry(id: string, formData: FormData) {
  await connectToDatabase();

  const settledCents = await AccountingSettlement.aggregate([
    { $match: { entry: id } },
    { $group: { _id: null, total: { $sum: "$amountCents" } } },
  ]);
  if ((settledCents[0]?.total ?? 0) > 0) {
    // Deleting would orphan settlements that reference real payments/write-offs
    // already recorded against this day — edit the earned amount instead of
    // removing a day that's already partially or fully accounted for.
    redirect(withQueryParam(returnPath(formData, "/accounting?tab=entries"), "error", "Can't delete a day with recovered or written-off money — edit its amount instead."));
  }

  await AccountingEntry.findByIdAndDelete(id);
  await logAudit("accounting.entry.delete", { entityType: "AccountingEntry", entityId: id });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=entries"));
}

export async function createPayment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = accountingPaymentSchema.safeParse({
    store: formData.get("store"),
    amount: formData.get("amount"),
    dateReceived: formData.get("dateReceived"),
    method: formData.get("method") || null,
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const dateReceived = new Date(`${parsed.data.dateReceived}T00:00:00.000Z`);
  const amountCents = dollarsToCents(parsed.data.amount);

  const payment = await AccountingPayment.create({
    store: parsed.data.store,
    amountCents,
    dateReceived,
    method: parsed.data.method || null,
    notes: parsed.data.notes,
  });

  const unallocatedCents = await allocatePayment({
    storeId: parsed.data.store,
    paymentId: payment._id,
    amountCents,
    dateReceived,
  });
  if (unallocatedCents > 0) {
    payment.unallocatedCents = unallocatedCents;
    await payment.save();
  }

  await logAudit("accounting.payment.create", { entityType: "AccountingPayment", entityId: String(payment._id) });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payments"));
}

export async function deletePayment(id: string, formData: FormData) {
  await connectToDatabase();
  // Cascade: removing a mistakenly-entered payment reverts every day it
  // settled back to pending, which is the correct behavior for undoing it.
  await AccountingSettlement.deleteMany({ payment: id });
  await AccountingPayment.findByIdAndDelete(id);
  await logAudit("accounting.payment.delete", { entityType: "AccountingPayment", entityId: id });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payments"));
}

export async function markLost(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = accountingLostSchema.safeParse({
    store: formData.get("store"),
    amount: formData.get("amount") ?? "",
    date: formData.get("date"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const result = await markStoreLost({
    storeId: parsed.data.store,
    amountCents: parsed.data.amount !== undefined ? dollarsToCents(parsed.data.amount) : undefined,
    date: new Date(`${parsed.data.date}T00:00:00.000Z`),
    reason: parsed.data.reason,
  });

  if (!result) {
    return { error: "That store has nothing pending to write off." };
  }

  await logAudit("accounting.store.markLost", { entityType: "Store", entityId: parsed.data.store });
  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payments"));
}

/** Undoes a "mark as lost" write-off — e.g. the store paid after all. Reverts every day it touched back to pending; log the real payment separately afterward so FIFO recovery applies. */
export async function undoWriteOffAction(id: string, formData: FormData) {
  await undoWriteOff(id);
  await logAudit("accounting.store.undoWriteOff", { entityType: "AccountingWriteOff", entityId: id });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payments"));
}

/** Reverses a store's currently-pending earnings because the customer returned/refunded the sale — same shape as markLost, just a different reason and reported separately. */
export async function markReturned(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = accountingLostSchema.safeParse({
    store: formData.get("store"),
    amount: formData.get("amount") ?? "",
    date: formData.get("date"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const result = await markStoreReturned({
    storeId: parsed.data.store,
    amountCents: parsed.data.amount !== undefined ? dollarsToCents(parsed.data.amount) : undefined,
    date: new Date(`${parsed.data.date}T00:00:00.000Z`),
    reason: parsed.data.reason,
  });

  if (!result) {
    return { error: "That store has nothing pending to adjust for a return." };
  }

  await logAudit("accounting.store.markReturned", { entityType: "Store", entityId: parsed.data.store });
  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payments"));
}

/** Undoes a "mark as returned" adjustment — e.g. it was logged by mistake. Reverts every day it touched back to pending. */
export async function undoReturnAction(id: string, formData: FormData) {
  await undoReturn(id);
  await logAudit("accounting.store.undoReturn", { entityType: "AccountingReturn", entityId: id });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payments"));
}

const NAME_KEY = (s: string) => s.trim().toLowerCase();

/**
 * Bulk-imports pasted rows (tab- or comma-separated: Date, Store, Spent,
 * Earned[, Notes]) — the escape hatch for backfilling months of history from
 * the old Google Sheet without hand-typing every day. Matches Store by exact
 * name (case-insensitive); never creates a store on the fly, since a wrong
 * or misspelled name silently creating a garbage store record would be far
 * worse than a rejected row the admin can fix and re-paste.
 */
export async function importEntries(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("csv") ?? "").trim();
  if (!raw) return { error: "Paste some rows first." };

  await connectToDatabase();
  const stores = await Store.find({}, "name").lean();
  const storeByName = new Map(stores.map((s) => [NAME_KEY(s.name), s._id]));

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  let imported = 0;

  for (const [i, line] of lines.entries()) {
    const cols = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const [dateStr, storeName, spentStr, earnedStr, notes] = cols;
    if (!dateStr || !storeName) {
      errors.push(`Row ${i + 1}: missing date or store`);
      continue;
    }

    const storeId = storeByName.get(NAME_KEY(storeName));
    if (!storeId) {
      errors.push(`Row ${i + 1}: no store named "${storeName}"`);
      continue;
    }

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      errors.push(`Row ${i + 1}: unrecognized date "${dateStr}"`);
      continue;
    }
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

    const spent = Number(spentStr ?? 0);
    const earned = Number(earnedStr ?? 0);
    if (!Number.isFinite(spent) || !Number.isFinite(earned) || spent < 0 || earned < 0) {
      errors.push(`Row ${i + 1}: invalid spent/earned amount`);
      continue;
    }

    await AccountingEntry.findOneAndUpdate(
      { store: storeId, date: utcDate },
      { store: storeId, date: utcDate, spentCents: dollarsToCents(spent), earnedCents: dollarsToCents(earned), notes: notes ?? "" },
      { upsert: true, setDefaultsOnInsert: true }
    );
    imported++;
  }

  if (imported > 0) {
    await logAudit("accounting.entries.import", { entityType: "AccountingEntry", entityId: `${imported} rows` });
    revalidatePath("/accounting");
  }

  if (errors.length > 0) {
    return { error: `Imported ${imported} row(s). ${errors.length} skipped: ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? "…" : ""}` };
  }
  return { success: `Imported ${imported} row(s).` };
}

export async function upsertPaymentTerm(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = paymentTermSchema.safeParse({
    store: formData.get("store"),
    netDays: formData.get("netDays"),
    batchCycle: formData.get("batchCycle"),
    payDayOfWeek: formData.get("payDayOfWeek") ?? "",
    payDayOfMonth: formData.get("payDayOfMonth") ?? "",
    monthsOffset: formData.get("monthsOffset") ?? "",
    closingDayOfMonth: formData.get("closingDayOfMonth") ?? "",
    minimumAmount: formData.get("minimumAmount") || 0,
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectToDatabase();
  const { store, minimumAmount, payDayOfWeek, payDayOfMonth, monthsOffset, closingDayOfMonth, ...rest } = parsed.data;

  await PaymentTerm.findOneAndUpdate(
    { store },
    {
      store,
      ...rest,
      payDayOfWeek: payDayOfWeek ?? null,
      payDayOfMonth: payDayOfMonth ?? null,
      monthsOffset: monthsOffset ?? null,
      closingDayOfMonth: closingDayOfMonth ?? null,
      minimumAmountCents: dollarsToCents(minimumAmount),
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  await logAudit("accounting.paymentTerm.upsert", { entityType: "PaymentTerm", entityId: store });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payment-terms"));
}

export async function deletePaymentTerm(id: string, formData: FormData) {
  await connectToDatabase();
  await PaymentTerm.findByIdAndDelete(id);
  await logAudit("accounting.paymentTerm.delete", { entityType: "PaymentTerm", entityId: id });

  revalidatePath("/accounting");
  redirect(returnPath(formData, "/accounting?tab=payment-terms"));
}
