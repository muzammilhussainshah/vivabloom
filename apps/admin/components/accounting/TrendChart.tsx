"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Spend vs. Earned over time — used for both the dashboard's 6-month view and the daily-granularity trend on the store report pages. Thins x-axis ticks automatically once there are more than ~14 points, so a lifetime range with many days doesn't crowd into unreadable labels. */
export function TrendChart({ data }: { data: { label: string; spent: number; earned: number }[] }) {
  const tickInterval = data.length > 14 ? Math.ceil(data.length / 14) - 1 : 0;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} interval={tickInterval} />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v.toLocaleString()}`}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, undefined]}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="spent" name="Spent" fill="var(--brand-secondary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="earned" name="Earned" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
