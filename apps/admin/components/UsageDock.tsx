"use client";

import { useCallback, useEffect, useState } from "react";
import type { UsageStatus } from "@/lib/ai/usageStatus";

/** Ask the box to re-read the limits (call after an AI/search action finishes). */
export function refreshUsage() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("usage:refresh"));
}

const nf = new Intl.NumberFormat("en-US");

function untilText(iso: string, now: number): string {
  const mins = Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

type Level = "ok" | "warn" | "bad";
const LEVEL_BAR: Record<Level, string> = { ok: "bg-brand-primary", warn: "bg-amber-500", bad: "bg-red-500" };
const LEVEL_DOT: Record<Level, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500" };
const levelFor = (ratio: number): Level => (ratio >= 0.9 ? "bad" : ratio >= 0.7 ? "warn" : "ok");

function Meter({ ratio, level }: { ratio: number; level: Level }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/70" role="presentation">
      <div className={`h-full rounded-full transition-all ${LEVEL_BAR[level]}`} style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%` }} />
    </div>
  );
}

const ICONS = {
  search: "M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM13.5 13.5l3 3",
  ai: "M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6L10 2.5ZM15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z",
  image: "M3.5 5.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9ZM3.5 13l3.8-3.8 3 3 2-2 3.7 3.8M13 8.2h.01",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/**
 * Always-visible "AI limits" box (bottom-right on every admin page): web-search
 * credits left, Groq daily limit status, and image generations. Collapsed it
 * shows three short stats; click to see the meters.
 */
export function UsageDock() {
  const [data, setData] = useState<UsageStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/usage", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData((await res.json()) as UsageStatus);
      setFailed(false);
      setNow(Date.now());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const poll = setInterval(() => void load(), 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const onRefresh = () => void load();
    window.addEventListener("usage:refresh", onRefresh);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener("usage:refresh", onRefresh);
    };
  }, [load]);

  if (!data) {
    return failed ? null : <div data-print-hide className="fixed bottom-4 right-4 z-40 h-9 w-40 animate-pulse rounded-full border border-border bg-white shadow-lg" />;
  }

  const s = data.search;
  const searchLeft = s.used != null && s.limit != null ? Math.max(0, s.limit - s.used) : null;
  const searchRatio = s.used != null && s.limit ? s.used / s.limit : 0;
  const searchLevel = levelFor(searchRatio);
  const g = data.groq;
  const groqBlocked = g.blocked && g.blockedUntil && new Date(g.blockedUntil).getTime() > now;
  const groqTop = g.models[0];
  const groqRatio = groqTop?.dayLimit ? groqTop.tokens / groqTop.dayLimit : 0;
  const groqLevel: Level = groqBlocked ? "bad" : levelFor(groqRatio);
  const im = data.images;
  const imRatio = im.dailyLimit ? im.today / im.dailyLimit : 0;
  const overall: Level = [searchLevel, groqLevel, im.dailyLimit ? levelFor(imRatio) : "ok"].includes("bad") ? "bad" : [searchLevel, groqLevel].includes("warn") ? "warn" : "ok";

  return (
    <div data-print-hide className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {open && (
        <div className="w-[22rem] max-w-full rounded-2xl border border-border bg-white p-4 shadow-[0_12px_40px_-8px_rgba(16,24,20,0.25)]" role="dialog" aria-label="AI and search limits">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-text">AI &amp; search limits</p>
            <button type="button" onClick={() => void load()} className="text-xs font-semibold text-brand-primary hover:underline">
              Refresh
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <section>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-text">
                  <Icon name="search" /> Web search
                </span>
                <span className="text-xs text-text-muted">{s.plan ? `${s.plan} plan` : "Tavily"}</span>
              </div>
              {!s.configured ? (
                <p className="text-xs text-text-muted">No search key set.</p>
              ) : s.used != null && s.limit != null ? (
                <>
                  <Meter ratio={searchRatio} level={searchLevel} />
                  <p className="mt-1.5 text-xs text-text-muted">
                    <span className="font-semibold text-text">{nf.format(searchLeft ?? 0)} credits left</span> · {nf.format(s.used)} of {nf.format(s.limit)} used this month
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-muted">{s.error ? `Couldn’t read usage (${s.error}).` : s.used != null ? `${nf.format(s.used)} credits used (no cap on this plan).` : "Usage unavailable."}</p>
              )}
            </section>

            <section>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-text">
                  <Icon name="ai" /> AI model (Groq)
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${groqBlocked ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {groqBlocked ? "Limit reached" : g.configured ? "Available" : "No key"}
                </span>
              </div>
              {groqBlocked && g.blockedUntil && (
                <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  Groq says the daily limit is used up. Works again in <span className="font-semibold">{untilText(g.blockedUntil, now)}</span>. Other models have their own limit, so switching the model on “AI Models” also works.
                </p>
              )}
              {g.models.length === 0 ? (
                <p className="text-xs text-text-muted">No AI calls counted today.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {g.models.slice(0, 4).map((m) => {
                    const used = m.blockedUntil && m.limitKind === "day" && m.limitUsed ? Math.max(m.limitUsed, m.tokens) : m.tokens;
                    const ratio = m.dayLimit ? used / m.dayLimit : 0;
                    return (
                      <li key={m.model}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-text" title={m.model}>
                            {m.model.replace(/^openai\//, "")}
                          </span>
                          <span className="shrink-0 tabular-nums text-text-muted">
                            {nf.format(used)}
                            {m.dayLimit ? ` / ${nf.format(m.dayLimit)}` : ""} tokens
                          </span>
                        </div>
                        {m.dayLimit ? <Meter ratio={ratio} level={m.blockedUntil ? "bad" : levelFor(ratio)} /> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-1.5 text-[11px] leading-snug text-text-muted">Counted from this app’s calls today; the daily limit counts everything on the same Groq key.</p>
            </section>

            <section>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-text">
                  <Icon name="image" /> Image generation
                </span>
                <span className="text-xs text-text-muted">{im.provider}</span>
              </div>
              {im.dailyLimit ? <Meter ratio={imRatio} level={levelFor(imRatio)} /> : null}
              <p className="mt-1.5 text-xs text-text-muted">
                <span className="font-semibold text-text">{im.today} today</span> · {im.month} this month
                {im.dailyLimit ? ` · limit ${im.dailyLimit}/day` : ""}
              </p>
              {!im.dailyLimit && <p className="text-[11px] leading-snug text-text-muted">The provider doesn’t publish a live counter. Set AI_IMAGE_DAILY_LIMIT to see a meter.</p>}
            </section>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-full border border-border bg-white/95 py-2 pl-3 pr-4 text-xs shadow-[0_6px_24px_-6px_rgba(16,24,20,0.3)] backdrop-blur transition-colors hover:bg-white"
      >
        <span className={`h-2 w-2 rounded-full ${LEVEL_DOT[overall]}`} aria-hidden="true" />
        <span className="flex items-center gap-1.5 text-text-muted" title="Web-search credits left">
          <Icon name="search" />
          <b className="font-semibold tabular-nums text-text">{searchLeft != null ? nf.format(searchLeft) : "—"}</b>
        </span>
        <span className="flex items-center gap-1.5 text-text-muted" title="Groq AI daily limit">
          <Icon name="ai" />
          <b className={`font-semibold ${groqBlocked ? "text-red-600" : "text-text"}`}>{groqBlocked && g.blockedUntil ? untilText(g.blockedUntil, now) : groqTop?.dayLimit ? `${Math.round(groqRatio * 100)}%` : "OK"}</b>
        </span>
        <span className="flex items-center gap-1.5 text-text-muted" title="Images generated today">
          <Icon name="image" />
          <b className="font-semibold tabular-nums text-text">{im.today}</b>
        </span>
      </button>
    </div>
  );
}
