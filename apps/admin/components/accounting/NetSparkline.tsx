"use client";

import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCents } from "@/lib/accounting/money";

interface ChartPoint {
  dateKey: string;
  label: string;
  spentCents: number;
  earnedCents: number;
  netCents: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-base border border-border bg-surface px-2.5 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold">{p.label}</p>
      <p className="text-text-muted">Spent: {formatCents(p.spentCents)}</p>
      <p className="text-text-muted">Earned: {formatCents(p.earnedCents)}</p>
      <p className="font-medium" style={{ color: p.netCents < 0 ? "#b42318" : "var(--brand-accent)" }}>
        Profit: {formatCents(p.netCents)}
      </p>
    </div>
  );
}

function coloredDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return <></>;
  return <circle cx={cx} cy={cy} r={2.5} fill={payload.netCents < 0 ? "#b42318" : "var(--brand-accent)"} stroke="var(--surface)" strokeWidth={1} />;
}

/**
 * Day-by-day Net trend as a real line chart (axes + hover tooltip with
 * Spent/Earned/Profit for that day) — used both as a compact per-store
 * sparkline inline in a table row (fixed pixel size, since a table cell
 * doesn't give Recharts a reliable percentage-sized parent to measure) and,
 * with `fullWidth`, as a page-level chart (e.g. the all-stores-combined
 * trend atop the store report pages).
 */
export function NetSparkline({
  data,
  width = 260,
  height = 110,
  fullWidth = false,
}: {
  data: { date: Date; spentCents: number; earnedCents: number; netCents: number }[];
  width?: number;
  height?: number;
  fullWidth?: boolean;
}) {
  if (data.length === 0) {
    return <span className="text-xs text-text-muted">No data</span>;
  }

  const points: ChartPoint[] = data.map((d) => ({
    dateKey: d.date.toISOString().slice(0, 10),
    label: d.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    spentCents: d.spentCents,
    earnedCents: d.earnedCents,
    netCents: d.netCents,
  }));

  // A compact table sparkline only has room for first/last; a full-width
  // page chart can fit more, up to ~14 evenly-spaced labels either way.
  const tickInterval = fullWidth ? (points.length > 14 ? Math.ceil(points.length / 14) - 1 : 0) : ("preserveStartEnd" as const);

  const chart = (
    <LineChart data={points} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
      <XAxis
        dataKey="dateKey"
        tick={{ fontSize: fullWidth ? 11 : 9, fill: "var(--text-muted)" }}
        tickFormatter={(v: string) => new Date(`${v}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
        interval={tickInterval}
        axisLine={{ stroke: "var(--border)" }}
        tickLine={false}
        height={fullWidth ? 24 : 20}
      />
      <YAxis
        tick={{ fontSize: fullWidth ? 11 : 9, fill: "var(--text-muted)" }}
        width={fullWidth ? 48 : 38}
        tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<CustomTooltip />} />
      <Line type="monotone" dataKey="netCents" stroke="var(--brand-primary)" strokeWidth={fullWidth ? 2 : 1.5} dot={coloredDot} activeDot={{ r: fullWidth ? 5 : 4 }} isAnimationActive={false} />
    </LineChart>
  );

  if (fullWidth) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
    );
  }

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );
}
