/**
 * Fire-and-forget POST — uses sendBeacon (works even mid-navigation/unload)
 * and falls back to a keepalive fetch when unavailable. Never throws, never
 * blocks the caller.
 *
 * The try/catch is load-bearing, not defensive padding: WebKit can *throw*
 * from sendBeacon rather than returning false. Uncaught, that would take out
 * whatever called us — the rest of a click handler (so the merchant tab never
 * opens), or the pageview beacon's promise chain. Any throw has to degrade to
 * the fetch fallback instead. Note that Safari only gained
 * `fetch(keepalive: true)` in iOS 16.4, so on older iOS both paths can fail;
 * that's why dwell is flushed on visibilitychange (while the page is still
 * alive) rather than relying on an unload-time beacon.
 */
export function sendBeacon(path: string, payload: object) {
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon?.(path, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to the fetch fallback below.
  }

  try {
    fetch(path, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  } catch {
    // Nothing left to try — analytics must never surface to the visitor.
  }
}
