import { LogoMark } from "./Logo";

/**
 * Stand-in for a missing blog cover image: a soft brand-tinted panel with a
 * faint dot texture, the bloom mark, and a quiet "No image available" label —
 * reads as an intentional empty state rather than a broken/flat color block.
 *
 * `compact` drops the label for small thumbnails (e.g. 56–96px list rows).
 * Size it with className exactly like the RemoteImage it replaces. All content
 * is absolutely positioned (no in-flow children), so the legacy aspect-ratio
 * padding fallback in globals.css still sizes it correctly.
 */
export function CoverPlaceholder({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div
      role="img"
      aria-label="No image available"
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--brand-primary) 7%, var(--surface-muted))",
        backgroundImage:
          "radial-gradient(color-mix(in srgb, var(--brand-primary) 16%, transparent) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span
          className={`flex items-center justify-center rounded-full bg-surface-muted ${
            compact ? "h-10 w-10" : "h-16 w-16"
          }`}
          style={{ boxShadow: "0 1px 2px rgb(0 0 0 / 0.06), 0 0 0 1px var(--border)" }}
        >
          <LogoMark size={compact ? 24 : 38} glyphColor="var(--surface-muted)" />
        </span>
        {!compact && (
          <span className="text-xs font-medium tracking-wide text-text-muted">No image available</span>
        )}
      </div>
    </div>
  );
}
