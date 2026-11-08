/**
 * The rounded-square brand mark (four-petal bloom). Colors are CSS var
 * references so callers on different color-token systems (the main site's
 * --brand-accent/--surface vs the store-page redesign's --accent/--page —
 * same underlying admin-configured colors, different variable names per
 * scope) can each pass the right ones and land on the identical resolved
 * color without duplicating tokens.
 */
export function LogoMark({
  size = 30,
  markColor = "var(--brand-accent)",
  glyphColor = "var(--surface)",
}: {
  size?: number;
  markColor?: string;
  glyphColor?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="8" fill={markColor} />
      <g fill={glyphColor}>
        <circle cx="14" cy="7.6" r="3.6" />
        <circle cx="20.4" cy="14" r="3.6" />
        <circle cx="14" cy="20.4" r="3.6" />
        <circle cx="7.6" cy="14" r="3.6" />
      </g>
      <circle cx="14" cy="14" r="2.3" fill={markColor} />
    </svg>
  );
}

/** Mark + script wordmark. Defaults match the main site's header/footer colors; store pages pass their own equivalent var names to land on the same resolved color. */
export function Logo({
  className,
  markColor = "var(--brand-accent)",
  glyphColor = "var(--surface)",
  wordmarkColor = "var(--surface)",
}: {
  className?: string;
  markColor?: string;
  glyphColor?: string;
  wordmarkColor?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark markColor={markColor} glyphColor={glyphColor} />
      <span className="font-script text-2xl font-semibold leading-none tracking-tight" style={{ color: wordmarkColor }}>
        VivaBloom
      </span>
    </span>
  );
}
