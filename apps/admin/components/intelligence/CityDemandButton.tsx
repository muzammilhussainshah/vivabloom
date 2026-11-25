"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/client";

/** Loads / refreshes city demand from Google Ads Keyword Planner (no search credits). */
export function CityDemandButton({ checkId, refresh = false }: { checkId: string; refresh?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/check/${checkId}/cities`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load city demand.");
      start(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load city demand.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2" data-print-hide>
      <button
        type="button"
        onClick={() => void load()}
        disabled={busy}
        className={
          refresh
            ? "inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-white px-3 text-sm font-semibold text-text hover:bg-surface disabled:opacity-60"
            : "inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
        }
      >
        {busy && <Spinner className="h-4 w-4" />}
        {busy ? "Asking Google Ads…" : refresh ? "↻ Refresh" : "Load city demand"}
      </button>
      {error && (
        <p className="max-w-xl rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
