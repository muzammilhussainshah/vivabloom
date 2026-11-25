"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/client";

/** Re-fetches the free popularity history (Tranco) for this report. */
export function TrafficRefreshButton({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/check/${checkId}/traffic`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not refresh");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-red-600">{error}</span> : null}
      <button type="button" onClick={() => void run()} disabled={busy} className="inline-flex items-center gap-1.5 font-semibold text-brand-primary hover:underline disabled:opacity-60" data-print-hide>
        {busy ? <Spinner className="h-3 w-3" /> : <span aria-hidden>↻</span>}
        {busy ? "Refreshing…" : "Refresh"}
      </button>
    </span>
  );
}
