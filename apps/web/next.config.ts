import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 'unsafe-inline' on script-src is needed because Next.js's App Router
// streams RSC payloads via inline <script> tags it injects itself — a
// nonce-based CSP would remove this, but adds meaningful middleware
// complexity. img-src is broad because admins can paste arbitrary external
// image URLs (store logos, coupon/blog images) that render as plain <img>.
// Google domains are allow-listed for GA4/GTM/Ads conversion tracking,
// which only actually load when an admin configures those integrations.
// challenges.cloudflare.com is for the Turnstile widget on the contact form.
// Google's tag endpoints, kept in one place because gtag.js fans out across
// several hosts and a single missing one silently drops conversions rather
// than erroring. Wildcards are deliberate:
//   *.google-analytics.com — GA4 routes non-US traffic through regional hosts
//     (region1.google-analytics.com for EU/UK). Listing only the bare
//     www.google-analytics.com host silently dropped every UK GA4 hit.
//   *.g.doubleclick.net    — googleads.* (conversions) and stats.* (remarketing).
// www.google.<tld> receives the Ads /ccm/collect consent-mode + conversion
// pings and the /pagead/1p-user-list remarketing pixel. gtag sends these to
// google.com *and* to the visitor's own country domain (a UK visitor also
// gets www.google.co.uk, a German one www.google.de). Our PPC audience is
// US + UK, so those two are listed. If campaigns expand to another country,
// add that country's domain here or its remarketing audiences will silently
// stop populating — conversions still land on google.com, so the symptom is
// shrinking audience lists rather than missing conversion counts.
const GOOGLE_TAG_HOSTS = {
  script: ["https://www.googletagmanager.com", "https://www.googleadservices.com", "https://googleads.g.doubleclick.net"],
  connect: [
    // Both the bare host and the wildcard: a CSP `*.` pattern matches
    // subdomains only, never the apex, so listing just the wildcard would
    // silently drop analytics.google.com.
    "https://*.google-analytics.com",
    "https://analytics.google.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://*.g.doubleclick.net",
    "https://td.doubleclick.net",
    "https://www.googleadservices.com",
    "https://www.google.com",
    "https://www.google.co.uk",
  ],
  frame: ["https://www.googletagmanager.com", "https://td.doubleclick.net", "https://*.g.doubleclick.net"],
};

// Microsoft Clarity: the tag loads from the bare host, but the collector it
// posts session/heatmap data to is a numbered subdomain assigned per session
// (e.g. c.clarity.ms) that isn't documented as stable, hence the wildcard.
const CLARITY_HOSTS = {
  script: ["https://www.clarity.ms"],
  connect: ["https://www.clarity.ms", "https://*.clarity.ms"],
};

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${GOOGLE_TAG_HOSTS.script.join(" ")} ${CLARITY_HOSTS.script.join(" ")} https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self' data:",
  `connect-src 'self' ${GOOGLE_TAG_HOSTS.connect.join(" ")} ${CLARITY_HOSTS.connect.join(" ")} https://challenges.cloudflare.com`,
  `frame-src ${GOOGLE_TAG_HOSTS.frame.join(" ")} https://challenges.cloudflare.com`,
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@monocoupon/db", "@monocoupon/validation"],
  serverExternalPackages: ["mongoose"],
  images: {
    // Serve modern, smaller formats; the browser picks the best it supports.
    formats: ["image/avif", "image/webp"],
    // Cache each optimized variant for 31 days so repeat views are instant.
    minimumCacheTTL: 2_678_400,
    // Admins paste image URLs from arbitrary hosts (store logos, AI/blog
    // covers), so any https source is allowed through the optimizer. Tighten
    // this to specific hostnames if you ever lock down where images come from.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // Store logos are often SVGs. Allow them through the optimizer, but serve
    // them locked down (no scripts, sandboxed, download-disposition) since SVG
    // can embed active content.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Lets the dev HMR socket work when the site is opened via the LAN address
  // (e.g. http://172.x.x.x:3000) instead of localhost.
  allowedDevOrigins: ["172.27.80.1"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
