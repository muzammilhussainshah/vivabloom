"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { refreshUsage } from "@/components/UsageDock";
import { useDialogs } from "@/components/ui/Dialogs";
import { RESEARCH_CATEGORIES, RESEARCH_COUNTRIES, STORE_CHECK_STEPS, getResearchCountry } from "@monocoupon/validation";
import { Select, Spinner } from "@/components/ui/client";
import type { DiscoveryHistoryItem, HiddenStore } from "@/lib/intelligence/discover";
import { fieldLabelClass, inputClass, selectClass, timeAgo } from "./ui";
import { FoundStoresTable, MAX_BATCH, type ShownStore } from "./FoundStoresTable";



export interface DiscoverView {
  /** A saved search id, or "all" for every store found so far. */
  id: string;
  title: string;
  subtitle: string;
  stores: ShownStore[];
  /** Brands named by the sources but without affiliate-program evidence. */
  hidden: HiddenStore[];
  /** Saved before results were filtered to affiliate programs. */
  legacy: boolean;
  /** Only for a single saved search: lets "Search again" re-run it. */
  params: { country: string; category: string; keyword: string | null } | null;
}

/**
 * "Find new stores": a search form, the history of every saved search (each
 * reopens for free), and the stores of the selected search.
 */
const SORT_OPTIONS = [
  { value: "lead", label: "Best opportunity" },
  { value: "commission", label: "Highest commission" },
  { value: "popular", label: "Most popular" },
  { value: "name", label: "Name A–Z" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

type BatchItem = { key: string; name: string; status: "waiting" | "running" | "done" | "skipped" | "failed"; detail?: string };

export function DiscoverPanel({ history, view, totalFound, pendingEnrich }: { history: DiscoveryHistoryItem[]; view: DiscoverView | null; totalFound: number; pendingEnrich: number }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unchecked" | "checked">("all");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filtering, setFiltering] = useState(false);
  const [sort, setSort] = useState<SortKey>("lead");
  const [network, setNetwork] = useState("all");
  const [hideBan, setHideBan] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [batch, setBatch] = useState<{ items: BatchItem[]; running: boolean; note: string | null } | null>(null);
  const stopBatch = useRef(false);
  const [gathering, setGathering] = useState(pendingEnrich);

  // Free early signals (network, commission, popularity, ad rules) are filled in the background for stores that don't have them yet.
  useEffect(() => {
    if (pendingEnrich <= 0) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 12 && !cancelled; i++) {
        try {
          const res = await fetch("/api/intelligence/discover/enrich", { method: "POST" });
          const json = (await res.json()) as { done?: number; remaining?: number };
          if (!res.ok) break;
          if (!cancelled) {
            setGathering(json.remaining ?? 0);
            router.refresh();
          }
          if (!json.remaining || !json.done) break;
        } catch {
          break;
        }
      }
      if (!cancelled) setGathering(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingEnrich, router]);

  async function filterLegacy(id: string) {
    setFiltering(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/discover/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Filtering failed — try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Filtering failed");
    } finally {
      setFiltering(false);
    }
  }

  async function search(params: { country: string; category: string; keyword: string | null }, force = false, more = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, force, more }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Search failed");
      router.push(`/intelligence?tab=find&search=${json.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
      refreshUsage();
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
        body: JSON.stringify({ query: store.domain ?? store.name, country: view?.params?.country ?? "us", category: view?.params?.category ?? null }),
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
    const ok = await confirm({
      title: "Delete this saved search?",
      message: <span className="font-medium text-text">{item.category}{item.keyword ? ` · ${item.keyword}` : ""}</span>,
      note: "Store reports you already ran are kept.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(item.id);
    try {
      await fetch(`/api/intelligence/discover/${item.id}`, { method: "DELETE" });
      router.push(view?.id === item.id ? "/intelligence?tab=find" : `/intelligence?tab=find${view ? `&search=${view.id}` : ""}`);
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function runBatch(list: ShownStore[]) {
    const country = view?.params?.country ?? "us";
    const category = view?.params?.category ?? null;
    const ok = await confirm({
      title: `Check ${list.length} ${list.length === 1 ? "store" : "stores"}?`,
      message: "They are checked one after another so the AI limits are respected. You can stop any time; finished reports are kept.",
      note: `Uses about ${list.length * 8} web-search credits (≈8 per store) plus some AI tokens. Check the limits box (bottom right) first.`,
      confirmLabel: `Check ${list.length}`,
    });
    if (!ok) return;
    stopBatch.current = false;
    const items: BatchItem[] = list.map((s) => ({ key: s.domain ?? s.name, name: s.name, status: "waiting" }));
    const update = (i: number, patch: Partial<BatchItem>) => {
      items[i] = { ...items[i]!, ...patch };
      setBatch({ items: [...items], running: true, note: null });
    };
    setBatch({ items: [...items], running: true, note: null });
    let note: string | null = null;
    for (let i = 0; i < list.length; i++) {
      if (stopBatch.current) break;
      const store = list[i]!;
      update(i, { status: "running" });
      try {
        const res = await fetch("/api/intelligence/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: store.domain ?? store.name, country, category }),
        });
        const started = (await res.json()) as { id?: string; reused?: boolean; error?: string };
        if (!res.ok || !started.id) throw new Error(started.error ?? "Could not start");
        if (started.reused) {
          update(i, { status: "skipped", detail: "Already checked" });
          continue;
        }
        for (const step of STORE_CHECK_STEPS) {
          if (stopBatch.current) break;
          const r = await fetch(`/api/intelligence/check/${started.id}/${step}`, { method: "POST" });
          const j = (await r.json().catch(() => ({}))) as { status?: string; error?: string | null };
          if (!r.ok || j.status !== "done") {
            const msg = j.error ?? `Request failed (${r.status})`;
            if (/tokens per day|TPD|rate limit/i.test(msg)) note = "The AI daily limit was reached, so the batch stopped. Re-run the rest when it frees up (see the limits box).";
            throw new Error(msg.slice(0, 140));
          }
        }
        update(i, { status: "done" });
      } catch (err) {
        update(i, { status: "failed", detail: err instanceof Error ? err.message : "Failed" });
        if (note) break;
      }
      refreshUsage();
    }
    setBatch({ items: [...items], running: false, note: note ?? (stopBatch.current ? "Stopped." : null) });
    setPicked([]);
    router.refresh();
    refreshUsage();
  }

  const networks = useMemo(() => [...new Set((view?.stores ?? []).map((x) => x.network).filter((n): n is string => Boolean(n)))].sort(), [view]);
  const stores = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (view?.stores ?? []).filter((s) => {
      if (filter === "checked" && !s.check) return false;
      if (filter === "unchecked" && s.check) return false;
      if (network !== "all" && s.network !== network) return false;
      if (hideBan && (s.warning?.level === "ban" || s.yours?.lostCents)) return false;
      return !q || s.name.toLowerCase().includes(q) || (s.domain ?? "").includes(q);
    });
    const num = (v: number | null | undefined, missing: number) => (v == null ? missing : v);
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "commission") return num(b.commission?.max, -1) - num(a.commission?.max, -1);
      if (sort === "popular") return num(a.rank, Infinity) - num(b.rank, Infinity);
      return (b.lead?.score ?? 0) - (a.lead?.score ?? 0);
    });
  }, [view, filter, query, network, hideBan, sort]);
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
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-end">
          <label className={fieldLabelClass}>
            Market
            <Select name="country" defaultValue={view?.params?.country ?? "us"} className={selectClass}>
              {RESEARCH_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className={fieldLabelClass}>
            Category
            <Select name="category" defaultValue={view?.params?.category ?? RESEARCH_CATEGORIES[0]} className={selectClass}>
              {RESEARCH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
          <label className={fieldLabelClass}>
            <span>
              Focus <span className="font-normal">(optional)</span>
            </span>
            <input name="keyword" maxLength={80} placeholder="e.g. cat water fountain, collagen" className={inputClass} />
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Saved searches · reopen free</p>
            <ul className="flex gap-2 overflow-x-auto pb-1">
              <li className="shrink-0">
                <Link
                  href="/intelligence?tab=find&search=all"
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                    view?.id === "all" ? "border-brand-primary bg-brand-primary/10 font-semibold text-brand-primary" : "border-border bg-white text-text hover:border-brand-primary/40"
                  }`}
                >
                  All found stores
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ring-border">{totalFound}</span>
                </Link>
              </li>
              {history.map((h) => {
                const active = view?.id === h.id;
                return (
                  <li key={h.id} className="group relative shrink-0">
                    <Link
                      href={`/intelligence?tab=find&search=${h.id}`}
                      className={`flex flex-col rounded-2xl border py-1.5 pl-3.5 pr-8 transition-colors ${
                        active ? "border-brand-primary bg-brand-primary/10" : "border-border bg-white hover:border-brand-primary/40"
                      }`}
                    >
                      <span className={`text-sm font-semibold ${active ? "text-brand-primary" : "text-text"}`}>
                        {h.category}
                        {h.keyword ? ` · ${h.keyword}` : ""}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {getResearchCountry(h.country)?.name ?? h.country.toUpperCase()} · {h.count} stores · {h.checked} checked · {timeAgo(h.updatedAt)}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(h)}
                      disabled={deleting === h.id}
                      title="Delete this saved search"
                      aria-label={`Delete saved search ${h.category}`}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      {deleting === h.id ? <Spinner className="h-3.5 w-3.5" /> : "×"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>


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
                    <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Run this search again?",
                          message: "You'll get fresh results and the saved list is replaced.",
                          note: "Uses about 3 web-search credits. Reopening a saved search is free.",
                          confirmLabel: "Search again",
                        });
                        if (ok) void search(view.params as NonNullable<DiscoverView["params"]>, true);
                      }}
                      disabled={busy}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-white px-3 text-sm font-semibold text-text hover:bg-surface disabled:opacity-60"
                    >
                      {busy ? <Spinner /> : "↻"} Search again
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Find more stores?",
                          message: "Searches from other angles — network directories, coupon/PPC-friendly programs, programs that publish their rates — and adds only new brands. Nothing already saved is lost.",
                          note: "Uses about 3 web-search credits.",
                          confirmLabel: "Find more",
                        });
                        if (ok) void search(view.params as NonNullable<DiscoverView["params"]>, false, true);
                      }}
                      disabled={busy}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-brand-primary/10 px-3 text-sm font-semibold text-brand-primary hover:bg-brand-primary/15 disabled:opacity-60"
                    >
                      {busy ? <Spinner /> : "+"} Find more stores
                    </button>
                    </div>
                  )}
                </div>

                {view.legacy && (
                  <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-amber-900">This search was saved before results were limited to stores with an affiliate program.</p>
                    <button
                      type="button"
                      onClick={() => void filterLegacy(view.id)}
                      disabled={filtering}
                      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {filtering && <Spinner />}
                      {filtering ? "Checking their sites…" : "Keep only affiliate programs (free)"}
                    </button>
                  </div>
                )}

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

                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-44">
                    <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort stores" className={selectClass}>
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {networks.length > 0 && (
                    <div className="w-44">
                      <Select value={network} onChange={(e) => setNetwork(e.target.value)} aria-label="Network" className={selectClass}>
                        <option value="all">All networks</option>
                        {networks.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setHideBan((v) => !v)}
                    aria-pressed={hideBan}
                    className={`h-10 rounded-[10px] px-3 text-xs font-semibold ring-1 ring-inset transition-colors ${hideBan ? "bg-red-50 text-red-700 ring-red-200" : "bg-white text-text-muted ring-border hover:text-text"}`}
                    title="Hide stores whose own affiliate page restricts coupon sites / paid search, and stores where you lost money"
                  >
                    {hideBan ? "✓ " : ""}Hide risky signals
                  </button>
                  {gathering > 0 && (
                    <span className="inline-flex items-center gap-2 text-xs text-text-muted">
                      <Spinner className="h-3.5 w-3.5" /> Gathering free signals… {gathering} left
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {picked.length > 0 ? (
                      <>
                        <button type="button" onClick={() => setPicked([])} className="text-xs font-semibold text-text-muted hover:text-text">
                          Clear
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(batch?.running)}
                          onClick={() => void runBatch(stores.filter((x) => picked.includes(x.domain ?? x.name)))}
                          className="inline-flex h-10 items-center rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
                        >
                          Check {picked.length} selected
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPicked(stores.filter((x) => !x.check && x.warning?.level !== "ban" && !x.yours?.lostCents).slice(0, MAX_BATCH).map((x) => x.domain ?? x.name))}
                        className="h-10 rounded-[10px] bg-white px-3 text-xs font-semibold text-text-muted ring-1 ring-inset ring-border hover:text-text"
                        title={`Selects the top ${MAX_BATCH} unchecked stores without warnings`}
                      >
                        Select top {MAX_BATCH} unchecked
                      </button>
                    )}
                  </div>
                </div>

                {batch && (
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text">
                        {batch.running ? "Checking stores…" : "Batch finished"} · {batch.items.filter((i) => i.status === "done" || i.status === "skipped").length}/{batch.items.length}
                      </p>
                      {batch.running ? (
                        <button type="button" onClick={() => (stopBatch.current = true)} className="text-xs font-semibold text-red-600 hover:underline">
                          Stop after this store
                        </button>
                      ) : (
                        <button type="button" onClick={() => setBatch(null)} className="text-xs font-semibold text-text-muted hover:text-text">
                          Close
                        </button>
                      )}
                    </div>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {batch.items.map((i) => (
                        <li key={i.key} className="flex items-center gap-2 text-sm">
                          <span className="w-4 text-center" aria-hidden="true">
                            {i.status === "running" ? <Spinner className="h-3.5 w-3.5" /> : i.status === "done" ? "✓" : i.status === "skipped" ? "•" : i.status === "failed" ? "✕" : "○"}
                          </span>
                          <span className={`truncate ${i.status === "failed" ? "text-red-700" : i.status === "waiting" ? "text-text-muted" : "text-text"}`}>{i.name}</span>
                          {i.detail && <span className="truncate text-xs text-text-muted">· {i.detail}</span>}
                        </li>
                      ))}
                    </ul>
                    {batch.note && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{batch.note}</p>}
                  </div>
                )}

                {stores.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-text-muted">No stores match this filter.</p>
                ) : (
                  <FoundStoresTable stores={stores} picked={picked} onPick={setPicked} starting={starting} onCheck={(s) => void check(s)} />
                )}
                {view.hidden.length > 0 && (
                  <details className="rounded-xl border border-border bg-white px-4 py-3 text-sm">
                    <summary className="cursor-pointer text-text-muted">
                      <span className="font-semibold text-text">{view.hidden.length} brands hidden</span> — no affiliate program found in the sources or on their website
                    </summary>
                    <p className="mt-2 text-xs leading-relaxed text-text-muted">
                      {view.hidden.map((h) => (h.domain ? `${h.name} (${h.domain})` : h.name)).join(" · ")}
                    </p>
                  </details>
                )}
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-text-muted">Pick a saved search above.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
