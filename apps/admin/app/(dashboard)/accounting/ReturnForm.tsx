"use client";

import { useActionState, useState } from "react";
import { markReturned, type ActionState } from "./actions";

export function ReturnForm({ stores, returnTo }: { stores: { id: string; name: string; pendingLabel: string }[]; returnTo: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(markReturned, undefined);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-base border border-border bg-surface p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-brand-primary hover:underline">
        {open ? "Hide" : "Adjust for a customer return"}
      </button>
      {open && (
        <form
          action={formAction}
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            if (!confirm("This removes the commission for a returned/cancelled sale from pending earnings. Continue?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="rf-store" className="text-xs font-medium text-text-muted">
                Store
              </label>
              <select id="rf-store" name="store" required defaultValue="" className="rounded-base border border-border bg-surface px-3 py-2 text-sm">
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
              <label htmlFor="rf-amount" className="text-xs font-medium text-text-muted">
                Commission reversed ($)
              </label>
              <input id="rf-amount" name="amount" type="number" step="0.01" min="0.01" required className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rf-date" className="text-xs font-medium text-text-muted">
                Date
              </label>
              <input id="rf-date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-base border border-border bg-surface px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rf-reason" className="text-xs font-medium text-text-muted">
              Reason
            </label>
            <input id="rf-reason" name="reason" placeholder="Customer returned the order, order cancelled…" className="rounded-base border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={isPending} className="self-start rounded-base bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60">
              {isPending ? "Adjusting…" : "Record return"}
            </button>
            {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
          </div>
          <p className="text-xs text-text-muted">
            Only reduces still-pending earnings, oldest day first. If this commission was already recovered (paid to you), the network
            will deduct it from your next payment instead — just log whatever smaller amount you actually receive.
          </p>
        </form>
      )}
    </div>
  );
}
