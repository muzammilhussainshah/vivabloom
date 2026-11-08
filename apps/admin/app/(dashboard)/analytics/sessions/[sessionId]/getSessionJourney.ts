import { UAParser } from "ua-parser-js";
import { connectToDatabase, TrackingEvent, EngagementEvent } from "@monocoupon/db";
import { resolveCouponLabels } from "@/lib/couponLabels";
import { buildRiskContext, scoreSession, getFingerprintAssociates } from "@/lib/fraudSignals";

export function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export type TimelineEntry =
  | { kind: "pageview"; at: Date; path: string; referrer: string | null }
  | {
      kind: "engagement";
      at: Date;
      path: string;
      type: string;
      value: number | null;
      storeSlug: string | null;
      couponCode: string | null;
      couponTitle: string | null;
    };

// --- Plain-script (no AI) narrative summary -------------------------------
// Deterministic templates over the same data already shown in the timeline.
// Kept intentionally simple: it describes what happened, in the order it
// happened, without trying to be clever about intent.

function describeSource(referrer?: string | null, utm?: { source?: string | null; medium?: string | null; term?: string | null } | null) {
  if (utm?.source) return `a ${utm.source}${utm.medium ? `/${utm.medium}` : ""} campaign${utm.term ? ` (keyword: "${utm.term}")` : ""}`;
  if (!referrer) return "directly, with no referrer";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("google")) return "a Google search";
    if (host.includes("bing")) return "a Bing search";
    if (host.includes("duckduckgo")) return "a DuckDuckGo search";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("twitter") || host.includes("t.co") || host.includes("x.com")) return "X/Twitter";
    return host;
  } catch {
    return "an unknown source";
  }
}

function describeLocation(country?: string | null, region?: string | null, city?: string | null) {
  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "an unknown location";
}

function describeDevice(userAgent?: string | null) {
  if (!userAgent) return "an unknown device";
  const ua = new UAParser(userAgent).getResult();
  const browser = ua.browser.name ?? "an unknown browser";
  const os = ua.os.name ?? "an unknown OS";
  const deviceType = ua.device.type ?? "desktop";
  return `${browser} on ${os} (${deviceType})`;
}

function formatClockTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Groups the timeline into one segment per pageview, with its subsequent engagement events attached. */
function groupByPageview(timeline: TimelineEntry[]) {
  const segments: { pageview: Extract<TimelineEntry, { kind: "pageview" }>; actions: Extract<TimelineEntry, { kind: "engagement" }>[] }[] = [];
  for (const item of timeline) {
    if (item.kind === "pageview") {
      segments.push({ pageview: item, actions: [] });
    } else if (segments.length > 0) {
      segments[segments.length - 1].actions.push(item);
    }
  }
  return segments;
}

