import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { getBlockedCountries } from "@/lib/blockedCountries";
import { getBlockedIps } from "@/lib/blockedIps";

const BLOCKED_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Not available in your region</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; text-align: center; padding: 2rem; margin: 0;">
  <div>
    <h1 style="font-size: 1.25rem;">This site isn't available in your region.</h1>
    <p style="color: #666;">Sorry for the inconvenience.</p>
  </div>
</body>
</html>`;

const DEVICE_ID_COOKIE = "mc_did";
const SESSION_ID_COOKIE = "mc_sid";
const DEVICE_ID_MAX_AGE = 60 * 60 * 24 * 730; // ~2 years
const SESSION_ID_MAX_AGE = 60 * 30; // 30 min sliding window

/**
 * Server-side pageview log for paid clicks. A competitor's bot that never
 * runs JavaScript still costs ad money but would be invisible to the
 * client-beacon pipeline — this logs any document request carrying a gclid
 * straight from the middleware, fire-and-forget, so those sessions exist in
 * the data and can be flagged (source: "server"; deduped against the client
 * beacon during fraud scoring and excluded from traffic stats).
 */
function logPaidRequestServerSide(
  request: NextRequest,
  event: NextFetchEvent,
  deviceId: string,
  sessionId: string,
  isNewDevice: boolean
) {
  const url = request.nextUrl;
  const gclid = url.searchParams.get("gclid");
  if (
    !gclid ||
    request.method !== "GET" ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next") ||
    request.headers.get("rsc") // client-router subrequest, not a page load
  ) {
    return;
  }

  const geo = (name: string) => request.headers.get(name) ?? "";
  event.waitUntil(
    fetch(`${url.origin}/api/track`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${DEVICE_ID_COOKIE}=${deviceId}; ${SESSION_ID_COOKIE}=${sessionId}`,
        "x-mc-source": "server",
        ...(process.env.TRACK_SERVER_KEY ? { "x-mc-server-key": process.env.TRACK_SERVER_KEY } : {}),
        ...(isNewDevice ? { "x-mc-new-device-flag": "1" } : {}),
        // The visitor's real IP/geo — the internal fetch itself arrives from
        // the platform's egress IP, so these must be carried explicitly.
        "x-mc-real-ip":
          request.headers.get("x-real-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "",
        "x-mc-geo-country": geo("x-vercel-ip-country"),
        "x-mc-geo-region": geo("x-vercel-ip-country-region"),
        "x-mc-geo-city": geo("x-vercel-ip-city"),
        "x-mc-geo-latitude": geo("x-vercel-ip-latitude"),
        "x-mc-geo-longitude": geo("x-vercel-ip-longitude"),
        "x-mc-geo-timezone": geo("x-vercel-ip-timezone"),
        "user-agent": request.headers.get("user-agent") ?? "",
        "accept-language": request.headers.get("accept-language") ?? "",
      },
      body: JSON.stringify({
        path: url.pathname,
        gclid,
        referrer: request.headers.get("referer") || null,
        utmSource: url.searchParams.get("utm_source"),
        utmMedium: url.searchParams.get("utm_medium"),
        utmCampaign: url.searchParams.get("utm_campaign"),
        utmTerm: url.searchParams.get("utm_term"),
        utmContent: url.searchParams.get("utm_content"),
      }),
    }).catch(() => {})
  );
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const country = request.headers.get("x-vercel-ip-country");
  if (country) {
    const blocked = await getBlockedCountries();
    if (blocked.has(country)) {
      return new NextResponse(BLOCKED_PAGE, {
        status: 451,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }

  // Manual, admin-curated IP blocklist (Settings → Blocked IPs) — never
  // automatic. Same real-IP extraction as app/api/track/route.ts.
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) {
    const blockedIps = await getBlockedIps();
    if (blockedIps.has(ip)) {
      return new NextResponse(BLOCKED_PAGE, {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }

  // Silently mint first-party device/session identifiers used for passive
  // visitor analytics (see app/api/track/route.ts) — no visible prompt,
  // no client JS required before these exist on the very first request.
  const requestHeaders = new Headers(request.headers);
  // Internal-only markers — never trust a client-supplied value.
  requestHeaders.delete("x-mc-new-device");

  const isNewDevice = !request.cookies.get(DEVICE_ID_COOKIE);
  const deviceId = request.cookies.get(DEVICE_ID_COOKIE)?.value ?? crypto.randomUUID();
  const sessionId = request.cookies.get(SESSION_ID_COOKIE)?.value ?? crypto.randomUUID();
  if (isNewDevice) requestHeaders.set("x-mc-new-device", "1");

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (isNewDevice) {
    response.cookies.set(DEVICE_ID_COOKIE, deviceId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: DEVICE_ID_MAX_AGE,
      path: "/",
    });
  }

  // Sliding window: refreshed on every request, so it expires only after
  // 30 minutes of inactivity rather than 30 minutes after the visit started.
  response.cookies.set(SESSION_ID_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_ID_MAX_AGE,
    path: "/",
  });

  logPaidRequestServerSide(request, event, deviceId, sessionId, isNewDevice);

  return response;
}

export const config = {
  // Excludes static assets and the two server-to-server revalidation routes
  // (admin-triggered edits, and Vercel's own post-deploy webhook) — both must
  // never be blocked regardless of which region they're routed through, and
  // neither needs the visitor device/session cookies this middleware mints.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|api/revalidate|api/webhooks/).*)"],
};
