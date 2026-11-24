import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enrichPending } from "@/lib/intelligence/discover";

/**
 * Free early signals for found stores (network, commission rate, popularity
 * rank, rules on their affiliate page). No credits, no AI — safe to call
 * repeatedly; each call handles a few stores and reports what's left.
 */
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await enrichPending());
  } catch (err) {
    console.error("discovery enrichment failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Enrichment failed." }, { status: 502 });
  }
}
