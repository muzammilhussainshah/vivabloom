"use client";

import { useActionState, useState } from "react";
import { importEntries, type ActionState } from "./actions";

export function ImportForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(importEntries, undefined);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-base border border-border bg-surface p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-brand-primary hover:underline">
        {open ? "Hide bulk import" : "Bulk import from a spreadsheet"}
      </button>
      {open && (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-text-muted">
            Paste rows copied straight from Google Sheets (or comma-separated): <code>Date, Store, Spent, Earned[, Notes]</code> — one
            per line. Store names must match an existing store exactly (case-insensitive). Re-pasting a store/date you already imported
            updates that day rather than duplicating it.
          </p>
          <textarea
            name="csv"
            rows={6}
            required
            placeholder={"July 28, Tabs, 173.00, 136.22\nJuly 28, Ekster, 14.31, 28.67"}
            className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-xs focus:border-brand-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-base border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
          >
            {isPending ? "Importing…" : "Import rows"}
          </button>
          {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
          {state?.success && <p className="text-sm text-brand-accent">{state.success}</p>}
        </form>
      )}
    </div>
  );
}
