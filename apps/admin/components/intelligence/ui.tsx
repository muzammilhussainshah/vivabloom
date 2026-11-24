import type { ReactNode } from "react";
import type { PolicyKey, PolicyStatus } from "@monocoupon/validation";
import type { FieldStatus, ModelFit, RiskLevel, Verdict } from "@/lib/intelligence/types";
import { cleanText } from "@/lib/intelligence/text";

/* Shared, server-safe building blocks for the Store Checker pages. */

export const VERDICT_META: Record<Verdict, { label: string; short: string; hint: string; tone: Tone }> = {
  good: { label: "Trustworthy store", short: "Trustworthy", hint: "Established, a real affiliate program, and no credible payment problems found.", tone: "good" },
  caution: { label: "Some concerns", short: "Concerns", hint: "Some important details are missing, unclear or conflict with how you advertise.", tone: "warn" },
  risky: { label: "High risk", short: "High risk", hint: "Credible reports of payment problems, or too many trust gaps.", tone: "bad" },
  insufficient: { label: "Not enough data", short: "No data", hint: "Too little public information to judge the store.", tone: "muted" },
};

export const FIT_META: Record<ModelFit, { label: string; tone: Tone }> = {
  ok: { label: "Fits your ads", tone: "good" },
  check: { label: "Confirm before spending", tone: "warn" },
  conflict: { label: "Not allowed for your ads", tone: "bad" },
  unknown: { label: "Ad rules not found", tone: "muted" },
};

export const RISK_META: Record<RiskLevel, { label: string; tone: Tone }> = {
  low: { label: "Low risk", tone: "good" },
  medium: { label: "Medium risk", tone: "warn" },
  high: { label: "High risk", tone: "bad" },
  insufficient: { label: "Insufficient data", tone: "muted" },
};

export const POLICY_LABELS: Record<PolicyKey, { label: string; hint: string }> = {
  paid_search: { label: "Paid search ads", hint: "Google / Bing search ads at all" },
  brand_bidding: { label: "Bidding on the brand name", hint: "Brand / trademark as a keyword" },
  brand_coupon_keywords: { label: "Brand + coupon keywords", hint: "e.g. “brand coupon code”, “brand promo”" },
  trademark_in_ads: { label: "Brand name in ad text", hint: "In headlines or the display URL" },
  coupon_sites: { label: "Coupon & deal sites", hint: "Whether sites like yours are accepted" },
  direct_linking: { label: "Direct linking", hint: "Ad goes straight to the store" },
};

export const POLICY_STATUS_META: Record<PolicyStatus, { label: string; tone: Tone }> = {
  allowed: { label: "Allowed", tone: "good" },
  prohibited: { label: "Not allowed", tone: "bad" },
  restricted: { label: "With conditions", tone: "warn" },
  requires_approval: { label: "Needs approval", tone: "warn" },
  unknown: { label: "Not found", tone: "muted" },
};

export type Tone = "good" | "warn" | "bad" | "muted" | "info";

export const toneClasses: Record<Tone, { pill: string; dot: string; soft: string; text: string; ring: string }> = {
  good: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500", soft: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", ring: "#10b981" },
  warn: { pill: "bg-amber-50 text-amber-800 ring-amber-600/25", dot: "bg-amber-500", soft: "bg-amber-50 border-amber-200", text: "text-amber-800", ring: "#f59e0b" },
  bad: { pill: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500", soft: "bg-red-50 border-red-200", text: "text-red-700", ring: "#ef4444" },
  muted: { pill: "bg-slate-100 text-slate-600 ring-slate-500/15", dot: "bg-slate-400", soft: "bg-slate-50 border-slate-200", text: "text-slate-600", ring: "#94a3b8" },
  info: { pill: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500", soft: "bg-sky-50 border-sky-200", text: "text-sky-700", ring: "#0ea5e9" },
};

export function Pill({ tone, children, dot = true, size = "sm" }: { tone: Tone; children: ReactNode; dot?: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${toneClasses[tone].pill} ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${toneClasses[tone].dot}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function VerdictPill({ verdict, size }: { verdict: Verdict; size?: "sm" | "md" }) {
  const meta = VERDICT_META[verdict];
  return (
    <Pill tone={meta.tone} size={size}>
      {meta.short}
    </Pill>
  );
}

const FIELD_STATUS: Record<FieldStatus, { label: string; tone: Tone; title: string }> = {
  verified: { label: "Verified", tone: "good", title: "Matched word-for-word in the linked source" },
  unverified: { label: "Not verified", tone: "warn", title: "Found, but the quote couldn't be matched in the source — double-check it" },
  unknown: { label: "Unknown", tone: "muted", title: "Not stated in any source we found" },
};

export function EvidenceBadge({ status }: { status: FieldStatus }) {
  const meta = FIELD_STATUS[status];
  return (
    <span title={meta.title}>
      <Pill tone={meta.tone} dot={false}>
        {status === "verified" ? "✓ " : ""}
        {meta.label}
      </Pill>
    </span>
  );
}

/** A circular 0–100 meter. */
export function ScoreRing({ value, tone, size = 112, label }: { value: number; tone: Tone; size?: number; label?: string }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneClasses[tone].ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums leading-none text-text">{Math.round(value)}</span>
        {label && <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</span>}
      </div>
    </div>
  );
}

export function Bar({ value, tone = "info", className = "" }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-border ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: toneClasses[tone].ring }} />
    </div>
  );
}

export function scoreTone(score: number): Tone {
  return score >= 70 ? "good" : score >= 45 ? "warn" : "bad";
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={`scroll-mt-6 rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({ title, description, aside }: { title: string; description?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** A verbatim quote from a source, with a link to it. */
export function Quote({ text, url, pasted = false }: { text: string | null; url: string | null; pasted?: boolean }) {
  const clean = text ? cleanText(text) : "";
  if (!clean) return null;
  return (
    <figure className="mt-2 rounded-lg border-l-2 border-brand-primary/40 bg-surface px-3 py-2">
      <blockquote className="text-[13px] italic leading-relaxed text-text [overflow-wrap:anywhere]">
        “{clean.length > 320 ? `${clean.slice(0, 320)}…` : clean}”
      </blockquote>
      {pasted && !url && <figcaption className="mt-1 text-xs font-medium text-brand-primary">From the terms you pasted</figcaption>}
      {url && (
        <figcaption className="mt-1 truncate text-xs">
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-primary hover:underline">
            {hostAndPath(url)} ↗
          </a>
        </figcaption>
      )}
    </figure>
  );
}

export function hostAndPath(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path.length > 40 ? `${path.slice(0, 40)}…` : path}`;
  } catch {
    return url;
  }
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: amount >= 100 ? 0 : 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function isOlderThanDays(iso: string | null | undefined, days: number): boolean {
  return Boolean(iso) && Date.now() - new Date(iso as string).getTime() > days * 86_400_000;
}

/**
 * Full trigger styling for the shared <Select> — passing a className REPLACES
 * its defaults, so it must include border, height and padding itself.
 */
export const selectClass =
  "h-10 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] hover:border-text-muted/40";
export const inputClass =
  "h-10 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] placeholder:text-text-muted/70 hover:border-text-muted/40 focus:border-brand-primary focus:outline-none";
export const fieldLabelClass = "flex flex-col gap-1.5 text-xs font-semibold text-text-muted";
