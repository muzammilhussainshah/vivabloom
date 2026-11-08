import { connectToDatabase, TrackingEvent, EngagementEvent } from "@monocoupon/db";

/**
 * Rule-based, fully deterministic (no AI) fraud/abuse scoring for visitor
 * sessions. Every flag is explainable: it carries the human-readable reason
 * it fired. Nothing here proves intent — it surfaces evidence so the admin
 * can decide what to block in their Google Ads campaign.
 */

export type RiskLevel = "high" | "medium" | "low";

/**
 * Canonical registry of every flag code scoreSession can produce, mapped to
 * its short display label. Individual RiskFlag objects already carry their
 * own `label`, but callers that need the *full universe* of possible codes
 * (e.g. a "filter by reason" dropdown, or a report listing what each code
 * means) can't get that from scored data alone — only sessions that
 * actually triggered a flag would be represented there.
 */
export const FLAG_LABELS: Record<string, string> = {
  automation_ua: "Bot user-agent",
  no_fingerprint: "No device fingerprint",
  instant_click: "Instant click",
  no_engagement: "No engagement",
  paid_bounce: "Paid bounce",
  tz_mismatch: "Timezone mismatch",
  ip_flooding: "IP flooding",
  cookie_resetting: "Cookie resetting",
  serial_clicker: "Serial clicker",
  ip_hopping: "IP hopping",
  no_js: "No JavaScript",
  webdriver: "Automation browser",
  ua_ch_mismatch: "Forged browser identity",
  device_contradiction: "Device contradiction",
  datacenter_ip: "Datacenter IP",
  synthetic_click: "Synthetic click",
  fp_reset: "Same device, new cookies",
};

export interface RiskFlag {
  code: string;
  /** Short label for chips/badges. */
  label: string;
  /** Full sentence shown in the session verdict panel. */
  detail: string;
  weight: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  flags: RiskFlag[];
}

// --- Tunable thresholds ----------------------------------------------------
const HIGH_THRESHOLD = 6;
const MEDIUM_THRESHOLD = 3;

const INSTANT_CLICK_MS = 3000; // affiliate click faster than a human can read
const PAID_BOUNCE_MS = 5000; // paid visit that left almost immediately
const IP_FLOOD_SESSIONS = 8; // distinct sessions from one IP in the window
const IP_RESET_NEW_DEVICES = 5; // new-device sessions from one IP (cookie clearing)
const DEVICE_SERIAL_CLICKS = 5; // affiliate clicks from one device across sessions
const DEVICE_IP_HOP = 5; // distinct IPs one device connects from (VPN/proxy rotation)
const FP_RESET_DEVICES = 4; // cookie identities one hardware fingerprint has appeared under

// Headless browsers, scrapers, HTTP libraries, and known crawlers.
const BOT_UA_RE =
  /bot|crawl|spider|headless|phantom|slurp|python|curl|wget|scrapy|http-?client|go-http|java\/|okhttp|axios|node-fetch|puppeteer|playwright|selenium|lighthouse|dataprovider|semrush|ahrefs|mj12|dotbot/i;

export interface SessionRiskContext {
  ipSessionCounts: Map<string, number>;
  ipNewDeviceCounts: Map<string, number>;
  deviceClickCounts: Map<string, number>;
  deviceIpCounts: Map<string, number>;
  /** Distinct cookie deviceIds seen per hardware fingerprint — cookie clearing collapses here. */
  fpDeviceCounts: Map<string, number>;
  /** Distinct IPs seen per hardware fingerprint — IP rotation that survives cookie clearing. */
  fpIpCounts: Map<string, number>;
}

// Minimal shapes so lean() docs from either app slot in without coupling.
interface PageviewLike {
  createdAt: Date;
  ip?: string | null;
  deviceId: string;
  userAgent?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  timezone?: string | null;
  clientTimezone?: string | null;
  gclid?: string | null;
  referrer?: string | null;
  isNewDevice?: boolean | null;
  utm?: { medium?: string | null } | null;
  source?: string | null;
  fingerprintId?: string | null;
  webdriver?: boolean | null;
  maxTouchPoints?: number | null;
  chUa?: string | null;
  chUaMobile?: string | null;
  ipOrg?: string | null;
  ipHosting?: boolean | null;
}
interface EngagementLike {
  createdAt: Date;
  type: string;
  hadPointer?: boolean | null;
}

