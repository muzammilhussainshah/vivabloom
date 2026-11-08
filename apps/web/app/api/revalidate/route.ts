import { after, NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { expandStorePaths } from "@/lib/storePaths";
import { revalidateAllPPCPaths } from "@/lib/revalidateAll";

// The PPC sitelink variants (/never-pay-full/[slug], …) render the exact same
// store data as the canonical /stores/[slug] page, so any edit that busts a
// store must bust its variants too — otherwise they'd serve stale content for
// the full (now 24h) ISR window. expandStorePaths (shared with the cron
// warmer) handles that fan-out; non-store paths pass through unchanged.

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { paths, revalidateLayout, revalidateAll } = body as {
    paths?: unknown;
    revalidateLayout?: unknown;
    revalidateAll?: unknown;
  };
  if (paths !== undefined && (!Array.isArray(paths) || !paths.every((p) => typeof p === "string"))) {
    return NextResponse.json({ error: "'paths' must be an array of strings" }, { status: 400 });
  }

  // Post-deploy full bust: throws out every ISR page (not just stores) and
  // re-warms the PPC set, so a new build never sits uncalled-for behind an
  // already-warm cache from the previous deployment. See revalidateAllPPCPaths.
  if (revalidateAll === true) {
    const result = await revalidateAllPPCPaths(request.nextUrl.origin);
    return NextResponse.json({ revalidated: true, revalidateAll: true, ...result });
  }

  // Busts every page sharing the root layout — used when site-wide settings
  // (theme tokens, contact info) change, since they're rendered there.
  if (revalidateLayout === true) {
    revalidatePath("/", "layout");
  }

  const allPaths = [...new Set(((paths as string[] | undefined) ?? []).flatMap(expandStorePaths))];
  for (const path of allPaths) {
    revalidatePath(path);
  }

  // revalidatePath only *invalidates* — the next visitor would still pay the
  // multi-second cold on-demand render (worst case ~8s while the DB connection
  // is cold). Re-warm each busted path ourselves, after the response is sent,
  // so the single iad1 origin's ISR cache is repopulated before any real (paid)
  // visitor arrives. Fire-and-forget: warming failures never fail the request.
  const origin = request.nextUrl.origin;
  after(async () => {
    await Promise.allSettled(
      allPaths.map((path) => fetch(`${origin}${path}`, { headers: { "x-cache-warm": "1" } }))
    );
  });

  return NextResponse.json({ revalidated: true, paths: allPaths, revalidateLayout: !!revalidateLayout });
}
