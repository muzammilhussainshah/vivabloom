// Fixed hue per type (categorical, order never changes) — each badge also
// carries its text label, so identity never rides on color alone.
const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  dwell: { bg: "color-mix(in srgb, var(--text-muted) 16%, var(--surface-muted))", text: "var(--text-muted)", label: "Dwell time" },
  scroll_depth: { bg: "color-mix(in srgb, var(--brand-primary) 16%, var(--surface-muted))", text: "var(--brand-primary)", label: "Scroll depth" },
  affiliate_click: { bg: "color-mix(in srgb, var(--brand-accent) 16%, var(--surface-muted))", text: "var(--brand-accent)", label: "Affiliate click" },
  coupon_copy: { bg: "color-mix(in srgb, var(--brand-secondary) 16%, var(--surface-muted))", text: "var(--brand-secondary)", label: "Coupon copy" },
};

export function EventTypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type] ?? { bg: "var(--surface-muted)", text: "var(--text-muted)", label: type };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}
