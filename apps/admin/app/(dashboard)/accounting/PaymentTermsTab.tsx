import Link from "next/link";
import { connectToDatabase, Store, PaymentTerm } from "@monocoupon/db";
import { deletePaymentTerm } from "./actions";
import { PaymentTermForm, type PaymentTermFormInitialData } from "./PaymentTermForm";
import { formatCents } from "@/lib/accounting/money";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describeTerm(t: {
  netDays?: number | null;
  batchCycle: string;
  payDayOfWeek?: number | null;
  payDayOfMonth?: number | null;
  monthsOffset?: number | null;
  closingDayOfMonth?: number | null;
  minimumAmountCents?: number | null;
}) {
  if (t.batchCycle === "none") return `Paid ${t.netDays ?? 0} days after each day earned.`;
  if (t.batchCycle === "weekly") return `Weekly batch (closes Sunday), paid ${t.netDays ?? 0} days after close, landing on ${WEEKDAY_NAMES[t.payDayOfWeek ?? 1]}.`;

  const closing = t.closingDayOfMonth != null ? `the ${t.closingDayOfMonth}${ordinal(t.closingDayOfMonth)} of each month` : "month-end";
  if (t.monthsOffset != null) {
    return `Monthly batch closing ${closing}, paid on the ${t.payDayOfMonth}${ordinal(t.payDayOfMonth ?? 1)} of the month ${t.monthsOffset} month${t.monthsOffset === 1 ? "" : "s"} later.`;
  }
  const min = t.minimumAmountCents && t.minimumAmountCents > 0 ? ` Minimum ${formatCents(t.minimumAmountCents)} to trigger payout, else carries to next month.` : "";
  return `Monthly batch closing ${closing}, paid ${t.netDays ?? 0} days after close (earliest ${t.payDayOfMonth}${ordinal(t.payDayOfMonth ?? 1)}).${min}`;
}

function ordinal(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "st";
  if (n % 10 === 2 && n % 100 !== 12) return "nd";
  if (n % 10 === 3 && n % 100 !== 13) return "rd";
  return "th";
}

export async function PaymentTermsTab({ searchParams }: { searchParams: { editTerm?: string } }) {
  const { editTerm } = searchParams;
  await connectToDatabase();

  const [stores, terms] = await Promise.all([Store.find({}, "name").sort({ name: 1 }).lean(), PaymentTerm.find({}).populate("store", "name").lean()]);
  const storeOptions = stores.map((s) => ({ id: String(s._id), name: s.name }));
  const configuredStoreIds = new Set(terms.map((t) => String(t.store instanceof Object && "_id" in t.store ? (t.store as { _id: unknown })._id : t.store)));
  const unconfigured = storeOptions.filter((s) => !configuredStoreIds.has(s.id));

  let editInitialData: PaymentTermFormInitialData | undefined;
  if (editTerm) {
    const t = terms.find((x) => String(x._id) === editTerm);
    if (t) {
      editInitialData = {
        store: String(t.store instanceof Object && "_id" in t.store ? (t.store as { _id: unknown })._id : t.store),
        netDays: String(t.netDays ?? 30),
        batchCycle: (t.batchCycle ?? "monthly") as PaymentTermFormInitialData["batchCycle"],
        payDayOfWeek: t.payDayOfWeek != null ? String(t.payDayOfWeek) : "",
        payDayOfMonth: t.payDayOfMonth != null ? String(t.payDayOfMonth) : "",
        monthsOffset: t.monthsOffset != null ? String(t.monthsOffset) : "",
        closingDayOfMonth: t.closingDayOfMonth != null ? String(t.closingDayOfMonth) : "",
        minimumAmount: t.minimumAmountCents ? (t.minimumAmountCents / 100).toFixed(2) : "",
        notes: t.notes ?? "",
      };
    }
  }

  const returnTo = "/accounting?tab=payment-terms";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-text-muted">
        How each store actually pays out — used to project your still-pending earnings onto a calendar, on the Dashboard&rsquo;s
        Expected Receivables section. A store with no term here is simply left out of that forecast.
      </p>

      <PaymentTermForm stores={storeOptions} initialData={editInitialData} returnTo={returnTo} isEditing={!!editInitialData} />

      {unconfigured.length > 0 && (
        <p className="rounded-base border border-border bg-surface p-3 text-xs text-text-muted">
          Not configured yet: {unconfigured.map((s) => s.name).join(", ")}
        </p>
      )}

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Store</th>
              <th className="p-3">Terms</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => {
              const storeDoc = t.store as unknown as { name: string };
              return (
                <tr key={String(t._id)} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium align-top">{storeDoc?.name ?? "—"}</td>
                  <td className="p-3 text-text-muted">
                    {describeTerm(t)}
                    {t.notes && <p className="mt-1 italic">{t.notes}</p>}
                  </td>
                  <td className="p-3 text-right align-top">
                    <div className="flex justify-end gap-3">
                      <Link href={`${returnTo}&editTerm=${t._id}`} className="text-brand-primary hover:underline">
                        Edit
                      </Link>
                      <form action={deletePaymentTerm.bind(null, String(t._id))}>
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button type="submit" className="text-brand-secondary hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {terms.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-text-muted">
                  No payment terms configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