function describeSegmentActions(actions: Extract<TimelineEntry, { kind: "engagement" }>[]) {
  const parts: string[] = [];

  const scrollEvents = actions.filter((a) => a.type === "scroll_depth" && a.value != null);
  if (scrollEvents.length > 0) {
    const maxScroll = Math.max(...scrollEvents.map((a) => a.value!));
    parts.push(`scrolled to ${maxScroll}% of the page`);
  }

  for (const a of actions.filter((a) => a.type === "coupon_copy")) {
    const name = a.couponTitle ?? a.couponCode ?? "a coupon code";
    parts.push(`copied the code for "${name}"${a.couponCode ? ` (${a.couponCode})` : ""}`);
  }

  for (const a of actions.filter((a) => a.type === "affiliate_click")) {
    const name = a.couponTitle ? ` for "${a.couponTitle}"` : "";
    parts.push(`clicked through to the merchant${name}${a.storeSlug ? ` (${a.storeSlug})` : ""}`);
  }

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function buildNarrative(
  timeline: TimelineEntry[],
  entry: {
    country?: string | null;
    region?: string | null;
    city?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    utm?: { source?: string | null; medium?: string | null } | null;
  },
  pageviewCount: number,
  engagementCount: number,
  durationMs: number
): string[] {
  const lines: string[] = [];
  if (timeline.length === 0) return lines;

  const first = timeline[0];
  lines.push(
    `A visitor from ${describeLocation(entry.country, entry.region, entry.city)} arrived via ${describeSource(entry.referrer, entry.utm)} at ${formatClockTime(first.at)}, using ${describeDevice(entry.userAgent)}.`
  );

  const seenPaths = new Set<string>();
  const segments = groupByPageview(timeline);
  for (const { pageview, actions } of segments) {
    const isRevisit = seenPaths.has(pageview.path);
    seenPaths.add(pageview.path);
    const verb = isRevisit ? "returned to" : "landed on";
    const actionText = describeSegmentActions(actions);
    lines.push(
      actionText
        ? `At ${formatClockTime(pageview.at)}, they ${verb} ${pageview.path} and ${actionText}.`
        : `At ${formatClockTime(pageview.at)}, they ${verb} ${pageview.path}.`
    );
  }

  lines.push(
    `In total, the session lasted ${formatDuration(durationMs)} across ${pageviewCount} page view${pageviewCount === 1 ? "" : "s"} and ${engagementCount} tracked interaction${engagementCount === 1 ? "" : "s"}.`
  );

  return lines;
}

// ---------------------------------------------------------------------------

export async function getSessionJourney(sessionId: string) {
  await connectToDatabase();

  const [pageviews, engagements] = await Promise.all([
    TrackingEvent.find({ sessionId }).sort({ createdAt: 1 }).lean(),
    EngagementEvent.find({ sessionId }).sort({ createdAt: 1 }).lean(),
  ]);

  const couponLabels = await resolveCouponLabels(engagements.map((e) => e.couponId));

  const timeline: TimelineEntry[] = [
    ...pageviews.map((e): TimelineEntry => ({ kind: "pageview", at: e.createdAt, path: e.path, referrer: e.referrer ?? null })),
    ...engagements.map((e): TimelineEntry => ({
      kind: "engagement",
      at: e.createdAt,
      path: e.path,
      type: e.type,
      value: e.value ?? null,
      storeSlug: e.storeSlug ?? null,
      couponCode: e.couponCode ?? null,
      couponTitle: e.couponId ? couponLabels.get(e.couponId)?.title ?? null : null,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const first = pageviews[0];

  // Duration spans the FULL timeline (pageviews + engagement events), not
  // just pageviews — a single-pageview session with a click a second later
  // previously reported "0s" because first/last pageview were the same row.
  const allTimes = timeline.map((t) => t.at.getTime());
  const durationMs = allTimes.length > 0 ? Math.max(...allTimes) - Math.min(...allTimes) : 0;
  const duration = timeline.length > 0 ? formatDuration(durationMs) : "—";
  const deviceId = first?.deviceId?.slice(0, 8) ?? "—";
  const fingerprintId = first?.fingerprintId?.slice(0, 8) ?? "—";

  const summary = first
    ? buildNarrative(
        timeline,
        { country: first.country, region: first.region, city: first.city, userAgent: first.userAgent, referrer: first.referrer, utm: first.utm },
        pageviews.length,
        engagements.length,
        durationMs
      )
    : [];

  // Fraud/abuse verdict for this one session, with the reasons it was flagged.
  const riskWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const riskContext = await buildRiskContext(riskWindowStart);
  const risk = scoreSession(pageviews, engagements, riskContext);
  const suspectIp = first?.ip ?? null;

  // When flagged as a fingerprint reset, resolve the count into the actual
  // cookie deviceIds + IPs behind it, so the admin can block them instead of
  // just knowing "how many" there are.
  const fingerprintAssociates =
    first?.fingerprintId && risk.flags.some((f) => f.code === "fp_reset")
      ? await getFingerprintAssociates(first.fingerprintId, riskWindowStart)
      : null;

  // Ad attribution — the click ID and campaign/keyword parameters from the
  // landing pageview. gclid or utm can appear on a later row if the landing
  // beacon was lost, so fall back to the first pageview that carries either.
  const adSource = pageviews.find((p) => p.gclid || p.utm?.source) ?? null;
  const ad = adSource
    ? {
        gclid: adSource.gclid ?? null,
        source: adSource.utm?.source ?? null,
        medium: adSource.utm?.medium ?? null,
        campaign: adSource.utm?.campaign ?? null,
        term: adSource.utm?.term ?? null,
        content: adSource.utm?.content ?? null,
      }
    : null;

  return {
    ad,
    pageviewCount: pageviews.length,
    engagementCount: engagements.length,
    duration,
    deviceId,
    fingerprintId,
    timeline,
    summary,
    risk,
    suspectIp,
    fingerprintAssociates,
  };
}

export type SessionJourneyData = Awaited<ReturnType<typeof getSessionJourney>>;
