"use client";

import { useActionState, useState } from "react";
import { markLost, type ActionState } from "./actions";

export function LostForm({ stores, returnTo }: { stores: { id: string; name: string; pendingLabel: string }[]; returnTo: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(markLost, undefined);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-base border border-border bg-surface p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-brand-secondary hover:underline">
        {open ? "Hide" : "Write off a store as lost"}
      </button>
      {open && (
        <form
          action={formAction}
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            if (!confirm("This permanently marks pending earnings as unrecoverable. Continue?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="lf-store" className="text-xs font-medium text-text-muted">
                Store
              </label>
              <select id="lf-store" name="store" required defaultValue="" className="rounded-base border border-border bg-surface px-3 py-2 text-sm">
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
              <label htmlFor="lf-amount" className="text-xs font-medium text-text-muted">
                Amount ($, blank = all pending)
              </label>
              <input id="lf-amount" name="amount" type="number" step="0.01" min="0.01" className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="lf-date" className="text-xs font-medium text-text-muted">
                Date
              </label>
              <input id="lf-date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-base border border-border bg-surface px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lf-reason" className="text-xs font-medium text-text-muted">
              Reason
            </label>
            <input id="lf-reason" name="reason" placeholder="Store went unreachable, stopped responding…" className="rounded-base border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={isPending} className="self-start rounded-base bg-brand-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary-hover disabled:opacity-60">
              {isPending ? "Writing off…" : "Mark as lost"}
            </button>
            {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