/**
 * UTC offset (minutes) of an IANA timezone at a given instant, or null if
 * the name can't be resolved. Used instead of comparing zone names directly:
 * deprecated aliases like "America/Indianapolis" vs
 * "America/Indiana/Indianapolis" are the same place with different names and
 * must not count as a VPN mismatch.
 */
function utcOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    if (!name) return null;
    if (name === "GMT" || name === "UTC") return 0;
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    return null;
  }
}

/**
 * Aggregates the cross-session signals (per-IP and per-device stats) that
 * individual sessions are scored against. One-time cost per request; scoped
 * to a rolling window so it stays bounded as raw data accrues forever.
 */
export async function buildRiskContext(since?: Date): Promise<SessionRiskContext> {
  await connectToDatabase();
  const trackMatch = since ? { createdAt: { $gte: since } } : {};

  const [ipSessions, ipNewDevices, deviceClicks, deviceIps, fpDevices, fpIps] = await Promise.all([
    TrackingEvent.aggregate([
      { $match: { ...trackMatch, ip: { $nin: [null, ""] } } },
      { $group: { _id: { ip: "$ip", session: "$sessionId" } } },
      { $group: { _id: "$_id.ip", sessions: { $sum: 1 } } },
    ]),
    TrackingEvent.aggregate([
      { $match: { ...trackMatch, isNewDevice: true, ip: { $nin: [null, ""] } } },
      { $group: { _id: { ip: "$ip", session: "$sessionId" } } },
      { $group: { _id: "$_id.ip", count: { $sum: 1 } } },
    ]),
    EngagementEvent.aggregate([
      { $match: { ...(since ? { createdAt: { $gte: since } } : {}), type: "affiliate_click" } },
      { $group: { _id: "$deviceId", count: { $sum: 1 } } },
    ]),
    // Distinct IPs per device — a device connecting from many IPs is a
    // VPN/proxy-rotation signal (the mirror of cookie resetting).
    TrackingEvent.aggregate([
      { $match: { ...trackMatch, ip: { $nin: [null, ""] } } },
      { $group: { _id: { device: "$deviceId", ip: "$ip" } } },
      { $group: { _id: "$_id.device", ips: { $sum: 1 } } },
    ]),
    // Cookie deviceIds per hardware fingerprint — a fingerprint that keeps
    // reappearing under fresh cookies is one machine faking new visitors.
    TrackingEvent.aggregate([
      { $match: { ...trackMatch, fingerprintId: { $nin: [null, ""] } } },
      { $group: { _id: { fp: "$fingerprintId", device: "$deviceId" } } },
      { $group: { _id: "$_id.fp", devices: { $sum: 1 } } },
    ]),
    // IPs per hardware fingerprint — IP rotation tracking that survives
    // cookie clearing (deviceIpCounts resets with the cookie; this doesn't).
    TrackingEvent.aggregate([
      { $match: { ...trackMatch, fingerprintId: { $nin: [null, ""] }, ip: { $nin: [null, ""] } } },
      { $group: { _id: { fp: "$fingerprintId", ip: "$ip" } } },
      { $group: { _id: "$_id.fp", ips: { $sum: 1 } } },
    ]),
  ]);

  return {
    ipSessionCounts: new Map(ipSessions.map((r) => [r._id as string, r.sessions as number])),
    ipNewDeviceCounts: new Map(ipNewDevices.map((r) => [r._id as string, r.count as number])),
    deviceClickCounts: new Map(deviceClicks.map((r) => [r._id as string, r.count as number])),
    deviceIpCounts: new Map(deviceIps.map((r) => [r._id as string, r.ips as number])),
    fpDeviceCounts: new Map(fpDevices.map((r) => [r._id as string, r.devices as number])),
    fpIpCounts: new Map(fpIps.map((r) => [r._id as string, r.ips as number])),
  };
}

