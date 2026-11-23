import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  connectToDatabase,
  AuditLog,
  BlogPost,
  Bundle,
  ContactMessage,
  Coupon,
  EngagementEvent,
  NewsletterSubscriber,
  Product,
  Store,
  TrackingEvent,
} from "@monocoupon/db";
import { auth } from "@/auth";
import { ButtonLink, PageShell, PlusIcon, Thumb, buttonStyles, compact } from "@/components/ui";
import { TrafficChart, type TrafficPoint } from "@/components/dashboard/TrafficChart";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function getDashboardData() {
  await connectToDatabase();
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since14 = new Date(startOfToday.getTime() - 13 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const in7 = new Date(now.getTime() + 7 * DAY);
  // Same rule as the Analytics page: server-side hits (bots, prefetch) don't count as visits.
  const visit = { source: { $ne: "server" } };

  const [
    dailyViews,
    dailyClicks,
    visitorWindows,
    topStoreClicks,
    storeCount,
    activeStores,
    couponCount,
    activeCoupons,
    productCount,
    bundleCount,
    postCount,
    publishedPosts,
    subscriberCount,
    newSubscribers,
    expiringSoon,
    unverifiedCoupons,
    newMessages,
    scheduledPosts,
    recentActivity,
  ] = await Promise.all([
    TrackingEvent.aggregate<{ _id: string; views: number }>([
      { $match: { ...visit, createdAt: { $gte: since14 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, views: { $sum: 1 } } },
    ]),
    EngagementEvent.aggregate<{ _id: string; clicks: number }>([
      { $match: { type: "affiliate_click", createdAt: { $gte: since14 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, clicks: { $sum: 1 } } },
    ]),
    // Unique visitors + pageviews for this week and the week before, for the trend arrows.
    TrackingEvent.aggregate<{ _id: "current" | "previous"; views: number; visitors: string[] }>([
      { $match: { ...visit, createdAt: { $gte: new Date(since7.getTime() - 7 * DAY) } } },
      { $group: { _id: { $cond: [{ $gte: ["$createdAt", since7] }, "current", "previous"] }, views: { $sum: 1 }, visitors: { $addToSet: "$deviceId" } } },
    ]),
    EngagementEvent.aggregate<{ _id: string; clicks: number }>([
      { $match: { type: "affiliate_click", createdAt: { $gte: since30 }, storeSlug: { $ne: null } } },
      { $group: { _id: "$storeSlug", clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
    ]),
    Store.countDocuments({}),
    Store.countDocuments({ isActive: true }),
    Coupon.countDocuments({}),
    Coupon.countDocuments({ isActive: true }),
    Product.countDocuments({}),
    Bundle.countDocuments({}),
    BlogPost.countDocuments({}),
    BlogPost.countDocuments({ status: "published" }),
    NewsletterSubscriber.countDocuments({ status: { $ne: "unsubscribed" } }),
    NewsletterSubscriber.countDocuments({ createdAt: { $gte: since7 } }),
    Coupon.countDocuments({ isActive: true, expiryDate: { $gte: now, $lte: in7 } }),
    Coupon.countDocuments({ isActive: true, isVerified: { $ne: true } }),
    ContactMessage.countDocuments({ status: "new" }),
    BlogPost.countDocuments({ status: "scheduled" }),
    AuditLog.find({}).populate("user", "name email").sort({ createdAt: -1 }).limit(6).lean(),
  ]);

  // Affiliate clicks for the same two weeks.
  const [clicksCurrent, clicksPrevious] = await Promise.all([
    EngagementEvent.countDocuments({ type: "affiliate_click", createdAt: { $gte: since7 } }),
    EngagementEvent.countDocuments({ type: "affiliate_click", createdAt: { $gte: new Date(since7.getTime() - 7 * DAY), $lt: since7 } }),
  ]);

  const topStores = topStoreClicks.length
    ? await Store.find({ slug: { $in: topStoreClicks.map((s) => s._id) } }, "name slug logo").lean()
    : [];
  const storeBySlug = new Map(topStores.map((s) => [s.slug, s]));

  const viewsByDay = new Map(dailyViews.map((d) => [d._id, d.views]));
  const clicksByDay = new Map(dailyClicks.map((d) => [d._id, d.clicks]));
  const series: TrafficPoint[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since14.getTime() + i * DAY);
    const key = dayKey(d);
    return {
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      pageviews: viewsByDay.get(key) ?? 0,
      clicks: clicksByDay.get(key) ?? 0,
    };
  });

  const cur = visitorWindows.find((w) => w._id === "current");
  const prev = visitorWindows.find((w) => w._id === "previous");
  const visitors = { current: cur?.visitors.length ?? 0, previous: prev?.visitors.length ?? 0 };
  const pageviews = { current: cur?.views ?? 0, previous: prev?.views ?? 0 };
  const clicks = { current: clicksCurrent, previous: clicksPrevious };
  const rate = (c: number, v: number) => (v > 0 ? (c / v) * 100 : 0);
  const clickRate = { current: rate(clicks.current, visitors.current), previous: rate(clicks.previous, visitors.previous) };

  return {
    series,
    visitors,
    pageviews,
    clicks,
    clickRate,
    topStores: topStoreClicks.map((s) => ({ slug: s._id, clicks: s.clicks, store: storeBySlug.get(s._id) })),
    catalog: { storeCount, activeStores, couponCount, activeCoupons, productCount, bundleCount, postCount, publishedPosts, subscriberCount, newSubscribers },
    attention: { expiringSoon, unverifiedCoupons, newMessages, scheduledPosts },
    recentActivity,
  };
}

/* ---------- Presentational pieces ---------- */

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Delta({ current, previous, suffix = "%" }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-text-muted">No data yet</span>;
  if (previous === 0) return <span className="text-xs font-semibold text-emerald-700">New this week</span>;
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-700" : "text-red-600"}`}>
      <svg viewBox="0 0 12 12" className={`h-3 w-3 ${up ? "" : "rotate-180"}`} fill="currentColor" aria-hidden="true">
        <path d="M6 2.5 10 8H2z" />
      </svg>
      {Math.abs(change).toFixed(change !== 0 && Math.abs(change) < 10 ? 1 : 0)}
      {suffix}
      <span className="font-normal text-text-muted">vs last week</span>
    </span>
  );
}

function Kpi({ label, value, icon, children }: { label: string; value: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">{icon}</span>
      </div>
      <p className="text-[28px] font-semibold leading-none tracking-tight text-text tabular-nums">{value}</p>
      {children}
    </Card>
  );
}

function KpiIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function AttentionRow({ href, count, label, tone }: { href: string; count: number; label: string; tone: "warning" | "info" | "danger" }) {
  const toneClass = count === 0 ? "bg-surface text-text-muted" : tone === "danger" ? "bg-red-50 text-red-600" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700";
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface">
        <span className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums ${toneClass}`}>{count}</span>
        <span className={`flex-1 text-sm ${count === 0 ? "text-text-muted" : "font-medium text-text"}`}>{label}</span>
        <span className="text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
}

function timeAgo(date: Date) {
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function humanizeAction(action: string) {
  return action.replace(/[._-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/* ---------- Page ---------- */

export default async function DashboardPage() {
  const [session, data] = await Promise.all([auth(), getDashboardData()]);
  const name = session?.user?.name?.split(" ")[0] ?? "there";
  // No time-of-day greeting: the server runs in UTC, so it would be wrong for the admin's own clock.
  const greeting = "Welcome back";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const { catalog, attention } = data;
  const maxStoreClicks = Math.max(1, ...data.topStores.map((s) => s.clicks));

  return (
    <PageShell>
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text-muted">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text md:text-[28px]">
            {greeting}, {name}
          </h1>
          <p className="mt-1 text-sm text-text-muted">Here&apos;s how your site performed over the last 7 days.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/analytics" variant="secondary">
            Full analytics
          </ButtonLink>
          <ButtonLink href="/coupons/new">
            <PlusIcon />
            New coupon
          </ButtonLink>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Visitors" value={compact(data.visitors.current)} icon={<KpiIcon d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 16.5c.8-2.6 3.1-4 6-4s5.2 1.4 6 4" />}>
          <Delta current={data.visitors.current} previous={data.visitors.previous} />
        </Kpi>
        <Kpi label="Pageviews" value={compact(data.pageviews.current)} icon={<KpiIcon d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10ZM10 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z" />}>
          <Delta current={data.pageviews.current} previous={data.pageviews.previous} />
        </Kpi>
        <Kpi label="Affiliate clicks" value={compact(data.clicks.current)} icon={<KpiIcon d="m5 3 10 6-4.5 1.2L8.5 15 5 3Z" />}>
          <Delta current={data.clicks.current} previous={data.clicks.previous} />
        </Kpi>
        <Kpi label="Click rate" value={`${data.clickRate.current.toFixed(1)}%`} icon={<KpiIcon d="M4 16 16 4M6.5 5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM15.5 14.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />}>
          <span className="text-xs text-text-muted">Clicks per visitor · last week {data.clickRate.previous.toFixed(1)}%</span>
        </Kpi>
      </div>

      {/* Chart + attention */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Traffic"
            subtitle="Last 14 days"
            action={
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-primary" />
                  Pageviews
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-accent" />
                  Affiliate clicks
                </span>
              </div>
            }
          />
          <div className="px-2 pb-4 pt-2">
            <TrafficChart data={data.series} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Needs attention" subtitle="Things to check today" />
          <ul className="flex flex-col gap-0.5 p-2 pt-3">
            <AttentionRow href="/coupons" count={attention.expiringSoon} label="Coupons expiring this week" tone="danger" />
            <AttentionRow href="/coupons" count={attention.unverifiedCoupons} label="Active coupons not verified" tone="warning" />
            <AttentionRow href="/messages" count={attention.newMessages} label="Unread messages" tone="info" />
            <AttentionRow href="/blog?status=scheduled" count={attention.scheduledPosts} label="Scheduled blog posts" tone="info" />
          </ul>
        </Card>
      </div>

      {/* Top stores + catalog + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Top stores" subtitle="Affiliate clicks · last 30 days" action={<Link href="/stores" className="text-xs font-semibold text-brand-primary hover:underline">All stores</Link>} />
          {data.topStores.length === 0 ? (
            <p className="px-5 pb-6 pt-4 text-sm text-text-muted">No affiliate clicks in the last 30 days yet.</p>
          ) : (
            <ul className="flex flex-col gap-3 px-5 pb-5 pt-4">
              {data.topStores.map((s) => (
                <li key={s.slug} className="flex items-center gap-3">
                  <Thumb src={s.store?.logo} size="sm" fit="contain" fallback={s.store?.name ?? s.slug} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-text">{s.store?.name ?? s.slug}</span>
                      <span className="font-semibold tabular-nums text-text">{s.clicks.toLocaleString()}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-brand-primary" style={{ width: `${(s.clicks / maxStoreClicks) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Catalog" subtitle="What's live on the site" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl border-t border-border bg-border mt-4">
            {[
              { label: "Stores", value: catalog.storeCount, sub: `${catalog.activeStores} active`, href: "/stores" },
              { label: "Coupons", value: catalog.couponCount, sub: `${catalog.activeCoupons} active`, href: "/coupons" },
              { label: "Products", value: catalog.productCount, sub: "across all stores", href: "/products" },
              { label: "Blog posts", value: catalog.postCount, sub: `${catalog.publishedPosts} published`, href: "/blog" },
              { label: "Subscribers", value: catalog.subscriberCount, sub: `+${catalog.newSubscribers} this week`, href: "/subscribers" },
              { label: "Bundles", value: catalog.bundleCount, sub: "multi-product packs", href: "/bundles" },
            ].map((t) => (
              <Link key={t.label} href={t.href} className="bg-white px-5 py-4 transition-colors hover:bg-surface/70">
                <p className="text-xs font-medium text-text-muted">{t.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-text">{t.value.toLocaleString()}</p>
                <p className="mt-0.5 text-xs text-text-muted">{t.sub}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Recent activity" subtitle="Latest admin actions" action={<Link href="/audit-log" className="text-xs font-semibold text-brand-primary hover:underline">View all</Link>} />
          {data.recentActivity.length === 0 ? (
            <p className="px-5 pb-6 pt-4 text-sm text-text-muted">No activity recorded yet.</p>
          ) : (
            <ol className="relative flex flex-col gap-4 px-5 pb-5 pt-4">
              {data.recentActivity.map((entry) => {
                const user = entry.user as unknown as { name?: string; email?: string } | null;
                return (
                  <li key={String(entry._id)} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-primary/60" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text">
                        <span className="font-medium">{humanizeAction(entry.action)}</span>
                        {entry.entityType && <span className="text-text-muted"> · {entry.entityType}</span>}
                      </p>
                      <p className="text-xs text-text-muted">
                        {user?.name ?? user?.email ?? "Admin"} · {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-text">Quick actions</h2>
            <p className="mt-0.5 text-xs text-text-muted">Jump straight into the most common tasks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["/stores/new", "Add store"],
              ["/products/new", "Add product"],
              ["/bundles/new", "Add bundle"],
              ["/blog/new", "Write post"],
              ["/categories/new", "Add category"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className={buttonStyles.secondary}>
                <PlusIcon />
                {label}
              </Link>
            ))}
            <Link href="/settings" className={buttonStyles.secondary}>
              Site settings
            </Link>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
