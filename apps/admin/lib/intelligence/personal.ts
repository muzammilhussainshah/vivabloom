import { connectToDatabase, AccountingPayment, PaymentTerm, Store } from "@monocoupon/db";
import { getStoreMoneySummaries, getStoreReceivables } from "@/lib/accounting/aggregate";
import { domainOfUrl } from "./domain";

/**
 * "Your history" for a checked store, read from the existing Accounting
 * section (never stored on the StoreCheck, and never mixed into the public
 * trust score — your own experience is shown as its own, separate signal).
 */

export interface PersonalRecord {
  storeId: string;
  storeName: string;
  spentCents: number;
  grossEarnedCents: number;
  recoveredCents: number;
  pendingCents: number;
  lostCents: number;
  returnedCents: number;
  netCents: number;
  roi: number | null;
  lastPaymentAt: string | null;
  hasPaymentTerm: boolean;
}

export async function getPersonalRecord(domain: string): Promise<PersonalRecord | null> {
  await connectToDatabase();
  const stores = await Store.find({}, "name websiteUrl").lean();
  const store = stores.find((s) => s.websiteUrl && domainOfUrl(s.websiteUrl) === domain);
  if (!store) return null;
  const storeId = String(store._id);

  const [summaries, receivables, lastPayment, term] = await Promise.all([
    getStoreMoneySummaries(),
    getStoreReceivables(),
    AccountingPayment.findOne({ store: store._id }).sort({ dateReceived: -1 }).select("dateReceived").lean(),
    PaymentTerm.exists({ store: store._id }),
  ]);
  const money = summaries.find((s) => s.storeId === storeId);
  const rec = receivables.find((r) => r.storeId === storeId);
  if (!money && !rec && !lastPayment) {
    return {
      storeId,
      storeName: store.name,
      spentCents: 0,
      grossEarnedCents: 0,
      recoveredCents: 0,
      pendingCents: 0,
      lostCents: 0,
      returnedCents: 0,
      netCents: 0,
      roi: null,
      lastPaymentAt: null,
      hasPaymentTerm: Boolean(term),
    };
  }
  return {
    storeId,
    storeName: store.name,
    spentCents: money?.spentCents ?? 0,
    grossEarnedCents: money?.grossEarnedCents ?? 0,
    recoveredCents: rec?.recoveredCents ?? 0,
    pendingCents: rec?.pendingCents ?? 0,
    lostCents: money?.lostCents ?? rec?.lostCents ?? 0,
    returnedCents: money?.returnedCents ?? rec?.returnedCents ?? 0,
    netCents: money?.netCents ?? 0,
    roi: money?.roi ?? null,
    lastPaymentAt: lastPayment?.dateReceived ? new Date(lastPayment.dateReceived).toISOString() : null,
    hasPaymentTerm: Boolean(term),
  };
}
