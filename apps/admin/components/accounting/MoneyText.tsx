import { formatCents } from "@/lib/accounting/money";

/** Renders a cents amount, green when >= 0 and red when negative — the one deliberate deviation from the brand palette (no green/red story works for a loss). */
export function MoneyText({ cents, className = "" }: { cents: number; className?: string }) {
  const color = cents < 0 ? "#b42318" : cents > 0 ? "var(--brand-accent)" : "var(--text)";
  return (
    <span className={`tabular-nums ${className}`} style={{ color }}>
      {formatCents(cents)}
    </span>
  );
}
