"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RESEARCH_COUNTRIES } from "@monocoupon/validation";
import { Select, Spinner } from "@/components/ui/client";
import { SearchIcon } from "@/components/ui";

/** The "paste a store" search bar on the Store Checker home page: one control — input, market, button. */
export function CheckForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const query = String(data.get("query") ?? "").trim();
    if (query.length < 2) {
      setError("Paste a store link or type a brand name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, country: String(data.get("country") || "us") }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Could not start the check.");
      router.push(`/intelligence/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the check.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-2 shadow-[0_1px_2px_rgba(16,24,20,0.05),0_8px_24px_-12px_rgba(16,24,20,0.12)] transition-shadow focus-within:border-brand-primary/50 focus-within:ring-4 focus-within:ring-brand-primary/10 md:flex-row md:items-center md:gap-0">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Store link or brand name</span>
          <SearchIcon className="pointer-events-none absolute left-3.5 h-5 w-5 text-text-muted" />
          <input
            name="query"
            autoFocus
            autoComplete="off"
            placeholder="Paste a store link or type a brand — e.g. kittyspout.com"
            className="h-12 w-full rounded-xl border-0 bg-transparent pl-11 pr-3 text-[15px] text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-0"
            style={{ boxShadow: "none" }}
            disabled={busy}
          />
        </label>
        <span className="hidden h-7 w-px bg-border md:block" aria-hidden="true" />
        <div className="flex gap-2 md:pl-2">
          <div className="flex-1 md:w-48 md:flex-none">
            <Select
              name="country"
              defaultValue="us"
              aria-label="Market for prices"
              className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text hover:border-text-muted/40 md:border-transparent md:bg-transparent md:hover:bg-surface"
            >
              {RESEARCH_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-[15px] font-semibold text-white shadow-sm shadow-brand-primary/30 transition-colors hover:bg-brand-primary-hover disabled:opacity-70"
          >
            {busy ? (
              <>
                <Spinner className="h-5 w-5" />
                Starting…
              </>
            ) : (
              "Check store"
            )}
          </button>
        </div>
      </div>
      {error ? (
        <p className="text-center text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-center text-xs text-text-muted">Affiliate and Google Ads links work too — tracking is removed and used to detect the affiliate network.</p>
      )}
    </form>
  );
}
