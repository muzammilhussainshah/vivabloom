import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { startStoreCheckSchema } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { startStoreCheck, UserFacingError } from "@/lib/intelligence/runner";

/**
 * Starts (or reuses) a Store Check for a pasted link or brand name. Returns
 * the check id; the admin page then runs the four research steps one by one
 * via /api/intelligence/check/[id]/[step].
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`store-check-start:${session.user.email}`, { name: "intelligence-start", requests: 10, window: "60 s" });
  if (!rate.allowed) return NextResponse.json({ error: "Too many checks started. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = startStoreCheckSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  try {
    const result = await startStoreCheck({ ...parsed.data, userId: session.user.id ?? null });
    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: result.reused ? "intelligence.check_reused" : "intelligence.check_start",
      entityType: "StoreCheck",
      entityId: result.id,
      promptSummary: parsed.data.query.slice(0, 200),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("store check start failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start the check." }, { status: 502 });
  }
}
