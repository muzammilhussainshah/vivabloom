"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/client";
import { StoreLogo } from "./StoreLogo";
import { ArchiveButton } from "./ArchiveButton";
import { Pill, VerdictPill, VERDICT_META, formatMoney, inputClass, scoreTone, selectClass, timeAgo, toneClasses } from "./ui";
import type { StoreRow } from "@/lib/intelligence/rows";

const BOTTOM_RANK = { good: 0, warn: 1, muted: 2, bad: 3 } as const;
const VERDICT_RANK = { good: 0, caution: 1, insufficient: 2, risky: 3 } as const;
const SORTS = [
  { value: "best", label: "Best first" },
  { value: "trust", label: "Highest trust" },
  { value: "recent", label: "Most recent" },
  { value: "name", label: "Name A–Z" },
] as const;
type SortKey = (typeof SORTS)[number]["value"];

const ROW_GRID = "md:grid-cols-[minmax(0,1.5fr)_150px_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_88px]";
const ALL = "all";

function sortRows(rows: StoreRow[], sort: SortKey): StoreRow[] {
  const time = (r: StoreRow) => (r.checkedAt ? new Date(r.checkedAt).getTime() : 0);
  return [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "recent") return time(b) - time(a);
    if (a.trust == null || b.trust == null) return Number(b.trust != null) - Number(a.trust != null) || time(b) - time(a);
    if (sort === "trust") return b.trust - a.trust || (a.risk ?? 0) - (b.risk ?? 0);
    return (
      BOTTOM_RANK[a.bottom?.tone ?? "muted"] - BOTTOM_RANK[b.bottom?.tone ?? "muted"] ||
      VERDICT_RANK[a.verdict ?? "insufficient"] - VERDICT_RANK[b.verdict ?? "insufficient"] ||
      b.trust - a.trust ||
      (a.risk ?? 0) - (b.risk ?? 0)
    );
  });
}

export function StoreList({ rows, tab }: { rows: StoreRow[]; tab: "checked" | "avoid" | "archived" }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(ALL);
  const [verdict, setVerdict] = useState(ALL);
  const [network, setNetwork] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("best");

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category ?? "Uncategorised"))].sort(), [rows]);
  const networks = useMemo(() => [...new Set(rows.flatMap((r) => r.networks))].sort(), [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (needle && !`${r.name} ${r.domain} ${r.top?.name ?? ""} ${r.networks.join(" ")}`.toLowerCase().includes(needle)) return false;
      if (category !== ALL && (r.category ?? "Uncategorised") !== category) return false;
      if (verdict !== ALL && (r.verdict ?? "pending") !== verdict) return false;
      if (network !== ALL && !r.networks.includes(network)) return false;
      return true;
    });
    return sortRows(filtered, sort);
  }, [rows, q, category, verdict, network, sort]);

  const filtering = q.trim() !== "" || category !== ALL || verdict !== ALL || network !== ALL;
  function reset() {
    setQ("");
    setCategory(ALL);
    setVerdict(ALL);
    setNetwork(ALL);
  }

  const catOptions = [{ value: ALL, label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))];
  const verdictOptions = [{ value: ALL, label: "Any verdict" }, ...(Object.keys(VERDICT_META) as (keyof typeof VERDICT_META)[]).map((v) => ({ value: v, label: VERDICT_META[v].short }))];
  const netOptions = [{ value: ALL, label: "All networks" }, ...networks.map((n) => ({ value: n, label: n }))];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-3 shadow-[0_1px_2px_rgba(16,24,20,0.04)] lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 3 3" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search store, product or network…" aria-label="Search stores" className={`${inputClass} pl-9`} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-none">
          <div className="lg:w-44"><Pick value={category} onChange={setCategory} options={catOptions} label="Category" /></div>
          <div className="lg:w-36"><Pick value={verdict} onChange={setVerdict} options={verdictOptions} label="Verdict" /></div>
          <div className="lg:w-40"><Pick value={network} onChange={setNetwork} options={netOptions} label="Network" /></div>
          <div className="lg:w-40"><Pick value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS.map((x) => ({ value: x.value, label: x.label }))} label="Sort" /></div>
        </div>
      </div>

      <div className="flex min-h-6 items-center justify-between gap-2 px-1">
        <p className="text-sm text-text-muted">
          {filtering ? `${shown.length} of ${rows.length} stores` : `${rows.length} ${rows.length === 1 ? "store" : "stores"}`}
        </p>
        {filtering && (
          <button type="button" onClick={reset} className="text-sm font-semibold text-brand-primary hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-text">No stores match</p>
          <p className="mt-1 text-sm text-text-muted">Try a different search or clear the filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)]">
          <div className={`hidden gap-5 border-b border-border bg-surface/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted md:grid ${ROW_GRID}`}>
            <span>Store</span>
            <span>Trust</span>
            <span>Bottom line</span>
            <span>Commission</span>
            <span>Top product</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <Row key={r.id} r={r} tab={tab} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ r, tab }: { r: StoreRow; tab: string }) {
  return (
    <li className="relative">
      <Link href={`/intelligence/${r.id}`} className={`group grid gap-3 px-5 py-4 transition-colors hover:bg-surface/60 md:items-center md:gap-5 ${ROW_GRID}`}>
        <div className="flex min-w-0 items-center gap-3">
          <StoreLogo src={r.logo} domain={r.domain} name={r.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-text group-hover:text-brand-primary">{r.name}</p>
            <p className="truncate text-xs text-text-muted">
              {r.domain} · {timeAgo(r.checkedAt)}
            </p>
            {r.category && <span className="mt-1 inline-block rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text-muted">{r.category}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {r.trust != null && r.verdict ? (
            <>
              <span className={`w-8 text-xl font-bold tabular-nums ${toneClasses[scoreTone(r.trust)].text}`}>{r.trust}</span>
              <VerdictPill verdict={r.verdict} />
            </>
          ) : (
            <Pill tone="muted">{r.doneSteps}/4 steps</Pill>
          )}
        </div>

        <div className="min-w-0">
          {r.bottom ? (
            <p className={`line-clamp-2 text-sm font-semibold leading-snug ${toneClasses[r.bottom.tone].text}`} title={r.bottom.detail}>
              {r.bottom.title}
            </p>
          ) : (
            <span className="text-sm text-text-muted">Research in progress…</span>
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{r.commission ?? <span className="text-text-muted">Unknown</span>}</p>
          <p className="truncate text-xs text-text-muted">{r.networks.length ? r.networks.join(" · ") : "Network unknown"}</p>
        </div>

        <div className="min-w-0 pr-2">
          {r.top ? (
            <>
              <p className="truncate text-sm text-text">{r.top.name}</p>
              <p className="text-xs text-text-muted">{formatMoney(r.top.price, r.top.currency)}</p>
            </>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </div>
        <span className="hidden md:block" aria-hidden="true" />
      </Link>
      <div className="absolute right-4 top-3 flex items-center gap-1 md:right-5 md:top-1/2 md:-translate-y-1/2">
        <ArchiveButton id={r.id} archived={tab === "archived"} />
        <span className="hidden w-4 text-center text-text-muted md:block" aria-hidden="true">→</span>
      </div>
    </li>
  );
}

function Pick({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={selectClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