export interface FingerprintAssociate {
  deviceId: string;
  /** Most recent IP seen for this cookie identity. */
  ip: string | null;
  /** All distinct IPs this cookie identity has connected from. */
  ips: string[];
  sessionCount: number;
  lastSeen: Date;
}

/**
 * The concrete cookie deviceIds + IPs behind one hardware fingerprint — the
 * actual list that the fp_reset flag's "N different cookie identities"
 * count summarizes, so the admin can see exactly what to block instead of
 * just a number.
 */
export async function getFingerprintAssociates(fingerprintId: string, since?: Date): Promise<FingerprintAssociate[]> {
  await connectToDatabase();
  const match: Record<string, unknown> = { fingerprintId };
  if (since) match.createdAt = { $gte: since };

  const rows = await TrackingEvent.aggregate([
    { $match: match },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$deviceId",
        ip: { $last: "$ip" },
        ips: { $addToSet: "$ip" },
        sessions: { $addToSet: "$sessionId" },
        lastSeen: { $max: "$createdAt" },
      },
    },
    { $sort: { lastSeen: -1 } },
  ]);

  return rows.map((r) => ({
    deviceId: r._id as string,
    ip: (r.ip as string | null) ?? null,
    ips: (r.ips as (string | null)[]).filter((ip): ip is string => !!ip),
    sessionCount: (r.sessions as string[]).length,
    lastSeen: r.lastSeen as Date,
  }));
}

function levelFor(score: number): RiskLevel {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score >= MEDIUM_THRESHOLD) return "medium";
  return "low";
}

