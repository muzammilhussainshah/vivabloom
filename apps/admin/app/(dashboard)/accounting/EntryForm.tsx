"use client";

import { useActionState, useEffect, useRef } from "react";
import { upsertEntry, type ActionState } from "./actions";

export interface EntryFormInitialData {
  store: string;
  date: string;
  spent: string;
  earned: string;
  notes: string;
}

const EMPTY: EntryFormInitialData = { store: "", date: new Date().toISOString().slice(0, 10), spent: "", earned: "", notes: "" };

export function EntryForm({
  stores,
  initialData,
  returnTo,
  isEditing,
}: {
  stores: { id: string; name: string }[];
  initialData?: EntryFormInitialData;
  returnTo: string;
  isEditing: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(upsertEntry, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const data = initialData ?? EMPTY;

  // Reset back to a blank "add" row once a save completes and we're no longer in edit mode.
  useEffect(() => {
    if (!isPending && !isEditing) formRef.current?.reset();
  }, [isPending, isEditing]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="flex flex-col gap-1 md:col-span-1">
          <label htmlFor="ef-store" className="text-xs font-medium text-text-muted">
            Store
          </label>
          <select
            id="ef-store"
            name="store"
            required
            defaultValue={data.store}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
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
          <label htmlFor="ef-date" className="text-xs font-medium text-text-muted">
            Date
          </label>
          <input
            id="ef-date"
            name="date"
            type="date"
            required
            defaultValue={data.date}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ef-spent" className="text-xs font-medium text-text-muted">
            Spent ($)
          </label>
          <input
            id="ef-spent"
            name="spent"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={data.spent}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ef-earned" className="text-xs font-medium text-text-muted">
            Earned ($)
          </label>
          <input
            id="ef-earned"
            name="earned"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={data.earned}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm tabular-nums focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ef-notes" className="text-xs font-medium text-text-muted">
            Notes
          </label>
          <input
            id="ef-notes"
            name="notes"
            defaultValue={data.notes}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-base bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {isPending ? "Saving…" : isEditing ? "Save changes" : "Add entry"}
        </button>
        {isEditing && (
          <a href={returnTo} className="text-sm text-text-muted hover:underline">
            Cancel edit
          </a>
        )}
        {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
      </div>
      <p className="text-xs text-text-muted">Re-submitting the same store + date updates that day instead of creating a duplicate.</p>
    </form>
  );
}
