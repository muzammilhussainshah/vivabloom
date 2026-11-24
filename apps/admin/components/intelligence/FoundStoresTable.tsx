"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/client";
import type { DiscoveredStore } from "@/lib/intelligence/discover";
import { Pill, VerdictPill, formatMoney, hostAndPath } from "./ui";
import { StoreLogo } from "./StoreLogo";
import { ShortlistButton } from "./ShortlistButton";

/** The admin's own note on a shortlisted store; saved when the field loses focus. */
function MemoField({ name, domain, initial }: { name: string; domain: string | null; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    if (value.trim() === initial.trim()) return;
    setState("saving");
    try {
      const res = await fetch("/api/intelligence/shortlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, domain, memo: value }) });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
      Your note
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={() => void save()}
        rows={2}
        maxLength={1000}
        placeholder="e.g. Ask the Impact manager if PPC on brand terms is allowed"
        className="w-full resize-y rounded-[10px] border border-border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-text focus:border-brand-primary focus:outline-none"
      />
      <span className="h-4 text-[11px] font-normal normal-case tracking-normal">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Couldn’t save — try again" : ""}</span>
    </label>
  );
}

export type ShownStore = DiscoveredStore & { foundIn?: string[]; addedAt?: string };

export const BAND_META = {
  strong: { label: "Strong lead", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  promising: { label: "Promising", cls: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  weak: { label: "Weak lead", cls: "bg-slate-100 text-slate-600 ring-slate-500/15" },
  avoid: { label: "Avoid", cls: "bg-red-50 text-red-700 ring-red-600/20" },
} as const;
export const TIER_LABEL = { very_high: "Very popular", high: "Popular", medium: "Mid-size", low: "Small", unranked: "Not in top 1M" } as const;
export const BAND_TEXT = { strong: "text-emerald-600", promising: "text-sky-600", weak: "text-slate-500", avoid: "text-red-600" } as const;
/** One column template shared by the header and every row so columns line up. */
export const FIND_GRID = "md:grid-cols-[24px_minmax(0,1.7fr)_150px_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.7fr)_150px] grid-cols-[minmax(0,1fr)_auto_auto]";
export const MAX_BATCH = 10;

/**
 * The table of found / shortlisted stores: opportunity, network, commission,
 * popularity and what their affiliate page says about your ads, with a row
 * that opens for the full evidence. Used by "Find new stores" and "Shortlist".
 */
export function FoundStoresTable({
  stores,
  picked,
  onPick,
  starting,
  onCheck,
  withMemo = false,
}: {
  stores: ShownStore[];
  /** Selection for batch checks; omit to hide the checkboxes. */
  picked?: string[];
  onPick?: (next: string[]) => void;
  starting: string | null;
  onCheck: (s: ShownStore) => void;
  /** Show an editable note in the open row (Shortlist). */
  withMemo?: boolean;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const selectable = Boolean(picked && onPick);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)]">
      <div className={`hidden gap-4 border-b border-border bg-surface/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted md:grid ${FIND_GRID}`}>
        <span />
        <span>Store</span>
        <span>Opportunity</span>
        <span>Network · Commission</span>
        <span>Popularity</span>
        <span>Their ad rules</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {stores.map((s) => {
          const key = s.domain ?? s.name;
          const isOpen = expanded.includes(key);
          const w = s.warning;
          const lost = s.yours && s.yours.lostCents > 0;
          return (
            <li key={key} className={isOpen ? "bg-surface/40" : undefined}>
              <div className={`grid items-center gap-x-4 gap-y-2 px-4 py-3.5 ${FIND_GRID}`}>
                <div className="hidden md:block">
                  {selectable && !s.check && (
                    <input
                      type="checkbox"
                      checked={(picked ?? []).includes(key)}
                      disabled={!(picked ?? []).includes(key) && (picked ?? []).length >= MAX_BATCH}
                      onChange={(e) => onPick?.(e.target.checked ? [...(picked ?? []), key] : (picked ?? []).filter((k) => k !== key))}
                      aria-label={`Select ${s.name}`}
                      className="h-4 w-4 accent-[var(--color-brand-primary)]"
                    />
                  )}
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  <StoreLogo src={null} domain={s.domain ?? ""} name={s.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text">{s.name}</p>
                    <p className="truncate text-xs text-text-muted">{s.domain ?? "Website found when checked"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {s.check && <VerdictPill verdict={s.check.verdict} />}
                      {s.yours?.onSite && !lost && <Pill tone="good" dot={false}>On your site</Pill>}
                      {lost && <Pill tone="bad" dot={false}>You lost money here</Pill>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {s.lead ? (
                    <>
                      <span className={`w-9 text-xl font-bold tabular-nums ${BAND_TEXT[s.lead.band]}`}>{s.lead.score}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BAND_META[s.lead.band].cls}`}>{BAND_META[s.lead.band].label}</span>
                    </>
                  ) : (
                    <span className="text-sm text-text-muted">—</span>
                  )}
                </div>

                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-sm font-medium text-text">{s.network ?? <span className="text-text-muted">Network unknown</span>}</p>
                  <p className="truncate text-xs text-text-muted">
                    {s.commission ? `${s.commission.min === s.commission.max ? s.commission.max : `${s.commission.min}–${s.commission.max}`}% commission` : "Rate not stated"}
                  </p>
                </div>

                <div className="hidden min-w-0 md:block">
                  {s.rank != null && s.tier ? (
                    <>
                      <p className="text-sm font-medium tabular-nums text-text">#{s.rank.toLocaleString()}</p>
                      <p className="text-xs text-text-muted">{TIER_LABEL[s.tier]}</p>
                    </>
                  ) : s.tier === "unranked" ? (
                    <p className="text-xs text-text-muted">{TIER_LABEL.unranked}</p>
                  ) : (
                    <span className="text-sm text-text-muted">—</span>
                  )}
                </div>

                <div className="hidden min-w-0 md:block">
                  {w ? (
                    <div title={w.text}>
                      <p className={`text-sm font-semibold ${w.level === "ban" ? "text-red-700" : w.level === "friendly" ? "text-emerald-700" : "text-amber-700"}`}>
                        {w.level === "ban" ? "⚠ Restricts your ads" : w.level === "friendly" ? "✓ Welcomes coupon sites" : "Mentions ad rules"}
                      </p>
                      <p className="line-clamp-1 text-xs italic text-text-muted">“{w.text}”</p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">Nothing on their page — confirm in the full check</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => onCheck(s)}
                    disabled={Boolean(starting)}
                    title={s.check ? "Opens the saved report — no credits" : "Runs a full check — about 8 web-search credits"}
                    className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 text-xs font-semibold disabled:opacity-60 ${
                      s.check ? "bg-white text-text ring-1 ring-inset ring-border hover:bg-surface" : "bg-brand-primary text-white hover:bg-brand-primary-hover"
                    }`}
                  >
                    {starting === s.name && <Spinner className="h-3.5 w-3.5" />}
                    {s.check ? `Report · ${s.check.trust}` : "Check store"}
                  </button>
                  <ShortlistButton name={s.name} domain={s.domain} shortlisted={Boolean(s.shortlisted)} />
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => (e.includes(key) ? e.filter((k) => k !== key) : [...e, key]))}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Hide details" : "Show details"}
                    title="Details"
                    className="flex h-9 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
                      <path d="m5 8 5 5 5-5" />
                    </svg>
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="grid gap-4 border-t border-border/70 px-4 py-4 text-sm md:grid-cols-3 md:pl-[3.25rem]">
                  <div className="md:hidden">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">At a glance</p>
                    <p className="mt-1 text-text">
                      {s.network ?? "Network unknown"} · {s.commission ? `${s.commission.max}%` : "rate not stated"}
                      {s.rank != null ? ` · #${s.rank.toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Affiliate program</p>
                    {s.program ? (
                      <a href={s.program.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-text hover:text-brand-primary" title={s.program.via === "site" ? "Found on the store's own website" : "Stated in the source article"}>
                        {s.program.label.replace(/\s*\(?source\s*\d+\)?/gi, "")} ↗
                      </a>
                    ) : (
                      <p className="mt-1 text-text-muted">{s.note ?? "—"}</p>
                    )}
                    <p className="mt-1 text-xs text-text-muted">{s.program?.via === "site" ? "Found on the store's own website" : "Named in the source article"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">What their page says about your ads</p>
                    {w ? (
                      <a href={w.url} target="_blank" rel="noopener noreferrer" className="mt-1 block italic text-text hover:text-brand-primary">
                        “{w.text}” ↗
                      </a>
                    ) : (
                      <p className="mt-1 text-text-muted">Nothing found about coupon sites, paid search or brand keywords. Many programs only show rules after you log in — the full check reads the terms.</p>
                    )}
                    {lost && s.yours && (
                      <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                        You lost {formatMoney(s.yours.lostCents / 100, "USD")} with this store before (Accounting).
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Where it was found</p>
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-text hover:text-brand-primary" title={s.sourceTitle}>
                      {s.sourceTitle || hostAndPath(s.sourceUrl)} ↗
                    </a>
                    {s.foundIn && s.foundIn.length > 0 && <p className="mt-1 text-xs text-text-muted">Searches: {s.foundIn.join(" · ")}</p>}
                  </div>
                  {withMemo && (
                    <div className="md:col-span-3">
                      <MemoField name={s.name} domain={s.domain} initial={s.memo ?? ""} />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