/** Pure scorer — no I/O. Given one session's events + precomputed context, returns its verdict. */
export function scoreSession(
  pageviews: PageviewLike[],
  engagements: EngagementLike[],
  context: SessionRiskContext
): RiskResult {
  const flags: RiskFlag[] = [];
  const add = (code: string, label: string, detail: string, weight: number) => flags.push({ code, label, detail, weight });

  if (pageviews.length === 0) return { score: 0, level: "low", flags };

  // Server-logged pageviews (middleware records paid gclid requests even
  // when no JS runs) duplicate the client beacon for real browsers — score
  // against client events when any exist, and fall back to the server rows
  // only for sessions that never ran JS at all.
  const clientPvs = pageviews.filter((p) => p.source !== "server");
  const pvs = clientPvs.length > 0 ? clientPvs : pageviews;
  const noJs = clientPvs.length === 0;

  const first = pvs[0];
  const allTimes = [...pvs, ...engagements].map((e) => e.createdAt.getTime());
  const durationMs = allTimes.length > 1 ? Math.max(...allTimes) - Math.min(...allTimes) : 0;

  const clicks = engagements.filter((e) => e.type === "affiliate_click").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const hasScroll = engagements.some((e) => e.type === "scroll_depth");
  const isPaid = !!first.gclid || first.utm?.medium === "cpc" || first.utm?.medium === "ppc";

  // 0. Paid page request that never executed JavaScript — no client beacon,
  // no engagement, only the middleware's server-side log. Real browsers
  // always run the tracker; this is a script or headless client fetching
  // the ad's landing page.
  if (noJs) {
    add("no_js", "No JavaScript", "This paid visit loaded the page but never executed JavaScript — no real browser session existed. Almost certainly a script or bot fetching the ad's landing page.", 5);
  }

  // 1. Automation fingerprint — bot/headless/scraper user agent.
  if (first.userAgent && BOT_UA_RE.test(first.userAgent)) {
    add("automation_ua", "Bot user-agent", "The visitor's browser identifies as an automated tool (bot, headless browser, or scraper), not a real person.", 5);
  } else if (!noJs && (!first.userAgent || !first.screenWidth || !first.screenHeight)) {
    add("no_fingerprint", "No device fingerprint", "The visitor reported no user-agent or no screen size — typical of scripted, non-browser traffic.", 3);
  }

  // 1b. navigator.webdriver — the browser itself says it's automation-driven.
  if (first.webdriver === true) {
    add("webdriver", "Automation browser", "The browser reports navigator.webdriver = true — it is being driven by an automation tool (Selenium, Puppeteer, Playwright).", 5);
  }

  // 1c. Forged identity — a "Chrome" user-agent must come with sec-ch-ua
  // client hints (every Chromium build sends them automatically); their
  // absence, or a mobile flag that contradicts the UA, means the UA string
  // is faked. Only judged when the event was collected after CH tracking
  // shipped (chUa === undefined on older rows).
  if (!noJs && first.chUa !== undefined && first.userAgent) {
    const ua = first.userAgent;
    const claimsChromium = /Chrome\/\d/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (claimsChromium && !first.chUa) {
      add("ua_ch_mismatch", "Forged browser identity", "The user-agent claims to be Chrome, but the client-hint headers every real Chrome sends are missing — the browser identity is faked.", 4);
    } else if (claimsChromium && first.chUaMobile) {
      const uaMobile = /Mobile/.test(ua);
      const chMobile = first.chUaMobile === "?1";
      if (uaMobile !== chMobile) {
        add("ua_ch_mismatch", "Forged browser identity", `The user-agent claims a ${uaMobile ? "mobile" : "desktop"} browser but the client-hint headers say ${chMobile ? "mobile" : "desktop"} — the browser identity is faked.`, 4);
      }
    }
  }

  // 1d. Hardware contradiction — a phone with zero touch points isn't a phone.
  if (!noJs && first.maxTouchPoints != null && first.maxTouchPoints === 0 && first.userAgent && /iPhone|Android.+Mobile/.test(first.userAgent)) {
    add("device_contradiction", "Device contradiction", "The user-agent claims a phone, but the device reports zero touch points — a desktop automation tool pretending to be mobile.", 3);
  }

  // 1e. Datacenter IP — real shoppers browse from residential/mobile ISPs,
  // not from AWS/GCP/Azure/Hetzner boxes.
  if (first.ipHosting === true) {
    add("datacenter_ip", "Datacenter IP", `The visitor's IP belongs to a hosting/cloud provider (${first.ipOrg ?? "unknown org"}), not a residential ISP — typical of bots and proxies.`, 4);
  }

  // 2. Instant affiliate click — faster than any human could read the page.
  if (clicks.length > 0) {
    const timeToClick = clicks[0].createdAt.getTime() - first.createdAt.getTime();
    if (timeToClick < INSTANT_CLICK_MS) {
      add("instant_click", "Instant click", `Clicked the affiliate link ${(timeToClick / 1000).toFixed(1)}s after landing — too fast to have read the page.`, 3);
    }
  }

  // 3. Clicked out without any engagement at all.
  if (clicks.length > 0 && !hasScroll) {
    add("no_engagement", "No engagement", "Clicked out to the merchant without ever scrolling the page — no sign of genuine interest.", 2);
  }

  // 3b. Synthetic click — an affiliate click with zero human input (no
  // pointer movement, touch, or key press) anywhere on the page before it.
  if (clicks.some((c) => c.hadPointer === false)) {
    add("synthetic_click", "Synthetic click", "An affiliate link was 'clicked' without any pointer movement, touch, or key press ever happening on the page — a scripted click, not a human one.", 4);
  }

  // 4. Paid visit that bounced within seconds. durationMs of 0 means the
  // session produced a single event and nothing else — the emptiest paid
  // visit possible, so it must flag too.
  if (isPaid && pvs.length === 1 && clicks.length === 0 && durationMs < PAID_BOUNCE_MS) {
    // durationMs is 0 when the session has no second event at all (not even
    // a dwell beacon) to measure against — "<1s" is honest about that rather
    // than implying a real zero.
    const timeLabel = durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}s` : "<1s";
    const detail = `Time: ${timeLabel}.`;
    add("paid_bounce", "Paid bounce", detail, 2);
  }

  // 5. VPN/proxy hint — browser timezone doesn't match the IP's timezone.
  // Compared by UTC offset, not by name: deprecated aliases (e.g.
  // America/Indianapolis vs America/Indiana/Indianapolis) are the same place
  // and must not flag.
  if (first.clientTimezone && first.timezone && first.clientTimezone !== first.timezone) {
    const at = first.createdAt;
    const clientOffset = utcOffsetMinutes(first.clientTimezone, at);
    const ipOffset = utcOffsetMinutes(first.timezone, at);
    if (clientOffset != null && ipOffset != null && clientOffset !== ipOffset) {
      add("tz_mismatch", "Timezone mismatch", `The browser's clock timezone (${first.clientTimezone}) is ${Math.abs(clientOffset - ipOffset) / 60}h apart from the IP location's timezone (${first.timezone}) — a common sign of a VPN or proxy.`, 2);
    }
  }

  // 6. IP flooding — one IP opening many sessions.
  if (first.ip) {
    const ipSessions = context.ipSessionCounts.get(first.ip) ?? 0;
    if (ipSessions >= IP_FLOOD_SESSIONS) {
      add("ip_flooding", "IP flooding", `This IP (${first.ip}) has opened ${ipSessions} separate sessions — far more than a normal visitor.`, 3);
    }
    const resets = context.ipNewDeviceCounts.get(first.ip) ?? 0;
    if (resets >= IP_RESET_NEW_DEVICES) {
      add("cookie_resetting", "Cookie resetting", `This IP has appeared as a brand-new device ${resets} times — a sign of a bot clearing cookies to look like fresh visitors.`, 3);
    }
  }

  // 7. Serial clicker — one device clicking affiliate links across many sessions.
  const deviceClicks = context.deviceClickCounts.get(first.deviceId) ?? 0;
  if (deviceClicks >= DEVICE_SERIAL_CLICKS) {
    add("serial_clicker", "Serial clicker", `This device has clicked affiliate links ${deviceClicks} times across sessions — well beyond normal shopping behavior.`, 3);
  }

  // 8. IP hopping — one device connecting from many IPs. The mirror of
  // cookie resetting: a bot keeping its identity but rotating IPs (via
  // VPN/proxy) to dodge IP blocks. Counted per cookie deviceId AND per
  // hardware fingerprint — the fingerprint count survives cookie clearing,
  // so clearing cookies no longer resets this signal. Heavy mobile use can
  // also hop IPs, so it's a moderate signal rather than a decisive one.
  const deviceIps = context.deviceIpCounts.get(first.deviceId) ?? 0;
  const fpIps = first.fingerprintId ? context.fpIpCounts.get(first.fingerprintId) ?? 0 : 0;
  const hoppedIps = Math.max(deviceIps, fpIps);
  if (hoppedIps >= DEVICE_IP_HOP) {
    add("ip_hopping", "IP hopping", `This device has connected from ${hoppedIps} different IP addresses — a sign of a VPN/proxy rotating IPs to dodge click-fraud blocks (though heavy mobile use can also cause this).`, 3);
  }

  // 9. Fingerprint reset — the same hardware fingerprint appearing under
  // many different cookie identities. Far stronger than the per-IP
  // cookie-resetting signal: it identifies the *machine* doing it, even
  // when the bot rotates IPs and clears cookies together.
  if (first.fingerprintId) {
    const fpDevices = context.fpDeviceCounts.get(first.fingerprintId) ?? 0;
    if (fpDevices >= FP_RESET_DEVICES) {
      add("fp_reset", "Same device, new cookies", `This exact hardware fingerprint has appeared under ${fpDevices} different cookie identities — one machine clearing cookies to pose as ${fpDevices} separate visitors.`, 4);
    }
  }

  const score = flags.reduce((sum, f) => sum + f.weight, 0);
  return { score, level: levelFor(score), flags };
}

export interface FlaggedSession {
  sessionId: string;
  result: RiskResult;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  /** IP-derived IANA timezone of the visitor — for showing local time. */
  timezone: string | null;
  gclid: string | null;
  referrer: string | null;
  /** Arrived via a paid ad click — gclid or utm_medium=cpc/ppc. */
  paid: boolean;
  deviceId: string;
  at: Date;
}

/**
 * Scans the most recent sessions in the window, scores each, and returns
 * only those flagged medium/high — sorted worst-first — with the display
 * fields the Suspicious tab needs (IP, location, gclid). Scan is capped so
 * cost stays bounded.
 */
export async function getFlaggedSessions(
  context: SessionRiskContext,
  since?: Date,
  limitScan = 500
): Promise<FlaggedSession[]> {
  await connectToDatabase();
  const match = since ? { createdAt: { $gte: since } } : {};

  const candidates = await TrackingEvent.aggregate([
    { $match: match },
    { $group: { _id: "$sessionId", last: { $max: "$createdAt" } } },
    { $sort: { last: -1 } },
    { $limit: limitScan },
  ]);
  const ids = candidates.map((c) => c._id as string);
  if (ids.length === 0) return [];

  const [pageviews, engagements] = await Promise.all([
    TrackingEvent.find({ sessionId: { $in: ids } }).sort({ createdAt: 1 }).lean(),
    EngagementEvent.find({ sessionId: { $in: ids }, type: { $in: ["affiliate_click", "scroll_depth", "coupon_copy", "dwell"] } })
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  const pvBySession = new Map<string, PageviewLike[]>();
  for (const pv of pageviews) {
    const list = pvBySession.get(pv.sessionId) ?? [];
    list.push(pv as PageviewLike);
    pvBySession.set(pv.sessionId, list);
  }
  const enBySession = new Map<string, EngagementLike[]>();
  for (const en of engagements) {
    const list = enBySession.get(en.sessionId) ?? [];
    list.push(en as EngagementLike);
    enBySession.set(en.sessionId, list);
  }

  const flagged: FlaggedSession[] = [];
  for (const id of ids) {
    const pvs = pvBySession.get(id) ?? [];
    if (pvs.length === 0) continue;
    const result = scoreSession(pvs, enBySession.get(id) ?? [], context);
    if (result.level === "low") continue;
    const first = pvs[0] as PageviewLike & { ip?: string | null; country?: string | null; region?: string | null; city?: string | null };
    flagged.push({
      sessionId: id,
      result,
      ip: first.ip ?? null,
      country: first.country ?? null,
      region: first.region ?? null,
      city: first.city ?? null,
      timezone: first.timezone ?? null,
      gclid: first.gclid ?? null,
      referrer: first.referrer ?? null,
      paid: !!first.gclid || first.utm?.medium === "cpc" || first.utm?.medium === "ppc",
      deviceId: first.deviceId,
      at: first.createdAt,
    });
  }

  return flagged.sort((a, b) => b.result.score - a.result.score);
}

/**
 * Batch-scores a set of sessions by id (e.g. the sessions visible in a
 * table). One query for all pageviews, one for all engagement events, then
 * pure scoring — never a per-session round-trip.
 */
export async function scoreSessionsByIds(sessionIds: string[], context: SessionRiskContext): Promise<Map<string, RiskResult>> {
  const result = new Map<string, RiskResult>();
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));
  if (ids.length === 0) return result;

  await connectToDatabase();
  const [pageviews, engagements] = await Promise.all([
    TrackingEvent.find({ sessionId: { $in: ids } }).sort({ createdAt: 1 }).lean(),
    EngagementEvent.find({ sessionId: { $in: ids } }).sort({ createdAt: 1 }).lean(),
  ]);

  const pvBySession = new Map<string, PageviewLike[]>();
  for (const pv of pageviews) {
    const list = pvBySession.get(pv.sessionId) ?? [];
    list.push(pv as PageviewLike);
    pvBySession.set(pv.sessionId, list);
  }
  const enBySession = new Map<string, EngagementLike[]>();
  for (const en of engagements) {
    const list = enBySession.get(en.sessionId) ?? [];
    list.push(en as EngagementLike);
    enBySession.set(en.sessionId, list);
  }

  for (const id of ids) {
    result.set(id, scoreSession(pvBySession.get(id) ?? [], enBySession.get(id) ?? [], context));
  }
  return result;
}
