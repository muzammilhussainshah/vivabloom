import Script from "next/script";

export interface AnalyticsConfig {
  ga4Id?: string | null;
  gtmId?: string | null;
  googleAdsConversionId?: string | null;
  clarityId?: string | null;
}

/**
 * Hand-rolled rather than @next/third-parties: GA4 and Google Ads conversion
 * tracking share one gtag.js loader but need two separate `gtag('config', ...)`
 * calls, which the third-parties package's single-gaId API doesn't support.
 *
 * These load on the main thread via next/script's "afterInteractive" strategy
 * — i.e. as soon as hydration is done, typically well under a second.
 *
 * They used to run inside a Partytown web worker to keep GTM off the main
 * thread. That was removed deliberately: Partytown's sandbox was blocked by
 * our own CSP, so it silently fell back to its 10-second timeout and *then*
 * ran the same scripts on the main thread anyway. Measured on the live store
 * page, every GA4/Ads hit carried `tfd≈10900` — nearly 11 seconds from page
 * load to first tag. Every paid visitor who left before that was invisible to
 * GA4 and to Google Ads conversion tracking, which is how PPC landing pages
 * end up looking like 100% bounces. A few hundred ms of main-thread work is
 * an unambiguously better trade than losing the conversion data the bidding
 * algorithm runs on.
 */
export function Analytics({ ga4Id, gtmId, googleAdsConversionId, clarityId }: AnalyticsConfig) {
  // Any of these three IDs is enough to justify loading gtag.js — it can
  // carry a GA4 id, an Ads conversion id, or both as separate config calls.
  const gtagLoaderId = ga4Id || googleAdsConversionId;

  return (
    <>
      {gtagLoaderId && (
        <>
          <Script
            id="gtag-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagLoaderId}`}
            strategy="afterInteractive"
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                ${ga4Id ? `gtag('config', '${ga4Id}');` : ""}
                ${googleAdsConversionId ? `gtag('config', '${googleAdsConversionId}');` : ""}
              `,
            }}
          />
        </>
      )}
      {gtmId && (
        <Script
          id="gtm-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:'';
              j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl; f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `,
          }}
        />
      )}
      {clarityId && (
        // Session replay + heatmaps. Unlike gtag, Clarity records every
        // session locally in the browser and only ships it if the tab stays
        // open long enough to flush — it doesn't need the second beacon race
        // that drops affiliate_click/gtag conversions on early navigation,
        // so it can see iOS sessions that gtag's afterInteractive beacon misses.
        <Script
          id="clarity-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${clarityId}");
            `,
          }}
        />
      )}
    </>
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
