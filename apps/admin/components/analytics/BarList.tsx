/**
 * Horizontal magnitude bars for a top-N list — sequential (one hue), length
 * encodes value. Track is a light step of the same brand hue so the whole
 * bar reads as one scale; fill is square at the baseline (left) and rounded
 * only at the data end (right), per mark spec.
 */
export function BarList({
  title,
  items,
  emptyLabel = "No data yet.",
  formatValue = (v) => v.toLocaleString(),
}: {
  title: string;
  items: { label: string; value: number }[];
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="rounded-base border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-medium text-text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item, i) => {
            const pct = Math.max(4, Math.round((item.value / max) * 100));
            return (
              <li key={i} title={`${item.label}: ${formatValue(item.value)}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-text">{item.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-text-muted">
                    {formatValue(item.value)}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 14%, var(--surface-muted))" }}
                >
                  <div
                    className="h-full rounded-r-full"
                    style={{ width: `${pct}%`, backgroundColor: "var(--brand-primary)" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
