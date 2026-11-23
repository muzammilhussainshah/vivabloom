"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { SearchIcon, TrashIcon, iconButtonClass } from "./index";

const fieldClass =
  "h-10 rounded-[10px] border border-border bg-white px-3 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A <select> that submits its GET form as soon as the value changes — no separate "Filter" button. */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
      className={`${fieldClass} min-w-[160px] cursor-pointer pr-8 ${props.className ?? ""}`}
    />
  );
}

/** Search box for a GET form: submits on Enter, with a clear link back to `clearHref`. */
export function SearchField({ name, defaultValue, placeholder, clearHref }: { name: string; defaultValue?: string; placeholder: string; clearHref: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <input type="search" name={name} defaultValue={defaultValue} placeholder={placeholder} className={`${fieldClass} w-full pl-9 pr-9`} />
      {defaultValue && (
        <Link
          href={clearHref}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-text"
          aria-label="Clear search"
        >
          ×
        </Link>
      )}
    </div>
  );
}

/** "Clear filters" link, only rendered when a filter is active. */
export function ClearFilters({ href, active }: { href: string; active: boolean }) {
  if (!active) return null;
  return (
    <Link href={href} className="px-2 text-sm font-medium text-brand-primary hover:underline">
      Clear filters
    </Link>
  );
}

function PendingButton({ className, pendingLabel, children }: { className: string; pendingLabel: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** A server-action form button that shows a spinner while it runs (e.g. "Publish now"). */
export function ActionButton({
  action,
  children,
  pendingLabel = "Working…",
  className = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary/10 disabled:opacity-70",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <form action={action}>
      <PendingButton className={className} pendingLabel={pendingLabel}>
        {children}
      </PendingButton>
    </form>
  );
}

/**
 * Trash icon that opens a confirmation dialog before running the delete
 * server action — the old tables deleted on a single click, with no undo.
 */
export function DeleteButton({ action, itemName, itemType }: { action: () => Promise<void>; itemName: string; itemType: string }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${iconButtonClass} hover:!bg-red-50 hover:!text-red-600`}
        title="Delete"
        aria-label={`Delete ${itemName}`}
      >
        <TrashIcon />
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false); // click on the backdrop
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-white p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        {open && (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <TrashIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Delete {itemType}?</h2>
                <p className="mt-1 text-sm text-text-muted">
                  <span className="font-medium text-text">{itemName}</span> will be permanently deleted and removed from the live site. This can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-[10px] border border-border bg-white px-4 text-sm font-semibold hover:bg-surface"
              >
                Cancel
              </button>
              <form action={action}>
                <PendingButton
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                  pendingLabel="Deleting…"
                >
                  Delete
                </PendingButton>
              </form>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
