/**
 * Tells the public site to drop its ISR cache, right away.
 * Pass `layout: true` when site-wide data changes (e.g. Site Settings) so
 * every page sharing the root layout gets busted, not just specific paths.
 */
export async function revalidateWebPaths(paths: string[], options?: { layout?: boolean }) {
  const webUrl = process.env.WEB_APP_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!webUrl || !secret) {
    console.warn("WEB_APP_URL or REVALIDATE_SECRET not set — skipping public-site revalidation");
    return;
  }

  try {
    const res = await fetch(`${webUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ paths, revalidateLayout: options?.layout ?? false }),
    });
    if (!res.ok) {
      console.error("Revalidation request failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("Failed to reach web app for revalidation", err);
  }
}
