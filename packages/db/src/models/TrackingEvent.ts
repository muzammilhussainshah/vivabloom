import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const TrackingEventSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    deviceId: { type: String, required: true },
    isNewDevice: { type: Boolean, default: false },
    path: { type: String, required: true },
    referrer: { type: String, default: null },
    utm: {
      source: { type: String, default: null },
      medium: { type: String, default: null },
      campaign: { type: String, default: null },
      term: { type: String, default: null },
      content: { type: String, default: null },
    },
    // Google Ads click ID — proof the visit came from a paid click; needed
    // when filing invalid-click claims with Google.
    gclid: { type: String, default: null },
    // Browser-reported IANA timezone; compared against the IP's timezone
    // to spot VPN/proxy traffic.
    clientTimezone: { type: String, default: null },
    // "client" = beacon sent by page JS; "server" = logged by the middleware
    // for a paid (gclid) page request, so ad clicks that never run JS still
    // leave a record. Server events are excluded from traffic stats and used
    // only for fraud detection.
    source: { type: String, enum: ["client", "server"], default: "client" },
    // Cookieless device fingerprint (SHA-256 of hardware/browser traits,
    // computed client-side). Survives cookie clearing — many deviceIds
    // collapsing onto one fingerprint means one machine faking new visitors.
    fingerprintId: { type: String, default: null },
    // navigator.webdriver — true in Selenium/Puppeteer/Playwright-driven
    // browsers that don't hide it. Strongest permissionless bot signal.
    webdriver: { type: Boolean, default: null },
    hardwareConcurrency: { type: Number, default: null },
    deviceMemory: { type: Number, default: null },
    maxTouchPoints: { type: Number, default: null },
    devicePixelRatio: { type: Number, default: null },
    viewportWidth: { type: Number, default: null },
    viewportHeight: { type: Number, default: null },
    // Low-entropy client-hint headers (sec-ch-ua*). Chromium browsers always
    // send them; a "Chrome" user-agent without them is forged.
    chUa: { type: String, default: null },
    chUaMobile: { type: String, default: null },
    chUaPlatform: { type: String, default: null },
    // ASN/organization owning the IP (from ipinfo.io when configured) and
    // whether it looks like a datacenter/hosting range rather than a
    // residential ISP.
    ipOrg: { type: String, default: null },
    ipHosting: { type: Boolean, default: null },
    ip: { type: String, default: null },
    ipHash: { type: String, default: null },
    /** The /it, /fr, etc. path prefix this pageview happened on, if any — the market a visit belongs to. Distinct from `country` below (IP-geolocated physical location — a visitor can be in either regardless of which language page they're on). Derived server-side from `path`, see localeCountryFromPath in @monocoupon/validation. */
    localeCountry: { type: String, default: null },
    country: { type: String, default: null },
    region: { type: String, default: null },
    city: { type: String, default: null },
    latitude: { type: String, default: null },
    longitude: { type: String, default: null },
    timezone: { type: String, default: null },
    userAgent: { type: String, default: null },
    language: { type: String, default: null },
    screenWidth: { type: Number, default: null },
    screenHeight: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

TrackingEventSchema.index({ sessionId: 1, createdAt: -1 });
TrackingEventSchema.index({ deviceId: 1, createdAt: -1 });
TrackingEventSchema.index({ createdAt: -1 });
TrackingEventSchema.index({ path: 1, createdAt: -1 });
TrackingEventSchema.index({ localeCountry: 1, createdAt: -1 });
TrackingEventSchema.index({ ip: 1, createdAt: -1 });
TrackingEventSchema.index({ fingerprintId: 1, createdAt: -1 });

export type ITrackingEvent = InferSchemaType<typeof TrackingEventSchema>;

export const TrackingEvent: Model<ITrackingEvent> =
  (models.TrackingEvent as Model<ITrackingEvent>) ??
  model<ITrackingEvent>("TrackingEvent", TrackingEventSchema);
