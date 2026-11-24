"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/client";

/**
 * For terms that aren't public (network dashboards need a login): paste them
 * here and they're analysed with the same quote-checked extraction.
 */
export function PasteTerms({ checkId, alreadyPasted, defaultOpen }: { checkId: string; alreadyPasted: string | null; defaultOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyse() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/check/${checkId}/terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      setText("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-brand-primary hover:underline">
        {alreadyPasted ? `Update the pasted terms (added ${new Date(alreadyPasted).toLocaleDateString("en-GB")})` : "Have the program terms? Paste them to check the rules →"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-primary/25 bg-brand-primary/[0.04] p-4">
      <div>
        <p className="text-sm font-semibold text-text">Paste the affiliate program terms</p>
        <p className="text-xs text-text-muted">
          Copy them from the network dashboard (Awin, Impact, Social Snowball…) or the welcome email. Rules found here are quote-checked the same way and marked “from your
          pasted terms”.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste the full program terms / publisher policy here…"
        className="w-full rounded-[10px] border border-border bg-white p-3 text-sm text-text focus:border-brand-primary focus:outline-none"
        disabled={busy}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-text-muted">{text.trim().length.toLocaleString()} characters</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-[10px] px-3 text-sm font-semibold text-text-muted hover:text-text" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={analyse}
            disabled={busy || text.trim().length < 200}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {busy && <Spinner />}
            {busy ? "Analysing…" : "Analyse terms"}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
