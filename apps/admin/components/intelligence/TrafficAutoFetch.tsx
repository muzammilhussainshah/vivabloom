"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/client";

/** For reports made before traffic existed (or when the ranking service was busy): fetches it once, free, then refreshes the page. */
export function TrafficAutoFetch({ checkId }: { checkId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/check/${checkId}/traffic`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load traffic");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load traffic");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  return (
    <div className="flex items-center gap-3 px-5 py-8 text-sm text-text-muted md:px-6">
      {busy ? <Spinner className="h-4 w-4 text-brand-primary" /> : null}
      {busy ? "Loading popularity history…" : error}
      {!busy && (
        <button type="button" onClick={() => void run()} className="font-semibold text-brand-primary hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}
