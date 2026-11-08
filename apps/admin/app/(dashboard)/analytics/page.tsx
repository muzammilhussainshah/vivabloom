import Link from "next/link";
import type { Metadata } from "next";
import { UAParser } from "ua-parser-js";
import { connectToDatabase, TrackingEvent, EngagementEvent, Store, SuspiciousReview } from "@monocoupon/db";
import { SUPPORTED_COUNTRY_CODES } from "@monocoupon/validation";
import { markSessionReviewed, markSessionUnreviewed } from "./actions";
import type { FilterQuery } from "mongoose";
import { StatTile } from "@/components/analytics/StatTile";
import { BarList } from "@/components/analytics/BarList";
import { EventTypeBadge } from "@/components/analytics/EventTypeBadge";
import { RiskSessionLink } from "@/components/analytics/RiskSessionLink";
import { HighlightScroller } from "@/components/analytics/HighlightScroller";
import { RangeControls } from "@/components/analytics/RangeControls";
import { resolveCouponLabels } from "@/lib/couponLabels";
import { CopyableList } from "@/components/analytics/CopyableList";
import { TimeCell, TimeZoneHeaderNote } from "@/components/analytics/TimeCell";
import {
  buildRiskContext,
  getFlaggedSessions,
  scoreSessionsByIds,
  FLAG_LABELS,
  type FlaggedSession,
  type RiskLevel,
  type SessionRiskContext,
} from "@/lib/fraudSignals";

