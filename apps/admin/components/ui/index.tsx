/**
 * Shared building blocks for the admin list pages (Products, Stores,
 * Bundles, Blog): one page header, one toolbar, one table look, thumbnails,
 * status badges and the loading skeleton, so every list reads the same way.
 * Server-safe — the interactive pieces live in ./client.tsx.
 */
import Link from "next/link";
import type { ReactNode } from "react";

/* ---------- Icons (inline, 16px, currentColor) ---------- */

type IconProps = { className?: string };
const iconBase = "h-4 w-4 shrink-0";

export function PlusIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}
export function PencilIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5Z" />
    </svg>
  );
}
export function TrashIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10.1a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10.1" />
    </svg>
  );
}
export function ExternalIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M11 4h5v5M16 4l-7 7M14 11.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5" />
    </svg>
  );
}
export function ImageIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <circle cx="7.5" cy="8.5" r="1.3" />
      <path d="m4 14 4-4 3 3 2-2 3 3" />
    </svg>
  );
}
export function SearchIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3 3" />
    </svg>
  );
}
export function EyeIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  );
}
export function CursorIcon({ className = iconBase }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 3 10 6-4.5 1.2L8.5 15 5 3Z" />
    </svg>
  );
}

/* ---------- Page layout ---------- */

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">{children}</div>;
}

