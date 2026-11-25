"use client";

import { useState } from "react";
import type { TrafficResult } from "@/lib/intelligence/types";

/**
 * 30-day popularity chart (inline SVG, no chart library). A LOWER rank number
 * is better, so the axis is inverted: the line going UP means the site is
 * getting more popular. Hover (or tap) a day to see its exact rank.
 */
export function TrafficChart({ history, average }: { history: TrafficResult["history"]; average?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (history.length < 2) return null;
  const W = 640;
  const H = 200;
  const padL = 56;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const ranks = history.map((h) => h.rank);
  const lo = Math.min(...ranks);
  const hi = Math.max(...ranks);
  const span = Math.max(1, hi - lo);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i: number) => padL + (i / (history.length - 1)) * plotW;
  // Inverted: best (smallest) rank at the top.
  const y = (r: number) => padT + ((r - lo) / span) * plotH * 0.88 + plotH * 0.06;
  const pts = history.map((h, i) => `${x(i).toFixed(1)},${y(h.rank).toFixed(1)}`);
  const area = `M${x(0).toFixed(1)},${H - padB} L${pts.join(" L")} L${x(history.length - 1).toFixed(1)},${H - padB} Z`;
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const dates = [history[0]!, history[Math.floor(history.length / 2)]!, history[history.length - 1]!];
  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const lastI = history.length - 1;
  const bestI = ranks.indexOf(lo);
  const worstI = ranks.lastIndexOf(hi);

  const h = hover != null ? history[hover]! : null;
  const prev = hover != null && hover > 0 ? history[hover - 1]! : null;
  const dayMove = h && prev ? Math.round(((prev.rank - h.rank) / prev.rank) * 1000) / 10 : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - padL) / plotW) * (history.length - 1));
    setHover(Math.max(0, Math.min(history.length - 1, i)));
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label="Popularity rank over the last 30 days; higher on the chart is more popular"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="trafficFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" strokeDasharray="3 4" />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="currentColor" className="text-text-muted">
              #{fmt(t)}
            </text>
          </g>
        ))}
        {average != null && average > lo && average < hi ? (
          <g>
            <line x1={padL} x2={W - padR} y1={y(average)} y2={y(average)} stroke="#d97706" strokeOpacity="0.7" strokeDasharray="6 4" strokeWidth="1.25" />
            <text x={W - padR} y={y(average) - 5} textAnchor="end" fontSize="10" fill="#b45309">
              30-day avg #{fmt(average)}
            </text>
          </g>
        ) : null}
        <path d={area} fill="url(#trafficFill)" />
        <polyline points={pts.join(" ")} fill="none" stroke="var(--brand-primary)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {bestI !== lastI ? <circle cx={x(bestI)} cy={y(lo)} r="4" fill="#fff" stroke="#059669" strokeWidth="2" /> : null}
        {worstI !== lastI ? <circle cx={x(worstI)} cy={y(hi)} r="4" fill="#fff" stroke="#dc2626" strokeWidth="2" /> : null}
        <circle cx={x(lastI)} cy={y(history[lastI]!.rank)} r="4.5" fill="var(--brand-primary)" stroke="#fff" strokeWidth="2" />
        {h && hover != null ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="currentColor" className="text-text-muted" strokeOpacity="0.5" />
            <circle cx={x(hover)} cy={y(h.rank)} r="5" fill="var(--brand-primary)" stroke="#fff" strokeWidth="2" />
          </g>
        ) : null}
        {dates.map((d, i) => (
          <text key={d.date} x={i === 0 ? padL : i === 1 ? (padL + W - padR) / 2 : W - padR} y={H - 6} textAnchor={i === 0 ? "start" : i === 1 ? "middle" : "end"} fontSize="10.5" fill="currentColor" className="text-text-muted">
            {shortDate(d.date)}
          </text>
        ))}
      </svg>
      {h && hover != null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}
        >
          <p className="font-semibold text-text">{new Date(h.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
          <p className="mt-0.5 tabular-nums text-text">Rank #{h.rank.toLocaleString()}</p>
          {dayMove != null ? (
            <p className={`tabular-nums ${dayMove > 0 ? "text-emerald-600" : dayMove < 0 ? "text-red-600" : "text-text-muted"}`}>
              {dayMove > 0 ? "▲" : dayMove < 0 ? "▼" : "•"} {Math.abs(dayMove)}% vs day before
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TrafficLegend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-600 bg-white" />Best day</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-red-600 bg-white" />Worst day</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-amber-600" />30-day average</span>
      <span>Hover the chart for each day&apos;s rank</span>
    </div>
  );
}
