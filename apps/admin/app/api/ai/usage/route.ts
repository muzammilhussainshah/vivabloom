import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsageStatus } from "@/lib/ai/usageStatus";

/** Live "how much AI/search capacity is left" for the sticky limits box. */
export const maxDuration = 20;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getUsageStatus(), { headers: { "Cache-Control": "no-store" } });
}
