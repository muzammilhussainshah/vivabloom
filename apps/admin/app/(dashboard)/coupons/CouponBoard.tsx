"use client";

import Link from "next/link";
import { useState, useTransition, type DragEvent } from "react";
import { deleteCoupon, markVerified, reorderCoupons } from "./actions";

export interface CouponRow {
  id: string;
  title: string;
  description: string;
  type: "code" | "deal";
  code: string | null;
  discountType: "percentage" | "fixed" | "other";
  discountValue: number | null;
  expiryDate: string | null;
  isActive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  isExclusive: boolean;
  lastCheckedAt: string | null;
  clicks: number;
  views: number;
  countries: string[];
  hasAffiliateUrl: boolean;
}

export interface StoreGroup {
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeLogo: string | null;
  coupons: CouponRow[];
}

export function CouponBoard({ groups, webUrl }: { groups: StoreGroup[]; webUrl: string | null }) {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        // Keyed by the server's order so a refresh after save/delete resets local drag state.
        <StoreCouponList key={`${g.storeId}:${g.coupons.map((c) => c.id).join(",")}`} group={g} webUrl={webUrl} />
      ))}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function discountText(c: CouponRow) {
  if (c.discountValue == null) return null;
  if (c.discountType === "percentage") return `${c.discountValue}% off`;
  if (c.discountType === "fixed") return `$${c.discountValue} off`;
  return null;
}