export function PageHeader({
  title,
  description,
  count,
  actions,
}: {
  title: string;
  description?: string;
  /** Total number of records — shown as a pill next to the title. */
  count?: number;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text md:text-[28px]">{title}</h1>
          {count !== undefined && (
            <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-brand-primary">
              {count.toLocaleString()}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60";
export const buttonStyles = {
  primary: `${buttonBase} bg-brand-primary text-white shadow-sm shadow-brand-primary/25 hover:bg-brand-primary-hover`,
  secondary: `${buttonBase} border border-border bg-white text-text hover:border-text-muted/40 hover:bg-surface`,
  danger: `${buttonBase} bg-red-600 text-white hover:bg-red-700`,
};

export function ButtonLink({ href, variant = "primary", children }: { href: string; variant?: keyof typeof buttonStyles; children: ReactNode }) {
  return (
    <Link href={href} className={buttonStyles[variant]}>
      {children}
    </Link>
  );
}

/** The filter/search row above a table. */
export function Toolbar({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {summary && <p className="text-sm text-text-muted">{summary}</p>}
    </div>
  );
}

/* ---------- New / Edit pages ---------- */

/**
 * Shell for every New/Edit page: a back link, a header showing what's being
 * edited (its image, name, status and a "View on site" link), and the form
 * itself inside a white card.
 */
export function FormPage({
  backHref,
  backLabel,
  title,
  subtitle,
  media,
  meta,
  viewHref,
  width = "md",
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: ReactNode;
  /** Usually a <Thumb size="lg">: the item's image or logo. */
  media?: ReactNode;
  /** Badges next to the title (status, featured...). */
  meta?: ReactNode;
  viewHref?: string | null;
  width?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-6 px-4 py-8 md:px-8 md:py-10 ${width === "lg" ? "max-w-4xl" : "max-w-3xl"}`}>
      <Link href={backHref} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-brand-primary">
        <span aria-hidden="true">←</span>
        {backLabel}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {media}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-text">{title}</h1>
              {meta}
            </div>
            {subtitle && <p className="mt-1 truncate text-sm text-text-muted">{subtitle}</p>}
          </div>
        </div>
        {viewHref && (
          <a href={viewHref} target="_blank" rel="noopener" className={buttonStyles.secondary}>
            <ExternalIcon />
            View on site
          </a>
        )}
      </header>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] md:p-8">
        {children}
      </div>
    </div>
  );
}

/* ---------- Table ---------- */

export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

/** Class names for header cells, body cells and rows, so every table aligns the same way. */
export const table = {
  thead: "bg-surface text-left",
  th: "whitespace-nowrap border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted",
  thRight: "whitespace-nowrap border-b border-border px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted",
  tr: "group border-b border-border/70 transition-colors last:border-0 hover:bg-surface/70",
  td: "px-4 py-3 align-middle",
  tdRight: "px-4 py-3 text-right align-middle tabular-nums",
};

/** Name cell: thumbnail + bold title (links to edit) + a muted second line. */
export function ItemCell({ href, title, subtitle, thumb }: { href: string; title: string; subtitle?: ReactNode; thumb?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {thumb}
      <div className="min-w-0">
        <Link href={href} className="line-clamp-1 font-semibold text-text decoration-brand-primary/40 underline-offset-2 hover:text-brand-primary hover:underline">
          {title}
        </Link>
        {subtitle && <div className="mt-0.5 line-clamp-1 text-xs text-text-muted">{subtitle}</div>}
      </div>
    </div>
  );
}

const thumbSizes = {
  sm: "h-7 w-7 rounded-md",
  md: "h-12 w-12 rounded-[10px]",
  wide: "h-12 w-[76px] rounded-[10px]",
  lg: "h-16 w-16 rounded-xl",
  lgWide: "h-16 w-[104px] rounded-xl",
};

/** Image thumbnail with a neutral placeholder when there's no image (or it fails to load). */
export function Thumb({
  src,
  alt = "",
  size = "md",
  fit = "cover",
  fallback,
}: {
  src?: string | null;
  alt?: string;
  size?: keyof typeof thumbSizes;
  /** "contain" for logos, so they're never cropped. */
  fit?: "cover" | "contain";
  /** Shown instead of the image icon when there's no src — e.g. a store's first letter. */
  fallback?: string;
}) {
  const box = `${thumbSizes[size]} relative shrink-0 overflow-hidden border border-border bg-surface`;
  if (!src) {
    return (
      <span className={`${box} flex items-center justify-center text-text-muted/70`} aria-hidden="true">
        {fallback ? <span className="text-sm font-bold text-brand-primary">{fallback.charAt(0).toUpperCase()}</span> : <ImageIcon />}
      </span>
    );
  }
  return (
    <span className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote admin uploads; next/image would need every host allow-listed */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${fit === "contain" ? "bg-white object-contain p-1" : "object-cover"}`}
      />
    </span>
  );
}

/* ---------- Badges ---------- */

const badgeTones = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/15",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  brand: "bg-brand-primary/10 text-brand-primary ring-brand-primary/20",
};
const dotTones = {
  success: "bg-emerald-500",
  neutral: "bg-slate-400",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  brand: "bg-brand-primary",
};

export function Badge({ tone = "neutral", dot = false, children }: { tone?: keyof typeof badgeTones; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeTones[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotTones[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "neutral"} dot>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

/* ---------- Row actions ---------- */

const iconButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-2";

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

export function EditAction({ href }: { href: string }) {
  return (
    <Link href={href} className={iconButton} title="Edit" aria-label="Edit">
      <PencilIcon />
    </Link>
  );
}

export function ViewAction({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener" className={iconButton} title="View on site" aria-label="View on site">
      <ExternalIcon />
    </a>
  );
}

export const iconButtonClass = iconButton;

/* ---------- Misc ---------- */

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
        <SearchIcon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-text">{title}</p>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Small "views · clicks" stat pair. */
export function Stats({ views, clicks }: { views?: number | null; clicks?: number | null }) {
  return (
    <div className="flex items-center justify-end gap-3 text-xs text-text-muted">
      <span className="inline-flex items-center gap-1" title="Views">
        <EyeIcon className="h-3.5 w-3.5" />
        {compact(views ?? 0)}
      </span>
      {clicks !== undefined && (
        <span className="inline-flex items-center gap-1" title="Clicks">
          <CursorIcon className="h-3.5 w-3.5" />
          {compact(clicks ?? 0)}
        </span>
      )}
    </div>
  );
}

export function Price({ price, originalPrice }: { price: number; originalPrice?: number | null }) {
  const hasDiscount = !!originalPrice && originalPrice > price;
  const pct = hasDiscount ? Math.round(((originalPrice! - price) / originalPrice!) * 100) : 0;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-semibold text-text">${price.toFixed(2)}</span>
      {hasDiscount && (
        <span className="flex items-center gap-1.5 text-xs">
          <span className="text-text-muted line-through">${originalPrice!.toFixed(2)}</span>
          <span className="font-semibold text-emerald-700">-{pct}%</span>
        </span>
      )}
    </div>
  );
}

export function compact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Public-site URL for a path, or null when WEB_APP_URL isn't configured.
 * WEB_APP_URL can be a comma-separated list (revalidation targets); like the
 * coupons board, the last entry is treated as the public site.
 */
export function siteUrl(path: string) {
  const base = process.env.WEB_APP_URL?.split(",").map((u) => u.trim()).filter(Boolean).at(-1);
  return base ? `${base.replace(/\/$/, "")}${path}` : null;
}

/* ---------- Loading skeletons (used by each route's loading.tsx) ---------- */

export function FormPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10" role="status" aria-label="Loading">
      <div className="h-4 w-28 animate-pulse rounded bg-border/60" />
      <div className="h-8 w-56 animate-pulse rounded-lg bg-border/70" />
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3.5 w-24 animate-pulse rounded bg-border/70" />
            <div className={`${i === 3 ? "h-24" : "h-10"} w-full animate-pulse rounded-[10px] bg-border/40`} />
          </div>
        ))}
        <div className="h-10 w-36 animate-pulse rounded-[10px] bg-border/70" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}


export function ListPageSkeleton({ rows = 8, withThumb = true }: { rows?: number; withThumb?: boolean }) {
  return (
    <PageShell>
      <div className="flex items-end justify-between" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-border/70" />
          <div className="h-4 w-72 animate-pulse rounded bg-border/50" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-[10px] bg-border/70" />
      </div>
      <div className="h-10 w-64 animate-pulse rounded-[10px] bg-border/50" aria-hidden="true" />
      <div className="overflow-hidden rounded-2xl border border-border bg-white" role="status" aria-label="Loading">
        <div className="h-11 border-b border-border bg-surface" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/70 px-4 py-3 last:border-0">
            {withThumb && <div className="h-12 w-12 shrink-0 animate-pulse rounded-[10px] bg-border/60" />}
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-border/70" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-border/50" />
            </div>
            <div className="hidden h-3.5 w-24 animate-pulse rounded bg-border/50 md:block" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-border/50" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-border/40" />
          </div>
        ))}
        <span className="sr-only">Loading…</span>
      </div>
    </PageShell>
  );
}
