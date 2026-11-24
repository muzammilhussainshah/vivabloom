"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RESEARCH_CATEGORIES, RESEARCH_COUNTRIES } from "@monocoupon/validation";
import { Select, Spinner } from "@/components/ui/client";
import type { DiscoveredStore } from "@/lib/intelligence/discover";
import { VerdictPill, hostAndPath, timeAgo } from "./ui";

const fieldClass =
  "h-10 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-text focus:border-brand-primary focus:outline-none";

/** "Find new stores": market + category → brands named in web sources, each one click away from a full check. */
export function DiscoverPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ stores: DiscoveredStore[]; cached: boolean; createdAt: string } | null>(null);
  const [last, setLast] = useState<{ country: string; category: string; keyword: string } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  async function search(params: { country: string; category: string; keyword: string }, force = false) {
    setBusy(true);
    setError(null);
    setLast(params);
    try {
      const res = await fetch("/api/intelligence/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, keyword: params.keyword || null, force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function check(store: DiscoveredStore) {
    if (store.check) {
      router.push(`/intelligence/${store.check.id}`);
      return;
    }
    setStarting(store.name);
    try {
      const res = await fetch("/api/intelligence/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: store.domain ?? store.name, country: last?.country ?? "us" }),
      });
      const json = await res.json();
      if (!res.ok || !json.id) throw new Error(json.error ?? "Could not start the check");
      router.push(`/intelligence/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the check");
      setStarting(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void search({ country: String(d.get("country")), category: String(d.get("category")), keyword: String(d.get("keyword") ?? "").trim() });
        }}
        className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,20,0.04)] md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end md:p-5"
      >
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
          Market
          <Select name="country" defaultValue="us" className="w-full">
            {RESEARCH_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
          Category
          <Select name="category" defaultValue={RESEARCH_CATEGORIES[0]} className="w-full">
            {RESEARCH_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
          Focus (optional)
          <input name="keyword" maxLength={80} placeholder="e.g. cat water fountain, collagen" className={fieldClass} />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-70"
        >
          {busy && <Spinner />}
          {busy ? "Searching…" : "Find stores"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {busy && !result && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-white" />
          ))}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
            <span>
              <strong className="text-text">{result.stores.length}</strong> brands found in web sources
              {result.cached ? ` · saved search from ${timeAgo(result.createdAt)}` : ""}
            </span>
            {result.cached && last && (
              <button type="button" onClick={() => void search(last, true)} disabled={busy} className="font-semibold text-brand-primary hover:underline">
                Search again (fresh)
              </button>
            )}
          </div>
          {result.stores.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-text-muted">
              No stores were named in the sources. Try a more specific focus keyword.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.stores.map((s) => (
                <li key={s.name} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-md">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-text">{s.name}</p>
                      {s.check && <VerdictPill verdict={s.check.verdict} />}
                    </div>
                    <p className="truncate text-xs text-text-muted">{s.domain ?? "Website will be looked up"}</p>
                    {s.note && <p className="mt-2 line-clamp-2 text-xs text-text">{s.note}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-text-muted hover:text-brand-primary" title={s.sourceTitle}>
                      Found on {hostAndPath(s.sourceUrl).split("/")[0]} ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => void check(s)}
                      disabled={Boolean(starting)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-primary/10 px-3 text-xs font-semibold text-brand-primary hover:bg-brand-primary/15 disabled:opacity-60"
                    >
                      {starting === s.name && <Spinner className="h-3.5 w-3.5" />}
                      {s.check ? "View report" : "Check store"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
