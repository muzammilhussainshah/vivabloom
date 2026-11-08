"use client";

import { useActionState, useState } from "react";
import { upsertPaymentTerm, type ActionState } from "./actions";

export interface PaymentTermFormInitialData {
  store: string;
  netDays: string;
  batchCycle: "none" | "weekly" | "monthly";
  payDayOfWeek: string;
  payDayOfMonth: string;
  monthsOffset: string;
  closingDayOfMonth: string;
  minimumAmount: string;
  notes: string;
}

const EMPTY: PaymentTermFormInitialData = {
  store: "",
  netDays: "30",
  batchCycle: "monthly",
  payDayOfWeek: "",
  payDayOfMonth: "",
  monthsOffset: "",
  closingDayOfMonth: "",
  minimumAmount: "",
  notes: "",
};

const WEEKDAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function PaymentTermForm({
  stores,
  initialData,
  returnTo,
  isEditing,
}: {
  stores: { id: string; name: string }[];
  initialData?: PaymentTermFormInitialData;
  returnTo: string;
  isEditing: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(upsertPaymentTerm, undefined);
  const data = initialData ?? EMPTY;
  const [batchCycle, setBatchCycle] = useState<PaymentTermFormInitialData["batchCycle"]>(data.batchCycle);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <p className="text-sm font-medium">{isEditing ? "Edit payment term" : "Add a payment term"}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="pt-store" className="text-xs font-medium text-text-muted">
            Store
          </label>
          <select id="pt-store" name="store" required defaultValue={data.store} className="rounded-base border border-border bg-surface px-3 py-2 text-sm">
            <option value="" disabled>
              Select…
            </option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pt-cycle" className="text-xs font-medium text-text-muted">
            Batching
          </label>
          <select
            id="pt-cycle"
            name="batchCycle"
            value={batchCycle}
            onChange={(e) => setBatchCycle(e.target.value as PaymentTermFormInitialData["batchCycle"])}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="none">None — pays per day</option>
            <option value="weekly">Weekly (Mon-Sun)</option>
            <option value="monthly">Monthly (calendar month)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pt-netdays" className="text-xs font-medium text-text-muted">
            Net days {batchCycle === "monthly" && <span className="text-text-muted">(ignored if months-after is set)</span>}
          </label>
          <input id="pt-netdays" name="netDays" type="number" min="0" defaultValue={data.netDays} className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums" />
        </div>

        {batchCycle === "weekly" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="pt-dow" className="text-xs font-medium text-text-muted">
              Paid on
            </label>
            <select id="pt-dow" name="payDayOfWeek" required defaultValue={data.payDayOfWeek} className="rounded-base border border-border bg-surface px-3 py-2 text-sm">
              <option value="" disabled>
                Select…
              </option>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {batchCycle === "monthly" && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="pt-dom" className="text-xs font-medium text-text-muted">
                Day of month paid
              </label>
              <input
                id="pt-dom"
                name="payDayOfMonth"
                type="number"
                min="1"
                max="31"
                required
                defaultValue={data.payDayOfMonth}
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pt-monthsoffset" className="text-xs font-medium text-text-muted">
                Months after (optional, overrides net days)
              </label>
              <input
                id="pt-monthsoffset"
                name="monthsOffset"
                type="number"
                min="0"
                placeholder="e.g. 2"
                defaultValue={data.monthsOffset}
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pt-closingday" className="text-xs font-medium text-text-muted">
                Batch cutoff day (optional, default = month-end)
              </label>
              <input
                id="pt-closingday"
                name="closingDayOfMonth"
                type="number"
                min="1"
                max="31"
                placeholder="e.g. 10, for a 10th-to-10th cycle"
                defaultValue={data.closingDayOfMonth}
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pt-min" className="text-xs font-medium text-text-muted">
                Minimum payout ($, optional)
              </label>
              <input
                id="pt-min"
                name="minimumAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={data.minimumAmount}
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pt-notes" className="text-xs font-medium text-text-muted">
          Notes
        </label>
        <input id="pt-notes" name="notes" defaultValue={data.notes} className="rounded-base border border-border bg-surface px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="self-start rounded-base bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60">
          {isPending ? "Saving…" : isEditing ? "Save changes" : "Add term"}
        </button>
        {isEditing && (
          <a href={returnTo} className="text-sm text-text-muted hover:underline">
            Cancel edit
          </a>
        )}
        {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
      </div>
      <p className="text-xs text-text-muted">Re-submitting the same store updates its existing term instead of creating a duplicate.</p>
    </form>
  );
}
