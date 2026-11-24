import type { TrafficResult } from "@/lib/intelligence/types";

/**
 * 30-day popularity chart (inline SVG, no chart library). A LOWER rank number
 * is better, so the axis is inverted: the line going UP means the site is
 * getting more popular.
 */
export function TrafficChart({ history }: { history: TrafficResult["history"] }) {
  if (history.length < 2) return null;
  const W = 640;
  const H = 190;
  const padL = 56;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const ranks = history.map((h) => h.rank);
  const lo = Math.min(...ranks);
  const hi = Math.max(...ranks);
  const span = Math.max(1, hi - lo);
  const x = (i: number) => padL + (i / (history.length - 1)) * (W - padL - padR);
  // Inverted: best (smallest) rank at the top.
  const y = (r: number) => padT + ((r - lo) / span) * (H - padT - padB) * 0.88 + (H - padT - padB) * 0.06;
  const pts = history.map((h, i) => `${x(i).toFixed(1)},${y(h.rank).toFixed(1)}`);
  const area = `M${x(0).toFixed(1)},${H - padB} L${pts.join(" L")} L${x(history.length - 1).toFixed(1)},${H - padB} Z`;
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const dates = [history[0]!, history[Math.floor(history.length / 2)]!, history[history.length - 1]!];
  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const last = history[history.length - 1]!;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Popularity rank over the last 30 days; higher on the chart is more popular">
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
      <path d={area} fill="url(#trafficFill)" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--brand-primary)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(history.length - 1)} cy={y(last.rank)} r="4.5" fill="var(--brand-primary)" stroke="#fff" strokeWidth="2" />
      {dates.map((d, i) => (
        <text key={d.date} x={i === 0 ? padL : i === 1 ? (padL + W - padR) / 2 : W - padR} y={H - 6} textAnchor={i === 0 ? "start" : i === 1 ? "middle" : "end"} fontSize="10.5" fill="currentColor" className="text-text-muted">
          {shortDate(d.date)}
        </text>
      ))}
    </svg>
  );
}
