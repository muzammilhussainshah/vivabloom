"use client";

import { useActionState } from "react";
import { createPayment, type ActionState } from "./actions";

export function PaymentForm({ stores, returnTo }: { stores: { id: string; name: string; pendingLabel: string }[]; returnTo: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(createPayment, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <p className="text-sm font-medium">Log a payment received</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="flex flex-col gap-1 md:col-span-2">
          <label htmlFor="pf-store" className="text-xs font-medium text-text-muted">
            Store
          </label>
          <select id="pf-store" name="store" required defaultValue="" className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none">
            <option value="" disabled>
              Select…
            </option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.pendingLabel}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pf-amount" className="text-xs font-medium text-text-muted">
            Amount received ($)
          </label>
          <input id="pf-amount" name="amount" type="number" step="0.01" min="0.01" required className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums focus:border-brand-primary focus:outline-none" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pf-date" className="text-xs font-medium text-text-muted">
            Date received
          </label>
          <input
            id="pf-date"
            name="dateReceived"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pf-method" className="text-xs font-medium text-text-muted">
            Method
          </label>
          <input id="pf-method" name="method" placeholder="Tremendous, PayPal…" className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pf-notes" className="text-xs font-medium text-text-muted">
          Notes
        </label>
        <input id="pf-notes" name="notes" className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="self-start rounded-base bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60">
          {isPending ? "Recording…" : "Record payment"}
        </button>
        {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
      </div>
      <p className="text-xs text-text-muted">
        Applied automatically, oldest unpaid day first, up through the date received — whatever&rsquo;s left over is flagged as
        unallocated for you to review.
      </p>
    </form>
  );
}
