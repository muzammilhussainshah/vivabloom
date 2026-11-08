import Link from "next/link";
import type { RiskLevel } from "@/lib/fraudSignals";

const LEVEL_STYLES: Record<Exclude<RiskLevel, "low">, { color: string; dot: string }> = {
  high: { color: "var(--brand-secondary)", dot: "#dc2626" },
  medium: { color: "var(--brand-accent)", dot: "#d97706" },
};

/**
 * Session id link, tinted red/amber when the session is flagged as risky.
 * The `title` attribute lists the reasons so the admin sees "why" on hover
 * without leaving the table.
 */
export function RiskSessionLink({
  sessionId,
  level,
  reasons,
  returnTo,
  highlighted,
}: {
  sessionId: string;
  level: RiskLevel;
  reasons: string[];
  /** Current page's path+query (this tab, filters, sort, page) — carried through so
   *  "back" lands exactly here even on a hard/full navigation, not just a soft one. */
  returnTo?: string;
  highlighted?: boolean;
}) {
  const style = level !== "low" ? LEVEL_STYLES[level] : null;
  const href = returnTo
    ? `/analytics/sessions/${sessionId}?returnTo=${encodeURIComponent(returnTo)}`
    : `/analytics/sessions/${sessionId}`;
  return (
    <Link
      id={`session-row-${sessionId}`}
      href={href}
      title={reasons.length > 0 ? reasons.join("\n") : undefined}
      className={`inline-flex items-center gap-1.5 rounded-base font-mono text-xs hover:underline ${
        highlighted ? "ring-2 ring-brand-primary ring-offset-2 ring-offset-surface" : ""
      }`}
      style={{ color: style?.color ?? "var(--brand-primary)" }}
    >
      {style && (
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: style.dot }} aria-hidden="true" />
      )}
      {sessionId.slice(0, 8)}
    </Link>
  );
}
