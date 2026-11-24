"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/client";
import { buttonStyles } from "@/components/ui";

/** Re-runs every research step for this store (spends web-search credits again). */
export function RecheckButton({ domain, country }: { domain: string; country: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recheck() {
    if (!confirm("Re-check this store from scratch? This uses about 8–10 web-search credits.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: domain, country: country ?? "us", force: true }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Re-check failed");
      // A full navigation remounts the runner so it picks up the reset steps.
      window.location.assign(`/intelligence/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-check failed");
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={recheck} disabled={busy} className={buttonStyles.secondary}>
        {busy ? <Spinner /> : <span aria-hidden="true">↻</span>}
        Re-check
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
