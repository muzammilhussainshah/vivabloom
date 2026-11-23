"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrafficPoint = { label: string; pageviews: number; clicks: number };

/**
 * 14-day pageviews vs affiliate clicks for the dashboard.
 *
 * Colors come from the theme tokens through `currentColor` (each <Area> gets a
 * text-color class) and `style` on the gradient stops: CSS variables aren't
 * reliably resolved inside SVG presentation attributes like stroke="var(...)".
 */
export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="traffic-pv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--brand-primary)", stopOpacity: 0.26 }} />
            <stop offset="100%" style={{ stopColor: "var(--brand-primary)", stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id="traffic-ck" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--brand-accent)", stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: "var(--brand-accent)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e3e8e4" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#5f6b66", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={{ fill: "#5f6b66", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
        <Tooltip
          cursor={{ stroke: "#e3e8e4" }}
          contentStyle={{ background: "#fff", border: "1px solid #e3e8e4", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px -12px rgba(16,24,20,0.2)" }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
        />
        <Area
          className="text-brand-primary"
          type="monotone"
          dataKey="pageviews"
          name="Pageviews"
          stroke="currentColor"
          strokeWidth={2.2}
          fill="url(#traffic-pv)"
          dot={false}
          activeDot={{ r: 4, fill: "currentColor", stroke: "#fff", strokeWidth: 2 }}
        />
        <Area
          className="text-brand-accent"
          type="monotone"
          dataKey="clicks"
          name="Affiliate clicks"
          stroke="currentColor"
          strokeWidth={2.2}
          fill="url(#traffic-ck)"
          dot={false}
          activeDot={{ r: 4, fill: "currentColor", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