// Window over which cross-session fraud context (IP flooding, cookie resets,
// serial clicks) is aggregated — bounded so it stays fast as data accrues.
const RISK_WINDOW_DAYS = 30;
function riskSince() {
  return new Date(Date.now() - RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const SORTABLE_FIELDS = new Set(["createdAt", "path", "country"]);
const ENGAGEMENT_TYPES = ["dwell", "scroll_depth", "affiliate_click", "coupon_copy"] as const;
const ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  dwell: "Dwell time",
  scroll_depth: "Scroll depth",
  affiliate_click: "Affiliate click",
  coupon_copy: "Coupon copy",
};

type TabKey = "overview" | "engagement" | "suspicious";

// "Hide my own traffic" filter — countries the owner and team browse from,
// plus localhost (dev browsing has no country header at all). IP country
// only otherwise, by design: timezone-based matching also caught real
// visitors (and VPN users) whose clocks happened to be set to PK/IN.
const LOCAL_COUNTRIES = ["PK", "IN"];
const LOCAL_IPS = ["::1", "127.0.0.1"];

function isLocalVisitor(v: { country?: string | null; ip?: string | null }) {
  return (!!v.country && LOCAL_COUNTRIES.includes(v.country)) || (!!v.ip && LOCAL_IPS.includes(v.ip));
}

/**
 * Reads a checked-by-default checkbox submitted via a GET form. A plain
 * unchecked checkbox sends nothing at all, so there's no way to tell "never
 * touched" from "explicitly turned off" — the form pairs each checkbox with
 * a hidden input of the same name and value "0" (see the Overview tab form),
 * so unchecked submits ["0"] and checked submits ["0","1"] (Next.js gives an
 * array whenever a query key repeats). No param at all means the control
 * hasn't been submitted yet, so it defaults on.
 */
function isFlagOn(value: string | string[] | undefined): boolean {
  const values = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  if (values.length === 0) return true;
  return values.includes("1");
}

// Store pages live at /stores/[slug] plus 6 noindex sitelink variants (see
// apps/web/lib/storeVariantPage.tsx), each also reachable under a /{country}
// locale prefix (e.g. /it/stores/x — see apps/web/app/(store)/[country]/,
// SUPPORTED_COUNTRY_CODES) — a pageview's path must be matched against every
// prefix x every optional locale to tell which store it belongs to, or
// selecting a store here would silently exclude all of its localized traffic.
const STORE_PATH_PREFIXES = [
  "stores",
  "never-pay-full",
  "todays-deals",
  "free-shipping-codes",
  "exclusive-offers",
  "secret-codes",
  "exclusive-deals",
];

function storePathRegex(slug: string): RegExp {
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const localePrefix = `(?:${SUPPORTED_COUNTRY_CODES.join("|")})/`;
  return new RegExp(`^/(?:${localePrefix})?(?:${STORE_PATH_PREFIXES.join("|")})/${escapedSlug}(?:/|$)`);
}

// Duration presets, in hours, for the "range" dropdown. "custom" isn't here
// — it's handled by falling through to explicit from/to instead.
const RANGE_PRESET_HOURS: Record<string, number> = { "24h": 24, "48h": 48, "7d": 24 * 7, "30d": 24 * 30 };
const DEFAULT_RANGE = "24h";

/**
 * createdAt bound for a tab's queries. "custom" (or bare from/to with no
 * range, for old bookmarked links) uses the explicit dates, unbounded on
 * either side that's left empty. Any other/missing range falls back to the
 * 24h default preset.
 */
function resolveTimeMatch(from?: string, to?: string, range?: string): { $gte?: Date; $lte?: Date } | null {
  const isCustom = range === "custom" || (!range && (from || to));
  if (isCustom) {
    const bound: { $gte?: Date; $lte?: Date } = {};
    if (from) bound.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) bound.$lte = new Date(`${to}T23:59:59.999Z`);
    return Object.keys(bound).length > 0 ? bound : null;
  }
  const hours = RANGE_PRESET_HOURS[range ?? DEFAULT_RANGE] ?? RANGE_PRESET_HOURS[DEFAULT_RANGE];
  return { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
}

interface AnalyticsSearchParams {
  tab?: string;
  q?: string;
  type?: string;
  from?: string;
  to?: string;
  sort?: string;
  order?: string;
  page?: string;
  /** "0" shows the owner's own traffic too; unset/anything else hides it (Pakistan/India by IP country, or localhost) — on by default. Array when the paired hidden input + checkbox both submit (see isFlagOn). */
  hideLocal?: string | string[];
  /** "0" shows organic sessions too; unset/anything else shows only sessions with a paid ad click (gclid or utm_medium=cpc/ppc) — on by default. Array when the paired hidden input + checkbox both submit (see isFlagOn). */
  adOnly?: string | string[];
  /** Store slug to scope the tab to; unset/"" means all stores. */
  store?: string;
  /** "24h" | "48h" | "7d" | "30d" | "custom" — unset defaults to 24h; "custom" uses from/to. */
  range?: string;
  /** Suspicious tab only: "all" | "read" | unset (defaults to "unread" — sessions marked reviewed are hidden). */
  reviewed?: string;
  /** Suspicious tab only: a flag code (e.g. "fp_reset") to narrow to sessions carrying that reason. */
  reason?: string;
  /** Suspicious tab only: "1" shows only sessions that arrived via a paid ad click. Off by default. */
  paidOnly?: string;
  /** Set when returning from a session's full-page view (not the drawer) —
   *  the row to scroll to and ring-highlight so context isn't lost. */
  highlight?: string;
}

/** A <select> for narrowing a tab to one store; part of the filter form, submitted via the Filter button like sort/order. */
function StoreSelect({ stores, value }: { stores: { slug: string; name: string }[]; value?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-muted" htmlFor="store">
        Store
      </label>
      <select
        id="store"
        name="store"
        defaultValue={value ?? ""}
        className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
      >
        <option value="">All stores</option>
        {stores.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return "<1s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/**
 * Sessions that arrived via a paid ad click: any pageview carrying a Google
 * gclid or utm_medium=cpc/ppc. Checked per session (not per row) because the
 * click ID is only on the landing pageview's URL — follow-up pageviews of
 * the same paid visit would otherwise look organic.
 */
async function getPaidSessions(sessionIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));
  if (ids.length === 0) return new Set();
  const rows = await TrackingEvent.aggregate([
    {
      $match: {
        sessionId: { $in: ids },
        $or: [{ gclid: { $nin: [null, ""] } }, { "utm.medium": { $in: ["cpc", "ppc"] } }],
      },
    },
    { $group: { _id: "$sessionId" } },
  ]);
  return new Set(rows.map((r) => r._id as string));
}

/** Where the session's traffic came from, as a small labeled badge. */
function TrafficBadge({ paid, referrer }: { paid: boolean; referrer?: string | null }) {
  const label = paid
    ? "Ad click"
    : referrer
      ? /google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\./i.test(referrer)
        ? "Search"
        : "Referral"
      : "Direct";
  const color = paid ? "#dc2626" : label === "Search" ? "#059669" : "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, var(--surface-muted))`, color }}
      title={paid ? "This session carried a Google Ads click ID (gclid) or utm_medium=cpc" : referrer ?? "No referrer — typed the URL or used a bookmark"}
    >
      {label}
    </span>
  );
}

/** First-to-last event span (pageviews + engagement) for each session id. */
async function getSessionDurations(sessionIds: string[]): Promise<Map<string, number>> {
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const [track, engage] = await Promise.all([
    TrackingEvent.aggregate([
      { $match: { sessionId: { $in: ids } } },
      { $group: { _id: "$sessionId", min: { $min: "$createdAt" }, max: { $max: "$createdAt" } } },
    ]),
    EngagementEvent.aggregate([
      { $match: { sessionId: { $in: ids } } },
      { $group: { _id: "$sessionId", min: { $min: "$createdAt" }, max: { $max: "$createdAt" } } },
    ]),
  ]);
  const spans = new Map<string, { min: number; max: number }>();
  for (const row of [...track, ...engage]) {
    const id = row._id as string;
    const min = new Date(row.min).getTime();
    const max = new Date(row.max).getTime();
    const prev = spans.get(id);
    spans.set(id, prev ? { min: Math.min(prev.min, min), max: Math.max(prev.max, max) } : { min, max });
  }
  return new Map(Array.from(spans.entries()).map(([id, s]) => [id, s.max - s.min]));
}

function buildQueryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function TabNav({ tab, flaggedCount }: { tab: TabKey; flaggedCount: number }) {
  const tabs = [
    { key: "overview", label: "Overview", href: "/analytics" },
    { key: "engagement", label: "Engagement", href: "/analytics?tab=engagement" },
    { key: "suspicious", label: "Suspicious activity", href: "/analytics?tab=suspicious" },
  ] as const;
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === t.key ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          {t.label}
          {t.key === "suspicious" && flaggedCount > 0 && (
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: "#dc2626" }}
            >
              {flaggedCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

// A pageview counts as an ad click if it carries a Google gclid or a paid utm_medium.
const AD_CLICK_MATCH: FilterQuery<typeof TrackingEvent> = {
  $or: [{ gclid: { $nin: [null, ""] } }, { "utm.medium": { $in: ["cpc", "ppc"] } }],
};

async function OverviewTab({
  params: { q, from, to, sort, order, page: pageParam, highlight, hideLocal, adOnly, store, range },
  riskContext,
  stores,
}: {
  params: AnalyticsSearchParams;
  riskContext: SessionRiskContext;
  stores: { slug: string; name: string }[];
}) {
  const hideLocalOn = isFlagOn(hideLocal);
  const adOnlyOn = isFlagOn(adOnly);

  // Server-logged rows (middleware records paid no-JS requests for fraud
  // detection) are excluded from traffic stats — they'd double-count real
  // visitors whose client beacon also fired.
  // Conditions that scope the whole tab (date range, hide-local, ad-only,
  // store) — these also bound the top-lists/stat tiles, which ignore the
  // free-text search box on purpose (search only narrows the table below).
  const dateMatch: FilterQuery<typeof TrackingEvent> = { source: { $ne: "server" } };
  const scopeConditions: FilterQuery<typeof TrackingEvent>[] = [];
  if (hideLocalOn) {
    scopeConditions.push({ country: { $nin: LOCAL_COUNTRIES } }, { ip: { $nin: LOCAL_IPS } });
  }
  if (adOnlyOn) {
    scopeConditions.push(AD_CLICK_MATCH);
  }
  if (store) {
    scopeConditions.push({ path: storePathRegex(store) });
  }
  const timeMatch = resolveTimeMatch(from, to, range);
  if (timeMatch) dateMatch.createdAt = timeMatch;
  if (scopeConditions.length > 0) dateMatch.$and = scopeConditions;

  const filter: FilterQuery<typeof TrackingEvent> = { ...dateMatch };
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ path: regex }, { referrer: regex }, { country: regex }, { deviceId: regex }, { ip: regex }];
  }

  const sortField = sort && SORTABLE_FIELDS.has(sort) ? sort : "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;
  const page = Math.max(1, Number(pageParam) || 1);

  const [events, total, topPages, topReferrers, topIps, sessionCount, newDeviceCount] = await Promise.all([
    TrackingEvent.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    TrackingEvent.countDocuments(filter),
    TrackingEvent.aggregate([
      { $match: dateMatch },
      { $group: { _id: "$path", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    TrackingEvent.aggregate([
      { $match: { ...dateMatch, referrer: { $nin: [null, ""] } } },
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    TrackingEvent.aggregate([
      { $match: { ...dateMatch, ip: { $nin: [null, ""] } } },
      { $group: { _id: "$ip", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    TrackingEvent.aggregate([{ $match: dateMatch }, { $group: { _id: "$sessionId" } }, { $count: "sessions" }]),
    TrackingEvent.countDocuments({ ...dateMatch, isNewDevice: true }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = {
    q,
    from,
    to,
    sort,
    order,
    store,
    range,
    hideLocal: hideLocalOn ? undefined : "0",
    adOnly: adOnlyOn ? undefined : "0",
  };
  const sessions = sessionCount[0]?.sessions ?? 0;
  const avgViewsPerSession = sessions > 0 ? (total / sessions).toFixed(1) : "—";
  // This tab's exact URL (filters/sort/page) — carried through session links so a
  // hard navigation to the full session page can return here precisely.
  const returnTo = `/analytics${buildQueryString({ ...baseParams, page: String(page) })}`;

  // Risk-score the sessions visible on this page so their links can be tinted.
  const riskMap = await scoreSessionsByIds(events.map((e) => e.sessionId), riskContext);
  const [durationMap, paidSessions] = await Promise.all([
    getSessionDurations(events.map((e) => e.sessionId)),
    getPaidSessions(events.map((e) => e.sessionId)),
  ]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Page views" value={total.toLocaleString()} />
        <StatTile label="Sessions" value={sessions.toLocaleString()} />
        <StatTile label="Avg. views / session" value={avgViewsPerSession} />
        <StatTile label="New devices" value={newDeviceCount.toLocaleString()} />
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-base border border-border bg-surface p-4">
        <input type="hidden" name="tab" value="overview" />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="path, referrer, country, device id, IP"
            className="w-64 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <RangeControls range={range} from={from} to={to} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sortField}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="createdAt">Date</option>
            <option value="path">Path</option>
            <option value="country">Country</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="order">
            Order
          </label>
          <select
            id="order"
            name="order"
            defaultValue={order === "asc" ? "asc" : "desc"}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
        <StoreSelect stores={stores} value={store} />
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-text-muted" title="Hides visits whose IP country is Pakistan or India, or whose IP is localhost (::1) — your own and your team's browsing. On by default.">
          <input type="hidden" name="hideLocal" value="0" />
          <input type="checkbox" name="hideLocal" value="1" defaultChecked={hideLocalOn} className="h-4 w-4 accent-brand-primary" />
          Hide my traffic (PK/IN)
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-text-muted" title="Shows only visits that carried a Google Ads click ID (gclid) or utm_medium=cpc/ppc. On by default.">
          <input type="hidden" name="adOnly" value="0" />
          <input type="checkbox" name="adOnly" value="1" defaultChecked={adOnlyOn} className="h-4 w-4 accent-brand-primary" />
          Ad clicks only
        </label>
        <button
          type="submit"
          className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          Filter
        </button>
        {(q || from || to || store || (range && range !== DEFAULT_RANGE) || !hideLocalOn || !adOnlyOn) && (
          <Link href="/analytics" className="text-sm text-text-muted hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BarList title="Top pages" items={topPages.map((p) => ({ label: p._id ?? "(unknown)", value: p.count }))} />
        <BarList
          title="Top referrers"
          items={topReferrers.map((r) => ({ label: r._id, value: r.count }))}
          emptyLabel="No referred traffic yet."
        />
        <BarList title="Top IPs (for Google Ads exclusions)" items={topIps.map((ip) => ({ label: ip._id, value: ip.count }))} />
      </div>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">
                When
                <TimeZoneHeaderNote />
              </th>
              <th className="p-3">Page</th>
              <th className="p-3">Traffic</th>
              <th className="p-3">Session</th>
              <th className="p-3">Visitor</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const ua = e.userAgent ? new UAParser(e.userAgent).getResult() : null;
              const utm = [e.utm?.source, e.utm?.medium, e.utm?.campaign].filter(Boolean).join(" / ");
              const location = [e.city, e.region, e.country].filter(Boolean).join(", ");
              const browser = ua ? `${ua.browser.name ?? "?"} · ${ua.os.name ?? "?"} · ${ua.device.type ?? "desktop"}` : null;
              return (
                <tr key={String(e._id)} className="border-b border-border align-top last:border-0 hover:bg-surface-muted">
                  <td className="p-3 whitespace-nowrap text-text-muted">
                    <TimeCell iso={e.createdAt.toISOString()} visitorTimeZone={e.timezone} />
                  </td>
                  <td className="max-w-[240px] p-3">
                    <div className="truncate font-mono text-xs" title={e.path}>
                      {e.path}
                    </div>
                    {e.referrer && (
                      <div className="truncate text-[11px] text-text-muted" title={e.referrer}>
                        from {e.referrer.replace(/^https?:\/\/(www\.)?/, "")}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <TrafficBadge paid={paidSessions.has(e.sessionId)} referrer={e.referrer} />
                    {utm && (
                      <div className="mt-1 max-w-[150px] truncate text-[11px] text-text-muted" title={utm}>
                        {utm}
                      </div>
                    )}
                    {e.utm?.term && (
                      <div className="max-w-[150px] truncate text-[11px] font-medium" title={`Keyword: ${e.utm.term}`}>
                        kw: {e.utm.term}
                      </div>
                    )}
                    {e.utm?.content && (
                      <div className="max-w-[150px] truncate text-[11px] text-text-muted" title={`Ad/creative: ${e.utm.content}`}>
                        {e.utm.content}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <RiskSessionLink
                      sessionId={e.sessionId}
                      level={riskMap.get(e.sessionId)?.level ?? "low"}
                      reasons={riskMap.get(e.sessionId)?.flags.map((f) => f.detail) ?? []}
                      returnTo={returnTo}
                      highlighted={e.sessionId === highlight}
                    />
                    <div className="mt-1 whitespace-nowrap text-[11px] text-text-muted">
                      <span className="tabular-nums">{formatDuration(durationMap.get(e.sessionId))}</span>
                      {" · "}
                      <span className="font-mono" title={`Device ${e.deviceId}`}>
                        {e.deviceId.slice(0, 8)}
                      </span>
                      {e.isNewDevice && (
                        <span
                          className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 16%, var(--surface-muted))", color: "var(--brand-accent)" }}
                        >
                          new
                        </span>
                      )}
                    </div>
                    {e.fingerprintId && (
                      <div className="mt-0.5 whitespace-nowrap text-[11px] text-text-muted">
                        <span className="font-mono" title={`Fingerprint ${e.fingerprintId}`}>
                          fp:{e.fingerprintId.slice(0, 8)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="max-w-[190px] p-3">
                    <div className="truncate font-mono text-xs">{e.ip ?? "—"}</div>
                    {location && <div className="truncate text-[11px] text-text-muted">{location}</div>}
                    {browser && (
                      <div className="truncate text-[11px] text-text-muted" title={e.userAgent ?? undefined}>
                        {browser}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No tracked events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link href={`/analytics${buildQueryString({ ...baseParams, page: String(page - 1) })}`} className="text-brand-primary hover:underline">
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/analytics${buildQueryString({ ...baseParams, page: String(page + 1) })}`} className="text-brand-primary hover:underline">
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function formatEngagementValue(type: string, value: number | null | undefined) {
  if (value == null) return "—";
  if (type === "dwell") return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
  if (type === "scroll_depth") return `${value}%`;
  return String(value);
}

async function EngagementTab({
  params: { q, type, from, to, page: pageParam, highlight, store, range },
  riskContext,
  stores,
}: {
  params: AnalyticsSearchParams;
  riskContext: SessionRiskContext;
  stores: { slug: string; name: string }[];
}) {
  // Scopes the whole tab (date range, store) — also bounds the stat tiles
  // and top-lists below, which ignore the free-text search box on purpose.
  const dateMatch: FilterQuery<typeof EngagementEvent> = {};
  const timeMatch = resolveTimeMatch(from, to, range);
  if (timeMatch) dateMatch.createdAt = timeMatch;
  if (store) dateMatch.storeSlug = store;

  const filter: FilterQuery<typeof EngagementEvent> = { ...dateMatch };
  if (type && ENGAGEMENT_TYPES.includes(type as (typeof ENGAGEMENT_TYPES)[number])) filter.type = type;
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ path: regex }, { storeSlug: regex }, { couponCode: regex }, { destinationUrl: regex }];
  }

  const page = Math.max(1, Number(pageParam) || 1);

  const [events, total, avgDwell, affiliateClickCount, couponCopyCount, scrollFunnel, topAffiliateClicks, topCopies] =
    await Promise.all([
      EngagementEvent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      EngagementEvent.countDocuments(filter),
      EngagementEvent.aggregate([{ $match: { ...dateMatch, type: "dwell" } }, { $group: { _id: null, avg: { $avg: "$value" } } }]),
      EngagementEvent.countDocuments({ ...dateMatch, type: "affiliate_click" }),
      EngagementEvent.countDocuments({ ...dateMatch, type: "coupon_copy" }),
      EngagementEvent.aggregate([
        { $match: { ...dateMatch, type: "scroll_depth" } },
        { $group: { _id: "$value", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      EngagementEvent.aggregate([
        { $match: { ...dateMatch, type: "affiliate_click" } },
        { $group: { _id: { storeSlug: "$storeSlug", couponId: "$couponId" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      EngagementEvent.aggregate([
        { $match: { ...dateMatch, type: "coupon_copy" } },
        { $group: { _id: { storeSlug: "$storeSlug", couponCode: "$couponCode" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = { tab: "engagement", q, type, from, to, store, range };
  const avgDwellMs = avgDwell[0]?.avg ?? null;
  const returnTo = `/analytics${buildQueryString({ ...baseParams, page: String(page) })}`;
  const couponLabels = await resolveCouponLabels([
    ...events.map((e) => e.couponId),
    ...topAffiliateClicks.map((c) => c._id.couponId),
  ]);
  const riskMap = await scoreSessionsByIds(events.map((e) => e.sessionId), riskContext);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Avg. dwell time" value={avgDwellMs != null ? formatEngagementValue("dwell", Math.round(avgDwellMs)) : "—"} />
        <StatTile label="Engagement events" value={total.toLocaleString()} />
        <StatTile label="Affiliate clicks" value={affiliateClickCount.toLocaleString()} />
        <StatTile label="Coupon copies" value={couponCopyCount.toLocaleString()} />
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-base border border-border bg-surface p-4">
        <input type="hidden" name="tab" value="engagement" />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="eq">
            Search
          </label>
          <input
            id="eq"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="path, store, coupon code, destination"
            className="w-64 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="">All types</option>
            {ENGAGEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENGAGEMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <RangeControls range={range} from={from} to={to} idPrefix="e" />
        <StoreSelect stores={stores} value={store} />
        <button
          type="submit"
          className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          Filter
        </button>
        {(q || type || from || to || store || (range && range !== DEFAULT_RANGE)) && (
          <Link href="/analytics?tab=engagement" className="text-sm text-text-muted hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BarList
          title="Scroll depth reached"
          items={scrollFunnel.map((s) => ({ label: `${s._id}%`, value: s.count }))}
          emptyLabel="No scroll data yet."
        />
        <BarList
          title="Top affiliate clicks"
          items={topAffiliateClicks.map((c) => {
            const couponTitle = c._id.couponId ? couponLabels.get(c._id.couponId)?.title : undefined;
            const label = [c._id.storeSlug ?? "(unknown)", couponTitle].filter(Boolean).join(" · ");
            return { label, value: c.count };
          })}
        />
        <BarList
          title="Top coupon copies"
          items={topCopies.map((c) => ({ label: `${c._id.storeSlug ?? "(unknown)"} · ${c._id.couponCode ?? "—"}`, value: c.count }))}
        />
      </div>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">
                When
                <TimeZoneHeaderNote />
              </th>
              <th className="p-3">Type</th>
              <th className="p-3">Path</th>
              <th className="p-3">Store</th>
              <th className="p-3">Coupon</th>
              <th className="p-3">Value</th>
              <th className="p-3">Session</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={String(e._id)} className="border-b border-border align-top last:border-0 hover:bg-surface-muted">
                <td className="p-3 whitespace-nowrap text-text-muted">
                  <TimeCell iso={e.createdAt.toISOString()} />
                </td>
                <td className="p-3">
                  <EventTypeBadge type={e.type} />
                </td>
                <td className="p-3 font-mono text-xs">{e.path}</td>
                <td className="p-3 text-text-muted">{e.storeSlug ?? "—"}</td>
                <td className="p-3 text-text-muted">
                  {e.couponId && couponLabels.get(e.couponId) ? (
                    <span title={e.couponId}>
                      {couponLabels.get(e.couponId)!.title}
                      {e.couponCode && <span className="ml-1 font-mono text-xs">({e.couponCode})</span>}
                    </span>
                  ) : (
                    <span className="font-mono text-xs">{e.couponCode ?? e.couponId ?? "—"}</span>
                  )}
                </td>
                <td className="p-3 tabular-nums">{formatEngagementValue(e.type, e.value)}</td>
                <td className="p-3">
                  <RiskSessionLink
                    sessionId={e.sessionId}
                    level={riskMap.get(e.sessionId)?.level ?? "low"}
                    reasons={riskMap.get(e.sessionId)?.flags.map((f) => f.detail) ?? []}
                    returnTo={returnTo}
                    highlighted={e.sessionId === highlight}
                  />
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-text-muted">
                  No engagement events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link href={`/analytics${buildQueryString({ ...baseParams, page: String(page - 1) })}`} className="text-brand-primary hover:underline">
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/analytics${buildQueryString({ ...baseParams, page: String(page + 1) })}`} className="text-brand-primary hover:underline">
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

const REASON_OPTIONS = Object.entries(FLAG_LABELS)
  .map(([code, label]) => ({ code, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

function RiskBadge({ level }: { level: RiskLevel }) {
  if (level === "low") return null;
  const style =
    level === "high"
      ? { bg: "color-mix(in srgb, #dc2626 16%, var(--surface-muted))", color: "#dc2626", label: "High risk" }
      : { bg: "color-mix(in srgb, #d97706 16%, var(--surface-muted))", color: "#d97706", label: "Medium risk" };
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

type ReviewedFilter = "all" | "unread" | "read";

function normalizeReviewedFilter(value?: string): ReviewedFilter {
  return value === "all" || value === "read" ? value : "unread";
}

function SuspiciousTab({
  flagged,
  page: pageParam,
  highlight,
  hideLocalOn,
  reviewedIds,
  reviewedFilterParam,
  reasonFilterParam,
  paidOnlyParam,
}: {
  flagged: FlaggedSession[];
  page?: string;
  highlight?: string;
  hideLocalOn: boolean;
  /** sessionIds with a SuspiciousReview row — marked "read" by the admin. */
  reviewedIds: Set<string>;
  reviewedFilterParam?: string;
  /** A flag code (e.g. "fp_reset") to narrow to sessions carrying that reason; unset/unknown means all reasons. */
  reasonFilterParam?: string;
  /** "1" shows only sessions that arrived via a paid ad click (gclid or utm_medium=cpc/ppc). Off by default — unlike Overview, this tab is for catching abuse across all traffic, not just paid. */
  paidOnlyParam?: string;
}) {
  const page = Math.max(1, Number(pageParam) || 1);
  const hideLocalParam = hideLocalOn ? undefined : "0";
  const reviewedFilter = normalizeReviewedFilter(reviewedFilterParam);
  const reviewedParam = reviewedFilter === "unread" ? undefined : reviewedFilter;
  const reasonFilter = reasonFilterParam && FLAG_LABELS[reasonFilterParam] ? reasonFilterParam : undefined;
  const paidOnly = paidOnlyParam === "1";
  const paidOnlyParamOut = paidOnly ? "1" : undefined;
  const returnTo = `/analytics${buildQueryString({ tab: "suspicious", page: String(page), hideLocal: hideLocalParam, reviewed: reviewedParam, reason: reasonFilter, paidOnly: paidOnlyParamOut })}`;

  // "Unread" is the default view — sessions the admin has already looked at
  // and dismissed as not actually suspicious drop out of the list, keeping
  // it focused on what still needs judgment. The reason filter (if set)
  // further narrows to sessions flagged for that specific reason; paidOnly
  // narrows to sessions that arrived via a paid ad click.
  const visibleFlagged = flagged.filter((f) => {
    const isRead = reviewedIds.has(f.sessionId);
    if (reviewedFilter === "read" && !isRead) return false;
    if (reviewedFilter === "unread" && isRead) return false;
    if (reasonFilter && !f.result.flags.some((fl) => fl.code === reasonFilter)) return false;
    if (paidOnly && !f.paid) return false;
    return true;
  });

  const highCount = visibleFlagged.filter((f) => f.result.level === "high").length;
  const distinctIps = Array.from(new Set(visibleFlagged.map((f) => f.ip).filter((ip): ip is string => !!ip)));
  const paidWasted = visibleFlagged.filter((f) => !!f.gclid).length;

  // Reason frequency across the visible flagged sessions, for the breakdown chart.
  const reasonCounts = new Map<string, number>();
  for (const f of visibleFlagged) {
    for (const flag of f.result.flags) {
      reasonCounts.set(flag.code, (reasonCounts.get(flag.code) ?? 0) + 1);
    }
  }
  const reasonItems = Array.from(reasonCounts.entries())
    .map(([code, count]) => ({ label: FLAG_LABELS[code] ?? code, value: count }))
    .sort((a, b) => b.value - a.value);

  // IPs worth blocking first: those tied to any high-risk session.
  const highRiskIps = Array.from(
    new Set(visibleFlagged.filter((f) => f.result.level === "high").map((f) => f.ip).filter((ip): ip is string => !!ip))
  );

  const totalPages = Math.max(1, Math.ceil(visibleFlagged.length / PAGE_SIZE));
  const pageRows = visibleFlagged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const REVIEW_FILTER_OPTIONS: { value: ReviewedFilter; label: string }[] = [
    { value: "unread", label: "Unread" },
    { value: "read", label: "Read" },
    { value: "all", label: "All" },
  ];

  return (
    <>
      <form className="flex flex-wrap items-end gap-3 rounded-base border border-border bg-surface p-4">
        <input type="hidden" name="tab" value="suspicious" />
        {hideLocalParam && <input type="hidden" name="hideLocal" value={hideLocalParam} />}
        {reviewedParam && <input type="hidden" name="reviewed" value={reviewedParam} />}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="reason">
            Reason
          </label>
          <select
            id="reason"
            name="reason"
            defaultValue={reasonFilter ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="">All reasons</option>
            {REASON_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-text-muted" title="Shows only sessions that carried a Google Ads click ID (gclid) or utm_medium=cpc/ppc.">
          <input type="checkbox" name="paidOnly" value="1" defaultChecked={paidOnly} className="h-4 w-4 accent-brand-primary" />
          Ad clicks only
        </label>
        <button
          type="submit"
          className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          Filter
        </button>
        {(reasonFilter || paidOnly) && (
          <Link
            href={`/analytics${buildQueryString({ tab: "suspicious", hideLocal: hideLocalParam, reviewed: reviewedParam })}`}
            className="text-sm text-text-muted hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex gap-1 rounded-full border border-border p-0.5">
          {REVIEW_FILTER_OPTIONS.map((o) => (
            <Link
              key={o.value}
              href={`/analytics${buildQueryString({ tab: "suspicious", hideLocal: hideLocalParam, reviewed: o.value === "unread" ? undefined : o.value, reason: reasonFilter, paidOnly: paidOnlyParamOut })}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                reviewedFilter === o.value ? "bg-brand-primary text-white" : "text-text-muted hover:text-text"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
        <Link
          href={`/analytics${buildQueryString({ tab: "suspicious", reviewed: reviewedParam, hideLocal: hideLocalOn ? "0" : undefined, reason: reasonFilter, paidOnly: paidOnlyParamOut })}`}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            hideLocalOn
              ? "border-brand-primary text-brand-primary"
              : "border-border text-text-muted hover:text-text"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-sm border ${hideLocalOn ? "border-brand-primary bg-brand-primary" : "border-border"}`}
            aria-hidden="true"
          />
          Hide my traffic (PK/IN)
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Flagged sessions" value={visibleFlagged.length.toLocaleString()} hint={`last ${RISK_WINDOW_DAYS} days`} />
        <StatTile label="High risk" value={highCount.toLocaleString()} />
        <StatTile label="Suspicious IPs" value={distinctIps.length.toLocaleString()} />
        <StatTile label="Flagged paid clicks" value={paidWasted.toLocaleString()} hint="had a Google gclid" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BarList title="Why sessions were flagged" items={reasonItems} emptyLabel="No suspicious sessions detected." />
        <div className="rounded-base border border-border bg-surface p-4">
          <p className="mb-1 text-xs font-medium text-text-muted">Block these IPs in Google Ads</p>
          <p className="mb-3 text-xs text-text-muted">
            IPs tied to high-risk sessions. Paste into your campaign&rsquo;s IP exclusion list (Settings → Additional settings → IP
            exclusions).
          </p>
          <CopyableList values={highRiskIps} emptyLabel="No high-risk IPs to block right now." />
        </div>
      </div>

      <form
        id="export-fraud-report"
        action="/api/analytics/export-fraud-report"
        method="GET"
        target="_blank"
        className="flex items-center justify-between gap-3 rounded-base border border-border bg-surface p-3"
      >
        <p className="text-xs text-text-muted">
          Check the sessions below, then export a PDF report — evidence and a suggested message to send Google Ads
          support.
        </p>
        <button
          type="submit"
          className="shrink-0 rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
        >
          Export selected for Google Ads
        </button>
      </form>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3">
                When
                <TimeZoneHeaderNote />
              </th>
              <th className="p-3">Risk</th>
              <th className="p-3">Session</th>
              <th className="p-3">IP</th>
              <th className="p-3">Location</th>
              <th className="p-3">Traffic</th>
              <th className="p-3">Reasons</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((f) => {
              const isRead = reviewedIds.has(f.sessionId);
              return (
                <tr key={f.sessionId} className="border-b border-border align-top last:border-0 hover:bg-surface-muted">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      name="sessionId"
                      value={f.sessionId}
                      form="export-fraud-report"
                      aria-label={`Select session ${f.sessionId.slice(0, 8)} for export`}
                      className="h-4 w-4 accent-brand-primary"
                    />
                  </td>
                  <td className="p-3 whitespace-nowrap text-text-muted">
                    <TimeCell iso={f.at.toISOString()} visitorTimeZone={f.timezone} />
                  </td>
                  <td className="p-3">
                    <RiskBadge level={f.result.level} />
                  </td>
                  <td className="p-3">
                    <RiskSessionLink
                      sessionId={f.sessionId}
                      level={f.result.level}
                      reasons={f.result.flags.map((fl) => fl.detail)}
                      returnTo={returnTo}
                      highlighted={f.sessionId === highlight}
                    />
                  </td>
                  <td className="p-3 font-mono text-xs whitespace-nowrap">{f.ip ?? "—"}</td>
                  <td className="p-3 text-text-muted">{[f.city, f.region, f.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="p-3">
                    <TrafficBadge paid={f.paid} referrer={f.referrer} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {f.result.flags.map((fl) => (
                        <span
                          key={fl.code}
                          title={fl.detail}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: "var(--surface-muted)", color: "var(--text-muted)" }}
                        >
                          {fl.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {isRead ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className="font-medium text-text-muted">Read</span>
                        <form action={markSessionUnreviewed.bind(null, f.sessionId)} className="inline">
                          <button type="submit" className="text-brand-primary hover:underline" title="Bring this session back into the unread list.">
                            Undo
                          </button>
                        </form>
                      </span>
                    ) : (
                      <form action={markSessionReviewed.bind(null, f.sessionId)}>
                        <button type="submit" className="text-xs text-brand-primary hover:underline" title="Dismiss this session as not actually suspicious.">
                          Mark as read
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibleFlagged.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-text-muted">
                  {flagged.length === 0
                    ? `No suspicious sessions detected in the last ${RISK_WINDOW_DAYS} days. 🎉`
                    : reviewedFilter === "unread" && !reasonFilter && !paidOnly
                      ? "No unread flagged sessions — you're all caught up. 🎉"
                      : "No sessions match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link href={`/analytics${buildQueryString({ tab: "suspicious", page: String(page - 1), hideLocal: hideLocalParam, reviewed: reviewedParam, reason: reasonFilter, paidOnly: paidOnlyParamOut })}`} className="text-brand-primary hover:underline">
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/analytics${buildQueryString({ tab: "suspicious", page: String(page + 1), hideLocal: hideLocalParam, reviewed: reviewedParam, reason: reasonFilter, paidOnly: paidOnlyParamOut })}`} className="text-brand-primary hover:underline">
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  overview: "Visitor traffic across the site.",
  engagement: "On-page behavior: dwell time, scroll depth, affiliate clicks, coupon copies.",
  suspicious: "Sessions that look like bots, competitors, or click fraud — with the reasons why, so you can block them.",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const tab: TabKey =
    params.tab === "engagement" ? "engagement" : params.tab === "suspicious" ? "suspicious" : "overview";
  await connectToDatabase();

  // Cross-session fraud context + the flagged list are computed once: the
  // context feeds every tab's per-row scoring, and the flagged count drives
  // the badge on the tab bar regardless of which tab is open.
  const riskContext = await buildRiskContext(riskSince());
  const allFlagged = await getFlaggedSessions(riskContext, riskSince());
  const hideLocalOn = isFlagOn(params.hideLocal);
  // "Hide my traffic" applies to the flagged list (and its tab badge) too —
  // the owner testing their own site from PK shouldn't show up as a threat.
  const flagged = hideLocalOn ? allFlagged.filter((f) => !isLocalVisitor(f)) : allFlagged;

  // Which of the currently-flagged sessions the admin has already reviewed
  // and dismissed — drives the "Unread"/"Read"/"All" filter and the tab
  // badge (which counts unread only, so it reflects what still needs a look).
  const reviewedDocs = await SuspiciousReview.find({ sessionId: { $in: flagged.map((f) => f.sessionId) } }, "sessionId").lean();
  const reviewedIds = new Set(reviewedDocs.map((d) => d.sessionId));
  const unreadFlaggedCount = flagged.filter((f) => !reviewedIds.has(f.sessionId)).length;

  const stores = await Store.find({}, "name slug").sort({ name: 1 }).lean();
  const storeOptions = stores.map((s) => ({ slug: s.slug, name: s.name }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-text-muted">{TAB_DESCRIPTIONS[tab]}</p>
      </div>

      <TabNav tab={tab} flaggedCount={unreadFlaggedCount} />

      {tab === "overview" && <OverviewTab params={params} riskContext={riskContext} stores={storeOptions} />}
      {tab === "engagement" && <EngagementTab params={params} riskContext={riskContext} stores={storeOptions} />}
      {tab === "suspicious" && (
        <SuspiciousTab
          flagged={flagged}
          page={params.page}
          highlight={params.highlight}
          hideLocalOn={hideLocalOn}
          reviewedIds={reviewedIds}
          reviewedFilterParam={params.reviewed}
          reasonFilterParam={params.reason}
          paidOnlyParam={params.paidOnly}
        />
      )}

      <HighlightScroller targetId={params.highlight} />
    </div>
  );
}
