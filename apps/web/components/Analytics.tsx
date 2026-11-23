import Script from "next/script";

export interface AnalyticsConfig {
  ga4Id?: string | null;
  gtmId?: string | null;
  googleAdsConversionId?: string | null;
  clarityId?: string | null;
}

/**
 * How long a visitor who never interacts waits before the tags load anyway.
 * Any interaction (tap, click, key, scroll, mouse move) loads them at once.
 */
const TAG_LOAD_FALLBACK_MS = 5000;

/**
 * Hand-rolled rather than @next/third-parties: GA4 and Google Ads conversion
 * tracking share one gtag.js loader but need two separate `gtag('config', ...)`
 * calls, which the third-parties package's single-gaId API doesn't support.
 *
 * Loading strategy — deferred until the visitor first interacts, with a
 * TAG_LOAD_FALLBACK_MS fallback:
 *  - The `dataLayer` / `gtag()` / `clarity()` queues and the `config` calls
 *    are set up immediately after hydration, so nothing that fires early
 *    (e.g. trackCouponClick) is lost — it waits in the queue and is sent the
 *    moment the real script arrives.
 *  - The scripts themselves (gtag.js is ~155KB and ~150ms+ of main-thread
 *    work on a mid-range phone) load on the first interaction or after the
 *    fallback delay. That takes them out of the page's critical load, which
 *    cost the paid landing pages ~4-6 Lighthouse points on its own.
 *  - A coupon/deal click is itself an interaction (pointerdown fires before
 *    click), and it opens the merchant in a new tab, so this page stays alive
 *    and the queued conversion still goes out.
 *  - Trade-off, accepted deliberately: a visitor who leaves without any
 *    interaction within the fallback window is not recorded by GA4/Ads/Clarity.
 *
 * History: this used to run inside a Partytown web worker. That was removed
 * because Partytown's sandbox was blocked by our own CSP, so it silently fell
 * back to its 10-second timeout and *then* ran the scripts on the main thread
 * anyway — every GA4/Ads hit carried `tfd≈10900`. The fallback here is half
 * that, and real visitors interact (scroll) well before it.
 */
export function Analytics({ ga4Id, gtmId, googleAdsConversionId, clarityId }: AnalyticsConfig) {
  // Any of these IDs is enough to justify loading gtag.js — it can carry a
  // GA4 id, an Ads conversion id, or both as separate config calls.
  const gtagLoaderId = ga4Id || googleAdsConversionId;
  if (!gtagLoaderId && !gtmId && !clarityId) return null;

  const js = (value: string) => JSON.stringify(value);

  // Queues + config: cheap, run right away.
  const setup = [
    "window.dataLayer = window.dataLayer || [];",
    gtagLoaderId &&
      [
        "function gtag(){dataLayer.push(arguments);}",
        "window.gtag = gtag;",
        "gtag('js', new Date());",
        ga4Id && `gtag('config', ${js(ga4Id)});`,
        googleAdsConversionId && `gtag('config', ${js(googleAdsConversionId)});`,
      ]
        .filter(Boolean)
        .join("\n"),
    gtmId && "dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});",
    // Session replay + heatmaps queue (Clarity's own snippet, minus the script tag).
    clarityId && "window.clarity = window.clarity || function(){(window.clarity.q = window.clarity.q || []).push(arguments)};",
  ]
    .filter(Boolean)
    .join("\n");

  // The heavy scripts, loaded on first interaction or after the fallback.
  const sources = [
    gtagLoaderId && `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagLoaderId)}`,
    gtmId && `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`,
    clarityId && `https://www.clarity.ms/tag/${encodeURIComponent(clarityId)}`,
  ].filter((s): s is string => Boolean(s));

  return (
    <Script
      id="analytics-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
${setup}
(function(w, d, srcs){
  var loaded = false;
  var events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
  function load(){
    if (loaded) return;
    loaded = true;
    events.forEach(function(e){ w.removeEventListener(e, load, { passive: true }); });
    srcs.forEach(function(src){
      var s = d.createElement('script');
      s.async = true;
      s.src = src;
      d.head.appendChild(s);
    });
  }
  events.forEach(function(e){ w.addEventListener(e, load, { passive: true }); });
  setTimeout(load, ${TAG_LOAD_FALLBACK_MS});
})(window, document, ${JSON.stringify(sources)});
`,
      }}
    />
  );
}

/** GTM requires this right after the opening <body> tag as a noscript fallback. */
export function GtmNoScript({ gtmId }: { gtmId?: string | null }) {
  if (!gtmId) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
