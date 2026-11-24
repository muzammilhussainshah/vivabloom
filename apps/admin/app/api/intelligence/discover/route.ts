import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { discoverStoresSchema } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { discoverStores } from "@/lib/intelligence/discover";

/** "Find stores": brands with affiliate programs for a market + category (cached for a week). */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`store-discover:${session.user.email}`, { name: "intelligence-discover", requests: 6, window: "60 s" });
  if (!rate.allowed) return NextResponse.json({ error: "Too many searches. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = discoverStoresSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  try {
    const result = await discoverStores(parsed.data);
    if (!result.cached) {
      await connectToDatabase();
      await AuditLog.create({
        user: session.user.id,
        action: parsed.data.more ? "intelligence.discover_more" : "intelligence.discover",
        promptSummary: `${parsed.data.country} · ${parsed.data.category}${parsed.data.keyword ? ` · ${parsed.data.keyword}` : ""}`,
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("store discovery failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed." }, { status: 502 });
  }
}