function expiryInfo(iso: string | null): { text: string; tone: "muted" | "warn" | "bad" } {
  if (!iso) return { text: "No expiry", tone: "muted" };
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `Expired ${formatDate(iso)}`, tone: "bad" };
  if (days <= 7) return { text: `Expires in ${days}d`, tone: "warn" };
  return { text: `Expires ${formatDate(iso)}`, tone: "muted" };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function StoreCouponList({ group, webUrl }: { group: StoreGroup; webUrl: string | null }) {
  const [items, setItems] = useState(group.coupons);
  const [dragId, setDragId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(next: CouponRow[]) {
    const before = items;
    setItems(next);
    setStatus("saving");
    setError(null);
    startTransition(async () => {
      const res = await reorderCoupons(group.storeId, next.map((c) => c.id));
      if (res.error) {
        setItems(before);
        setStatus("error");
        setError(res.error);
      } else {
        setStatus("saved");
      }
    });
  }

  function onDragOver(e: DragEvent<HTMLLIElement>, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const from = items.findIndex((c) => c.id === dragId);
    const to = items.findIndex((c) => c.id === overId);
    if (from < 0 || to < 0) return;
    setItems(move(items, from, to));
  }

  function onDragEnd() {
    setDragId(null);
    const changed = items.some((c, i) => c.id !== group.coupons[i]?.id);
    if (changed) save(items);
  }

  const storeUrl = webUrl ? `${webUrl.replace(/\/$/, "")}/stores/${group.storeSlug}` : null;
  const activeCount = items.filter((c) => c.isActive).length;

  return (
    <section className="overflow-hidden rounded-base border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted px-4 py-3">
        <div className="flex items-center gap-3">
          {group.storeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.storeLogo} alt="" className="h-9 w-9 rounded-base border border-border bg-white object-contain p-1" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-base bg-brand-primary text-sm font-bold text-white">
              {group.storeName.charAt(0)}
            </span>
          )}
          <div>
            <h2 className="font-semibold leading-tight">{group.storeName}</h2>
            <p className="text-xs text-text-muted">
              {items.length} coupons · {activeCount} active · drag to set the order shown on the store page
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {status === "saving" && <span className="text-text-muted">Saving order…</span>}
          {status === "saved" && <span className="font-medium text-brand-primary">✓ Order saved — live on the site</span>}
          {status === "error" && <span className="font-medium text-red-600">{error}</span>}
          {storeUrl && (
            <a href={storeUrl} target="_blank" rel="noopener" className="rounded-base border border-border bg-surface px-3 py-1.5 font-medium hover:bg-surface-muted">
              View store page ↗
            </a>
          )}
        </div>
      </header>

      <ol className="divide-y divide-border">
        {items.map((c, index) => {
          const discount = discountText(c);
          const expiry = expiryInfo(c.expiryDate);
          const ctr = c.views > 0 ? `${((c.clicks / c.views) * 100).toFixed(1)}%` : "—";
          return (
            <li
              key={c.id}
              draggable
              onDragStart={(e) => {
                setDragId(c.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => onDragOver(e, c.id)}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={onDragEnd}
              className={`group grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 px-3 py-3 transition-colors md:grid-cols-[auto_minmax(0,1fr)_200px_150px_auto] md:items-center ${
                dragId === c.id ? "bg-brand-primary/10 opacity-70" : "hover:bg-surface-muted/60"
              } ${c.isActive ? "" : "opacity-60"}`}
            >
              {/* Handle + position */}
              <div className="flex items-center gap-1.5 self-start pt-0.5 md:self-center md:pt-0">
                <span className="cursor-grab select-none px-1 text-lg leading-none text-text-muted active:cursor-grabbing" title="Drag to reorder" aria-hidden="true">
                  ⋮⋮
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0 ? "bg-brand-primary text-white" : "bg-surface-muted text-text-muted"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0 || status === "saving"}
                    onClick={() => save(move(items, index, index - 1))}
                    className="px-1 text-[10px] leading-none text-text-muted hover:text-brand-primary disabled:opacity-25"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === items.length - 1 || status === "saving"}
                    onClick={() => save(move(items, index, index + 1))}
                    className="px-1 text-[10px] leading-none text-text-muted hover:text-brand-primary disabled:opacity-25"
                  >
                    ▼
                  </button>
                </div>
              </div>

              {/* Title + meta */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {index === 0 && c.isActive && (
                    <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Headline offer
                    </span>
                  )}
                  {c.isFeatured && <Badge tone="accent">★ Featured</Badge>}
                  {c.isExclusive && <Badge tone="accent">Exclusive</Badge>}
                  {discount && <Badge tone="primary">{discount}</Badge>}
                  {c.countries.length > 0 && <Badge>🌐 {c.countries.join(", ")}</Badge>}
                </div>
                <p className="mt-1 font-medium leading-snug">{c.title}</p>
                {c.description && <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">{c.description}</p>}
              </div>

              {/* Code / type + stats */}
              <div className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto md:flex-col md:items-start md:gap-1">
                {c.type === "code" ? (
                  <span className="rounded-md border border-dashed border-brand-primary/50 bg-brand-primary/5 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-brand-primary">
                    {c.code || "CODE"}
                  </span>
                ) : (
                  <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">Deal · no code</span>
                )}
                <span className="text-xs text-text-muted">
                  {c.clicks.toLocaleString("en-US")} clicks · {c.views.toLocaleString("en-US")} views · CTR {ctr}
                </span>
              </div>

              {/* Status */}
              <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs md:col-start-auto md:flex-col md:items-start">
                <span className={`inline-flex items-center gap-1.5 font-semibold ${c.isActive ? "text-green-700" : "text-text-muted"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${c.isActive ? "bg-green-600" : "bg-text-muted"}`} />
                  {c.isActive ? "Active" : "Inactive"}
                </span>
                <span className="text-text-muted">
                  {c.isVerified ? `✓ Verified ${formatDate(c.lastCheckedAt) ?? ""}` : "Not verified"}
                </span>
                <span suppressHydrationWarning className={expiry.tone === "bad" ? "font-medium text-red-600" : expiry.tone === "warn" ? "font-medium text-amber-600" : "text-text-muted"}>
                  {expiry.text}
                </span>
              </div>

              {/* Actions */}
              <div className="col-start-2 flex items-center gap-3 text-sm md:col-start-auto md:justify-end">
                {!c.isVerified && (
                  <form action={markVerified.bind(null, c.id)}>
                    <button type="submit" className="text-brand-accent hover:underline">
                      Verify
                    </button>
                  </form>
                )}
                <Link href={`/coupons/${c.id}/edit`} className="font-medium text-brand-primary hover:underline">
                  Edit
                </Link>
                <form
                  action={deleteCoupon.bind(null, c.id)}
                  onSubmit={(e) => {
                    if (!confirm(`Delete "${c.title}"?`)) e.preventDefault();
                  }}
                >
                  <button type="submit" className="text-brand-secondary hover:underline">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "primary" | "accent" }) {
  const cls =
    tone === "primary"
      ? "bg-brand-primary/10 text-brand-primary"
      : tone === "accent"
        ? "bg-brand-accent/15 text-brand-accent"
        : "bg-surface-muted text-text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
