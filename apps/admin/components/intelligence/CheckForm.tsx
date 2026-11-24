"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RESEARCH_COUNTRIES } from "@monocoupon/validation";
import { Select, Spinner } from "@/components/ui/client";
import { SearchIcon } from "@/components/ui";

/** The big "paste a store" box on the Store Checker home page. */
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Store link or brand name</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            name="query"
            autoFocus
            autoComplete="off"
            placeholder="Paste a store link or type a brand — e.g. kittyspout.com"
            className="h-14 w-full rounded-xl border border-border bg-white pl-12 pr-4 text-base text-text shadow-[0_1px_2px_rgba(16,24,20,0.05)] placeholder:text-text-muted/70 focus:border-brand-primary focus:outline-none"
            disabled={busy}
          />
        </label>
        <div className="flex gap-2">
          <div className="w-44">
            <Select name="country" defaultValue="us" aria-label="Target market" className="!h-14 w-full !rounded-xl">
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
            className="inline-flex h-14 shrink-0 items-center gap-2 rounded-xl bg-brand-primary px-6 text-base font-semibold text-white shadow-sm shadow-brand-primary/30 transition-colors hover:bg-brand-primary-hover disabled:opacity-70"
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
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          Affiliate links and Google Ads links work too — tracking parameters are removed and used to detect the affiliate network.
        </p>
      )}
    </form>
  );
}
