import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 'unsafe-inline' on script-src is needed because Next.js's App Router
// streams RSC payloads via inline <script> tags it injects itself — a
// nonce-based CSP would remove this, but adds meaningful middleware
// complexity. challenges.cloudflare.com is allow-listed for the Turnstile
// widget on the login page. img-src is broad because admins paste arbitrary
// external image URLs that render as plain <img> previews.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
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
  transpilePackages: ["@monocoupon/db", "@monocoupon/keywords", "@monocoupon/validation"],
  serverExternalPackages: ["mongoose"],
  // Lets the dev HMR socket work when the site is opened via the LAN address
  // (e.g. http://172.x.x.x:3001) instead of localhost.
  allowedDevOrigins: ["172.27.80.1"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
