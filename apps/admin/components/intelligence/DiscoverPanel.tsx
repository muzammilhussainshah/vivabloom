"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RESEARCH_CATEGORIES, RESEARCH_COUNTRIES, getResearchCountry } from "@monocoupon/validation";
import { Select, Spinner } from "@/components/ui/client";
import type { DiscoveredStore, DiscoveryHistoryItem } from "@/lib/intelligence/discover";
import { Pill, VerdictPill, hostAndPath, timeAgo } from "./ui";

const fieldClass = "h-10 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-text focus:border-brand-primary focus:outline-none";

type ShownStore = DiscoveredStore & { foundIn?: string[] };

export interface DiscoverView {
  /** A saved search id, or "all" for every store found so far. */
  id: string;
  title: string;
  subtitle: string;
  stores: ShownStore[];
  /** Only for a single saved search: lets "Search again" re-run it. */
  params: { country: string; category: string; keyword: string | null } | null;
}

/**
 * "Find new stores": a search form, the history of every saved search (each
 * reopens for free), and the stores of the selected search.
 */
export function DiscoverPanel({ history, view, totalFound }: { history: DiscoveryHistoryItem[]; view: DiscoverView | null; totalFound: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unchecked" | "checked">("all");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function search(params: { country: string; category: string; keyword: string | null }, force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, force }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Search failed");
      router.push(`/intelligence?tab=find&search=${json.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function check(store: ShownStore) {
    if (store.check) {
      router.push(`/intelligence/${store.check.id}`);
      return;
    }
    setStarting(store.name);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: store.domain ?? store.name, country: view?.params?.country ?? "us" }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Could not start the check");
      router.push(`/intelligence/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the check");
      setStarting(null);
    }
  }

  async function remove(item: DiscoveryHistoryItem) {
    if (!confirm(`Delete the saved search “${item.category}${item.keyword ? ` · ${item.keyword}` : ""}”? Store reports you already ran are kept.`)) return;
    setDeleting(item.id);
    try {
      await fetch(`/api/intelligence/discover/${item.id}`, { method: "DELETE" });
      router.push(view?.id === item.id ? "/intelligence?tab=find" : `/intelligence?tab=find${view ? `&search=${view.id}` : ""}`);
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  const stores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (view?.stores ?? []).filter((s) => {
      if (filter === "checked" && !s.check) return false;
      if (filter === "unchecked" && s.check) return false;
      return !q || s.name.toLowerCase().includes(q) || (s.domain ?? "").includes(q);
    });
  }, [view, filter, query]);
  const checkedCount = (view?.stores ?? []).filter((s) => s.check).length;

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void search({ country: String(d.get("country")), category: String(d.get("category")), keyword: String(d.get("keyword") ?? "").trim() || null });
        }}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,20,0.04)] md:p-5"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
            Market
            <Select name="country" defaultValue={view?.params?.country ?? "us"} className="w-full">
              {RESEARCH_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
            Category
            <Select name="category" defaultValue={view?.params?.category ?? RESEARCH_CATEGORIES[0]} className="w-full">
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
        </div>
        <p className="text-xs text-text-muted">A search you&apos;ve run before opens from history for free. Only a new market/category/focus uses web-search credits (about 3).</p>
      </form>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-12 text-center text-sm text-text-muted">
          Pick a market and category above to find brands with affiliate programs. Every search is saved here so you never pay for it twice.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Search history</p>
            <Link
              href="/intelligence?tab=find&search=all"
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                view?.id === "all" ? "border-brand-primary/40 bg-brand-primary/10 font-semibold text-brand-primary" : "border-border bg-white text-text hover:border-brand-primary/30"
              }`}
            >
              <span>All found stores</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ring-border">{totalFound}</span>
            </Link>
            <ul className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto pr-1">
              {history.map((h) => {
                const active = view?.id === h.id;
                return (
                  <li key={h.id} className="group relative">
                    <Link
                      href={`/intelligence?tab=find&search=${h.id}`}
                      className={`block rounded-xl border px-3 py-2.5 pr-9 transition-colors ${
                        active ? "border-brand-primary/40 bg-brand-primary/10" : "border-border bg-white hover:border-brand-primary/30"
                      }`}
                    >
                      <p className={`truncate text-sm font-semibold ${active ? "text-brand-primary" : "text-text"}`}>
                        {h.category}
                        {h.keyword ? ` · ${h.keyword}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {getResearchCountry(h.country)?.name ?? h.country.toUpperCase()} · {h.count} stores · {h.checked} checked
                      </p>
                      <p className="text-[11px] text-text-muted">{timeAgo(h.updatedAt)}</p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(h)}
                      disabled={deleting === h.id}
                      title="Delete this saved search"
                      aria-label={`Delete saved search ${h.category}`}
                      className="absolute right-2 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      {deleting === h.id ? <Spinner className="h-3.5 w-3.5" /> : "×"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="flex min-w-0 flex-col gap-3">
            {view ? (
              <>
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-text">{view.title}</h2>
                    <p className="text-xs text-text-muted">
                      {view.subtitle} · {checkedCount} of {view.stores.length} already checked
                    </p>
                  </div>
                  {view.params && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Run this search again for fresh results? This uses about 3 web-search credits.")) void search(view.params as NonNullable<DiscoverView["params"]>, true);
                      }}
                      disabled={busy}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-white px-3 text-sm font-semibold text-text hover:bg-surface disabled:opacity-60"
                    >
                      {busy ? <Spinner /> : "↻"} Search again
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["all", `All (${view.stores.length})`],
                      ["unchecked", `Not checked (${view.stores.length - checkedCount})`],
                      ["checked", `Checked (${checkedCount})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
                        filter === key ? "bg-text text-white" : "bg-white text-text-muted ring-1 ring-inset ring-border hover:text-text"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by name…"
                    className="ml-auto h-8 w-full rounded-full border border-border bg-white px-3 text-xs text-text focus:border-brand-primary focus:outline-none sm:w-48"
                  />
                </div>

                {stores.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-text-muted">No stores match this filter.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {stores.map((s) => (
                      <li key={`${s.domain ?? s.name}`} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-md">
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-semibold text-text">{s.name}</p>
                            {s.check ? <VerdictPill verdict={s.check.verdict} /> : <Pill tone="muted" dot={false}>Not checked</Pill>}
                          </div>
                          <p className="truncate text-xs text-text-muted">{s.domain ?? "Website will be looked up"}</p>
                          {s.note && <p className="mt-2 line-clamp-2 text-xs text-text">{s.note}</p>}
                          {s.foundIn && s.foundIn.length > 0 && (
                            <p className="mt-2 line-clamp-2 text-[11px] text-text-muted">Found in: {s.foundIn.join(" · ")}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-text-muted hover:text-brand-primary" title={s.sourceTitle}>
                            Source: {hostAndPath(s.sourceUrl).split("/")[0]} ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => void check(s)}
                            disabled={Boolean(starting)}
                            title={s.check ? "Opens the saved report — no credits" : "Runs a full check — about 7 web-search credits"}
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-60 ${
                              s.check ? "bg-surface text-text ring-1 ring-inset ring-border hover:bg-white" : "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15"
                            }`}
                          >
                            {starting === s.name && <Spinner className="h-3.5 w-3.5" />}
                            {s.check ? `View report · ${s.check.trust}` : "Check store"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-text-muted">Pick a saved search on the left.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
