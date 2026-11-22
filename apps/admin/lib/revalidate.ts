/**
 * Tells the public site to drop its ISR cache, right away.
 * Pass `layout: true` when site-wide data changes (e.g. Site Settings) so
 * every page sharing the root layout gets busted, not just specific paths.
 */
export async function revalidateWebPaths(paths: string[], options?: { layout?: boolean }) {
  // Comma-separated so one admin can bust several deployments at once, e.g.
  // "http://localhost:3000,https://valueversion.com" — otherwise a local admin
  // only refreshes the local site and production keeps serving stale ISR pages.
  const webUrls = (process.env.WEB_APP_URL ?? "")
    .split(",")
    .map((u) => u.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const secret = process.env.REVALIDATE_SECRET;

  if (webUrls.length === 0 || !secret) {
    console.warn("WEB_APP_URL or REVALIDATE_SECRET not set — skipping public-site revalidation");
    return;
  }

  await Promise.all(
    webUrls.map(async (webUrl) => {
      try {
        const res = await fetch(`${webUrl}/api/revalidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
          body: JSON.stringify({ paths, revalidateLayout: options?.layout ?? false }),
        });
        if (!res.ok) {
          console.error(`Revalidation request to ${webUrl} failed`, res.status, await res.text());
        }
      } catch (err) {
        console.error(`Failed to reach ${webUrl} for revalidation`, err);
      }
    })
  );
}
