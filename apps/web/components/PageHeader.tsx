import type { ReactNode } from "react";

/**
 * The one page-title block every top-level page uses: small accent eyebrow,
 * serif H1, optional lead paragraph and meta line, closed by a hairline rule.
 * Keeping it in one place is what keeps titles the same size, weight and
 * colour from page to page.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  centered = false,
  divider = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  centered?: boolean;
  divider?: boolean;
}) {
  return (
    <header
      className={`flex flex-col gap-3 ${divider ? "border-b border-border pb-8" : ""} ${
        centered ? "items-center text-center" : ""
      }`}
    >
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">{eyebrow}</p>
      )}
      <h1 className="text-balance font-serif text-3xl font-bold leading-tight tracking-tight text-text sm:text-5xl">
        {title}
      </h1>
      {description && <p className="max-w-2xl text-base leading-relaxed text-text-muted">{description}</p>}
      {meta && <p className="text-sm text-text-muted">{meta}</p>}
    </header>
  );
}
