"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "var(--brand-primary)",
  "var(--brand-secondary)",
  "var(--brand-accent)",
  "var(--accent-teal)",
  "#c9a227",
  "#8a6d3b",
  "#5b8a72",
  "#9b6b9e",
];

export function StoreShareChart({ data }: { data: { name: string; value: number }[] }) {
  const nonZero = data.filter((d) => d.value > 0);
  if (nonZero.length === 0) {
    return <p className="py-10 text-center text-sm text-text-muted">No earnings yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={nonZero} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {nonZero.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, undefined]}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
