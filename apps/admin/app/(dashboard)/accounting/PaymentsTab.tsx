import { connectToDatabase, AccountingPayment, AccountingSettlement, AccountingWriteOff, AccountingReturn } from "@monocoupon/db";
import { getStoreReceivables } from "@/lib/accounting/aggregate";
import { formatCents } from "@/lib/accounting/money";
import { deletePayment, undoWriteOffAction, undoReturnAction } from "./actions";
import { PaymentForm } from "./PaymentForm";
import { LostForm } from "./LostForm";
import { ReturnForm } from "./ReturnForm";

const RETURN_TO = "/accounting?tab=payments";

/** Shared shape for the Write-off and Returns history tables — same columns, different data source and undo action. */
function AdjustmentHistoryTable({
  title,
  caption,
  events,
  undoAction,
  emptyLabel,
}: {
  title: string;
  caption: string;
  events: { _id: unknown; date: Date; amountCents: number; reason?: string | null; store: unknown }[];
  undoAction: (id: string, formData: FormData) => Promise<void>;
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-base border border-border bg-surface">
      <p className="border-b border-border p-3 text-xs font-medium text-text-muted">
        {title} <span className="font-normal text-text-muted">— {caption}</span>
      </p>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-muted text-left">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Store</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3">Reason</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const storeDoc = e.store as unknown as { name: string };
            return (
              <tr key={String(e._id)} className="border-b border-border last:border-0">
                <td className="p-3 whitespace-nowrap">{e.date.toLocaleDateString("en-US", { timeZone: "UTC" })}</td>
                <td className="p-3 font-medium">{storeDoc?.name ?? "—"}</td>
                <td className="p-3 text-right tabular-nums">{formatCents(e.amountCents)}</td>
                <td className="p-3 text-xs text-text-muted">{e.reason ?? "—"}</td>
                <td className="p-3 text-right">
                  <form action={undoAction.bind(null, String(e._id))}>
                    <input type="hidden" name="returnTo" value={RETURN_TO} />
                    <button type="submit" className="text-brand-primary hover:underline">
                      Undo
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          {events.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-text-muted">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export async function PaymentsTab() {
  await connectToDatabase();

  const receivables = await getStoreReceivables();
  const storeOptions = receivables.map((r) => ({
    id: r.storeId,
    name: r.name,
    pendingLabel: r.pendingCents > 0 ? `${formatCents(r.pendingCents)} pending` : "nothing pending",
  }));

  const payments = await AccountingPayment.find({}).populate("store", "name").sort({ dateReceived: -1 }).limit(200).lean();
  const paymentIds = payments.map((p) => p._id);
  const allocationCounts = paymentIds.length
    ? await AccountingSettlement.aggregate([
        { $match: { payment: { $in: paymentIds }, type: "recovered" } },
        { $group: { _id: "$payment", days: { $sum: 1 }, total: { $sum: "$amountCents" } } },
      ])
    : [];
  const allocMap = new Map(allocationCounts.map((a) => [String(a._id), a]));

  const [writeOffs, returns] = await Promise.all([
    AccountingWriteOff.find({}).populate("store", "name").sort({ date: -1 }).limit(200).lean(),
    AccountingReturn.find({}).populate("store", "name").sort({ date: -1 }).limit(200).lean(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <p className="border-b border-border p-3 text-xs font-medium text-text-muted">Receivables by store</p>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Store</th>
              <th className="p-3 text-right">Earned (lifetime)</th>
              <th className="p-3 text-right">Recovered</th>
              <th className="p-3 text-right">Pending</th>
              <th className="p-3 text-right">Lost</th>
              <th className="p-3 text-right">Returned</th>
            </tr>
          </thead>
          <tbody>
            {receivables.map((r) => (
              <tr key={r.storeId} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-right tabular-nums">{formatCents(r.earnedCents)}</td>
                <td className="p-3 text-right tabular-nums">{formatCents(r.recoveredCents)}</td>
                <td className="p-3 text-right tabular-nums">{formatCents(r.pendingCents)}</td>
                <td className="p-3 text-right tabular-nums">{r.lostCents > 0 ? formatCents(r.lostCents) : "—"}</td>
                <td className="p-3 text-right tabular-nums">{r.returnedCents > 0 ? formatCents(r.returnedCents) : "—"}</td>
              </tr>
            ))}
            {receivables.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-text-muted">
                  No earnings recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaymentForm stores={storeOptions} returnTo={RETURN_TO} />
      <ReturnForm stores={storeOptions} returnTo={RETURN_TO} />
      <LostForm stores={storeOptions} returnTo={RETURN_TO} />

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <p className="border-b border-border p-3 text-xs font-medium text-text-muted">Payment history</p>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Store</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Applied to</th>
              <th className="p-3">Method</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const storeDoc = p.store as unknown as { name: string };
              const alloc = allocMap.get(String(p._id));
              return (
                <tr key={String(p._id)} className="border-b border-border last:border-0">
                  <td className="p-3 whitespace-nowrap">{p.dateReceived.toLocaleDateString("en-US", { timeZone: "UTC" })}</td>
                  <td className="p-3 font-medium">{storeDoc?.name ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{formatCents(p.amountCents)}</td>
                  <td className="p-3 text-xs text-text-muted">
                    {alloc ? `${alloc.days} day${alloc.days === 1 ? "" : "s"} (${formatCents(alloc.total)})` : "—"}
                    {p.unallocatedCents > 0 && <span className="ml-1 text-brand-secondary">· {formatCents(p.unallocatedCents)} unallocated</span>}
                  </td>
                  <td className="p-3 text-text-muted">{p.method ?? "—"}</td>
                  <td className="p-3 text-right">
                    <form action={deletePayment.bind(null, String(p._id))}>
                      <input type="hidden" name="returnTo" value={RETURN_TO} />
                      <button type="submit" className="text-brand-secondary hover:underline">
                        Undo
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-text-muted">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdjustmentHistoryTable
        title="Returns history"
        caption="undo one if it was logged by mistake"
        events={returns}
        undoAction={undoReturnAction}
        emptyLabel="No returns recorded yet."
      />

      <AdjustmentHistoryTable
        title="Write-off history"
        caption="undo one if the store ends up paying after all"
        events={writeOffs}
        undoAction={undoWriteOffAction}
        emptyLabel="Nothing written off yet."
      />
    </div>
  );
}
