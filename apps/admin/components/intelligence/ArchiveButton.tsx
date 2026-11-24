"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/components/ui";

const ICON = {
  archive: "M3.5 5.5h13v3h-13zM4.5 8.5v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-7M8 11.5h4",
  restore: "M4 10a6 6 0 1 0 2-4.5M4 3.5v3h3",
} as const;

/** Archive (hide from the main lists) or restore a store. `variant="icon"` is the compact row action; "button" is for the report header. */
export function ArchiveButton({ id, archived, variant = "icon", onDone }: { id: string; archived: boolean; variant?: "icon" | "button"; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = archived ? "Restore" : "Archive";

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/check/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: !archived }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Failed");
      onDone?.();
      start(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const icon = (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d={ICON[archived ? "restore" : "archive"]} />
    </svg>
  );

  if (variant === "button") {
    return (
      <button type="button" onClick={toggle} disabled={pending} className={buttonStyles.secondary} title={error ?? (archived ? "Move back to the main list" : "Hide from the main list — keeps the report")}>
        {icon}
        {pending ? "…" : label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={`${label} store`}
      title={error ?? `${label} — ${archived ? "move back to the main list" : "hide from the main list, the report is kept"}`}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-50"
    >
      {icon}
    </button>
  );
}
