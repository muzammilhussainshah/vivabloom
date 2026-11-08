import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const SiteSettingSchema = new Schema(
  {
    /** Always "main" — enforces a single settings document. */
    key: { type: String, required: true, unique: true, default: "main" },
    siteName: { type: String, default: "VivaBloom" },
    logoUrl: { type: String, default: null },
    /** Doubles as the homepage hero heading ("Read. Learn. Grow."). "\n" = line break. */
    tagline: { type: String, default: "" },
    /** Small uppercase line above the hero heading. */
    heroOverline: { type: String, default: "" },
    /** Paragraph under the hero heading. "\n" = line break. */
    heroDescription: { type: String, default: "" },
    heroImage: { type: String, default: null },
    /** Also drives the /stores/[slug] redesign's palette — see apps/web/lib/storeTheme.ts, which derives that page's extra color roles (a success/verified tint, a card background) from these same 9 fields rather than storing them separately. */
    themeTokens: {
      brandPrimary: { type: String, default: "#7c6cf0" },
      brandSecondary: { type: String, default: "#5b4bd5" },
      brandAccent: { type: String, default: "#c2379b" },
      surface: { type: String, default: "#f7f8ff" },
      surfaceMuted: { type: String, default: "#ffffff" },
      text: { type: String, default: "#1e2440" },
      textMuted: { type: String, default: "#6b7391" },
      border: { type: String, default: "#e4e8f5" },
      footerBg: { type: String, default: "#1f1b3d" },
      radiusBase: { type: String, default: "0.5rem" },
    },
    contact: {
      email: { type: String, default: null },
      phone: { type: String, default: "+447728915929" },
      address: { type: String, default: "Office 1877, 85 Dunstall Hill, Wolverhampton, United Kingdom, WV6 0SR" },
    },
    socialLinks: {
      facebook: { type: String, default: null },
      instagram: { type: String, default: null },
      youtube: { type: String, default: null },
      tiktok: { type: String, default: null },
      discord: { type: String, default: null },
    },
    footer: {
      quickLinks: [{ label: String, href: String }],
      legalLinks: [{ label: String, href: String }],
    },
    integrations: {
      ga4Id: { type: String, default: null },
      gtmId: { type: String, default: null },
      googleAdsConversionId: { type: String, default: null },
      googleAdsConversionLabel: { type: String, default: null },
      clarityId: { type: String, default: null },
    },
    /**
     * Per-task AI model overrides, keyed by task (e.g. { blogDraft: "gpt-4o" }).
     * A task absent here uses the code default from apps/admin/lib/ai/prompts.ts.
     */
    aiModels: { type: Schema.Types.Mixed, default: {} },
    /**
     * ISO 3166-1 alpha-2 codes visitors are blocked from. This is the durable
     * record; apps/web/proxy.ts can't read Mongo directly (Edge runtime), so
     * it's mirrored to Redis on save — see apps/admin/lib/blockedCountries.ts.
     */
    blockedCountries: { type: [String], default: [] },
    /**
     * IP addresses visitors are blocked from — admin-curated (e.g. pasted
     * from the Suspicious activity tab), not automatic. Same Redis mirroring
     * as blockedCountries; see apps/admin/lib/blockedIps.ts.
     */
    blockedIps: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type ISiteSetting = InferSchemaType<typeof SiteSettingSchema>;

export const SiteSetting: Model<ISiteSetting> =
  (models.SiteSetting as Model<ISiteSetting>) ?? model<ISiteSetting>("SiteSetting", SiteSettingSchema);

/** Fetches the singleton settings document, creating it with defaults if missing. */
export async function getSiteSettings() {
  const existing = await SiteSetting.findOne({ key: "main" });
  if (existing) return existing;
  return SiteSetting.create({ key: "main" });
}
