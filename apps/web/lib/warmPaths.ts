// Our paid audience is overwhelmingly mobile, so warm with a mobile UA. The
// HTML cache does NOT vary by device (Vary: rsc, next-router-*), so this
// doesn't change what gets cached — it just keeps the warm request
// representative and future-proof against any device-conditional logic.
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const CONCURRENCY = 8;

/**
 * Fetches each path so it's rendered and resident in the ISR cache. Doesn't
 * force a re-render by itself (Vercel serves ISR from cache regardless of
 * this request's own cache mode) — the fetch only becomes a real render when
 * the underlying cache entry is actually missing or was just invalidated
 * (e.g. by a prior revalidatePath call), which is why this is always paired
 * with a bust when the goal is "make the new content live", vs. just keeping
 * an already-fresh page warm.
 */
export async function warmPaths(paths: string[], origin: string) {
  let warmed = 0;
  let failed = 0;
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((path) =>
        fetch(`${origin}${path}`, {
          headers: { "user-agent": MOBILE_UA, "x-cache-warm": "1" },
          cache: "no-store",
        })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) warmed++;
      else failed++;
    }
  }
  return { warmed, failed };
}
