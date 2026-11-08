import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, TrackingEvent } from "@monocoupon/db";
import { trackingEventSchema, localeCountryFromPath } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { hashIp } from "@/lib/ipHash";
import { lookupIp } from "@/lib/ipInfo";

const OK = () => NextResponse.json({ ok: true });

// This is a passive analytics beacon — it must never surface an error, a
// 4xx, or added latency to the visitor. Every exit path returns 200
// immediately; failures are swallowed and logged server-side only.
export async function POST(request: NextRequest) {
  // Local dev traffic must not pollute production analytics. Set
  // TRACK_IN_DEV=1 to test the pipeline locally on purpose.
  if (process.env.NODE_ENV !== "production" && process.env.TRACK_IN_DEV !== "1") return OK();

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return OK();
  }

  const parsed = trackingEventSchema.safeParse(body);
  if (!parsed.success) return OK();

  // "server" events are logged by the middleware for paid (gclid) page
  // requests — they carry the visitor's real IP/geo in x-mc-* headers
  // because the internal fetch arrives from the platform's own egress IP.
  const isServerLog = request.headers.get("x-mc-source") === "server";
  if (isServerLog && process.env.TRACK_SERVER_KEY && request.headers.get("x-mc-server-key") !== process.env.TRACK_SERVER_KEY) {
    return OK();
  }

  // x-real-ip is set by the platform and can't be forged by the client;
  // the first x-forwarded-for entry is only a fallback.
  const directIp =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const rawIp = isServerLog ? request.headers.get("x-mc-real-ip") || null : directIp;

  const rate = await checkRateLimit(`track:${rawIp ?? "unknown"}`, {
    name: "track",
    requests: 60,
    window: "60 s",
  });
  if (!rate.allowed) return OK();

  const deviceId = request.cookies.get("mc_did")?.value ?? null;
  const sessionId = request.cookies.get("mc_sid")?.value ?? null;
  if (!deviceId || !sessionId) return OK();

  const geo = (client: string, server: string) =>
    (isServerLog ? request.headers.get(server) : request.headers.get(client)) || null;

  // Optional ASN/datacenter lookup (needs IPINFO_TOKEN); cached per IP,
  // hard 1.5s timeout, never throws.
  const ipInfo = await lookupIp(rawIp);

  try {
    await connectToDatabase();
    await TrackingEvent.create({
      sessionId,
      deviceId,
      isNewDevice: isServerLog
        ? request.headers.get("x-mc-new-device-flag") === "1"
        : request.headers.get("x-mc-new-device") === "1",
      source: isServerLog ? "server" : "client",
      path: parsed.data.path,
      localeCountry: localeCountryFromPath(parsed.data.path),
      referrer: parsed.data.referrer ?? null,
      utm: {
        source: parsed.data.utmSource ?? null,
        medium: parsed.data.utmMedium ?? null,
        campaign: parsed.data.utmCampaign ?? null,
        term: parsed.data.utmTerm ?? null,
        content: parsed.data.utmContent ?? null,
      },
      ip: rawIp,
      ipHash: hashIp(rawIp),
      ipOrg: ipInfo?.org ?? null,
      ipHosting: ipInfo ? ipInfo.hosting : null,
      country: geo("x-vercel-ip-country", "x-mc-geo-country"),
      region: geo("x-vercel-ip-country-region", "x-mc-geo-region"),
      city: geo("x-vercel-ip-city", "x-mc-geo-city"),
      latitude: geo("x-vercel-ip-latitude", "x-mc-geo-latitude"),
      longitude: geo("x-vercel-ip-longitude", "x-mc-geo-longitude"),
      timezone: geo("x-vercel-ip-timezone", "x-mc-geo-timezone"),
      userAgent: request.headers.get("user-agent"),
      language: request.headers.get("accept-language")?.split(",")[0] ?? null,
      screenWidth: parsed.data.screenWidth ?? null,
      screenHeight: parsed.data.screenHeight ?? null,
      gclid: parsed.data.gclid ?? null,
      clientTimezone: parsed.data.clientTimezone ?? null,
      fingerprintId: parsed.data.fingerprintId ?? null,
      webdriver: parsed.data.webdriver ?? null,
      hardwareConcurrency: parsed.data.hardwareConcurrency ?? null,
      deviceMemory: parsed.data.deviceMemory ?? null,
      maxTouchPoints: parsed.data.maxTouchPoints ?? null,
      devicePixelRatio: parsed.data.devicePixelRatio ?? null,
      viewportWidth: parsed.data.viewportWidth ?? null,
      viewportHeight: parsed.data.viewportHeight ?? null,
      // Low-entropy client hints — Chromium always sends these, so a
      // "Chrome" user-agent without them is a forged identity. Only
      // meaningful for client beacons (browsers attach them automatically).
      chUa: isServerLog ? null : request.headers.get("sec-ch-ua"),
      chUaMobile: isServerLog ? null : request.headers.get("sec-ch-ua-mobile"),
      chUaPlatform: isServerLog ? null : request.headers.get("sec-ch-ua-platform"),
    });
  } catch (err) {
    console.error("TrackingEvent write failed", err);
  }

  return OK();
}
