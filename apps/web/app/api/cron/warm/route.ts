import { NextRequest, NextResponse } from "next/server";
import { getAllStoreSlugs } from "@/lib/data";
import { storePathsForSlug } from "@/lib/storePaths";
import { warmPaths } from "@/lib/warmPaths";

// Triggered hourly by GitHub Actions (.github/workflows/warm-cache.yml), with
// a once-daily Vercel Cron fallback (vercel.json) — the Vercel Hobby plan caps
// Vercel Cron at daily, so the GitHub schedule is what actually keeps the
// cadence tight. It re-fetches every PPC landing page so they stay resident in
// the single iad1 origin's ISR cache, meaning a real paid click never pays the
// multi-second cold on-demand render.
// Warming the origin covers ALL regions at once (one compute region); each
// geographic edge PoP still fills on its first real local visit, but that's a
// sub-second hop to the warm origin, not a cold render.
//
// Store list is read live from the DB, so stores added later are picked up
// automatically with no code change.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` when the
  // CRON_SECRET env var is set. Reject anything else so the endpoint can't be
  // hit by outsiders to run up compute.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slugs = await getAllStoreSlugs();
  const paths = slugs.flatMap(storePathsForSlug);
  const { warmed, failed } = await warmPaths(paths, request.nextUrl.origin);

  return NextResponse.json({
    stores: slugs.length,
    paths: paths.length,
    warmed,
    failed,
    at: new Date().toISOString(),
  });
}
