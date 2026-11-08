import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, EngagementEvent } from "@monocoupon/db";
import { engagementEventSchema, localeCountryFromPath } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";

const OK = () => NextResponse.json({ ok: true });

// Passive engagement beacon (dwell time, scroll depth, affiliate clicks,
// coupon copies) — same contract as /api/track: never surfaces an error,
// a 4xx, or added latency to the visitor.
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

  const parsed = engagementEventSchema.safeParse(body);
  if (!parsed.success) return OK();

  // x-real-ip is set by the platform and can't be forged by the client.
  const rawIp =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  const rate = await checkRateLimit(`engagement:${rawIp ?? "unknown"}`, {
    name: "engagement",
    requests: 120,
    window: "60 s",
  });
  if (!rate.allowed) return OK();

  const deviceId = request.cookies.get("mc_did")?.value ?? null;
  const sessionId = request.cookies.get("mc_sid")?.value ?? null;
  if (!deviceId || !sessionId) return OK();

  try {
    await connectToDatabase();
    await EngagementEvent.create({
      sessionId,
      deviceId,
      path: parsed.data.path,
      type: parsed.data.type,
      value: parsed.data.value ?? null,
      storeSlug: parsed.data.storeSlug ?? null,
      couponId: parsed.data.couponId ?? null,
      couponCode: parsed.data.couponCode ?? null,
      destinationUrl: parsed.data.destinationUrl ?? null,
      hadPointer: parsed.data.hadPointer ?? null,
      localeCountry: localeCountryFromPath(parsed.data.path),
    });
  } catch (err) {
    console.error("EngagementEvent write failed", err);
  }

  return OK();
}
