import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const FaqSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * The single verified offer shown on the store-page redesign
 * (/stores/[slug]). Every field is optional/admin-authored — the web app
 * derives sensible defaults from the store's existing Coupon data wherever a
 * field is unset (see apps/web/lib/offerContent.ts), so a store with no
 * `offer` fields filled in still renders a complete page. `notOffered` falls
 * back to generic copy until overridden here; `proofScreenshots` is the one
 * exception with no fallback at all (real screenshots can't be fabricated),
 * so that section is simply omitted until an admin fills it in.
 */
const StoreOfferSchema = new Schema(
  {
    mechanic: { type: String, enum: ["link", "code", "popup"], default: null },
    code: { type: String, default: null },
    /** Overrides the affiliate URL used for this store's CTA — falls back to the top Coupon's affiliateUrl/merchantUrl, then Store.websiteUrl. */
    affiliateUrl: { type: String, default: null },
    /** e.g. "$80" or "20%" — the big number on the voucher. */
    discountLabel: { type: String, default: null },
    /** e.g. "off ENGWE". */
    discountSuffix: { type: String, default: null },
    /** e.g. "Site-wide, on top of prices already reduced." */
    offerSubline: { type: String, default: null },
    /** Hero paragraph, e.g. "One voucher, because ENGWE runs one discount...". */
    lede: { type: String, default: null },
    verifiedDate: { type: Date, default: null },
    nextCheckDate: { type: Date, default: null },
    verifierName: { type: String, default: null },
    /** Plain sentence, e.g. "Used 14x this week" — never a fabricated stats block. Hidden entirely if unset. */
    usageCount: { type: String, default: null },
    /** Up to 4 short trust-row strings, e.g. "No signup needed". */
    trustChecks: { type: [String], default: [] },
    /** Up to 4 "what this store does NOT offer" lines — the mechanism that makes a single offer believable. Must be authored per store. */
    notOffered: { type: [String], default: [] },
    /** Up to 3 image URLs: landing -> waiting -> the discount line at checkout. */
    proofScreenshots: { type: [String], default: [] },
  },
  { _id: false }
);

/**
 * A country-specific override of the offer above, plus faqs/meta. Every
 * field is optional — apps/web falls back to the base `offer`/`faqs`
 * field-by-field for anything left unset here, so a country entry can be as
 * small as just a different `code`/`affiliateUrl`, or a full parallel offer.
 * `proofScreenshots` is deliberately not overridable per country (real
 * screenshots aren't expected to differ by market).
 */
const StoreLocaleOfferSchema = new Schema(
  {
    /** Lowercase country code from SUPPORTED_COUNTRIES in @monocoupon/validation, e.g. "it". */
    country: { type: String, required: true, lowercase: true, trim: true },
    mechanic: { type: String, enum: ["link", "code", "popup"], default: null },
    code: { type: String, default: null },
    affiliateUrl: { type: String, default: null },
    discountLabel: { type: String, default: null },
    discountSuffix: { type: String, default: null },
    offerSubline: { type: String, default: null },
    lede: { type: String, default: null },
    verifiedDate: { type: Date, default: null },
    nextCheckDate: { type: Date, default: null },
    verifierName: { type: String, default: null },
    usageCount: { type: String, default: null },
    trustChecks: { type: [String], default: [] },
    notOffered: { type: [String], default: [] },
    faqs: [FaqSchema],
    metaTitle: { type: String, default: null },
    metaDescription: { type: String, default: null },
  },
  { _id: false }
);

const StoreSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Slugs this store used to have, before a rename. Checked as a fallback
    // when a slug lookup misses, so old /stores/{slug} links redirect to the
    // current URL instead of 404ing.
    previousSlugs: [{ type: String, lowercase: true, trim: true }],
    logo: { type: String, default: null },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    websiteUrl: { type: String, required: true },
    stats: {
      totalCoupons: { type: Number, default: 0 },
      activeDeals: { type: Number, default: 0 },
      totalProducts: { type: Number, default: 0 },
      totalBundles: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
      joinedDate: { type: Date, default: Date.now },
    },
    faqs: [FaqSchema],
    offer: { type: StoreOfferSchema, default: () => ({}) },
    /** One entry per country this store has localized content for; see StoreLocaleOfferSchema. */
    i18n: {
      type: [StoreLocaleOfferSchema],
      default: [],
      validate: {
        validator: (entries: { country: string }[]) =>
          new Set(entries.map((e) => e.country)).size === entries.length,
        message: "Each country can only have one i18n entry per store.",
      },
    },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    /** Admin-controlled manual ordering (lower = earlier) — applied after isFeatured, before the alphabetical fallback, everywhere stores are listed (the /stores page, a category's store list, and the /products catalog groups). */
    sortOrder: { type: Number, default: 0 },
    seoTitle: { type: String, default: null },
    seoDescription: { type: String, default: null },
  },
  { timestamps: true }
);

StoreSchema.index({ categories: 1 });
StoreSchema.index({ previousSlugs: 1 });
StoreSchema.index({ name: "text", description: "text" });

export type IStore = InferSchemaType<typeof StoreSchema>;

export const Store: Model<IStore> =
  (models.Store as Model<IStore>) ?? model<IStore>("Store", StoreSchema);

/** The 8 recurring FAQ questions used to seed every new store. */
export const DEFAULT_STORE_FAQS = [
  { question: "How do I use a {{store}} coupon code?", answer: "Copy the code, visit {{store}}, add items to your cart, and paste the code at checkout before paying.", sortOrder: 0 },
  { question: "Why is my {{store}} coupon code not working?", answer: "Codes can expire, be limited to certain items, or require a minimum order value. Check the coupon's terms or try another active offer.", sortOrder: 1 },
  { question: "Does {{store}} offer free shipping?", answer: "Some {{store}} offers include free shipping. Look for deals tagged accordingly on this page.", sortOrder: 2 },
  { question: "Can I stack multiple {{store}} coupons?", answer: "Most stores allow only one coupon code per order unless stated otherwise in the offer's terms.", sortOrder: 3 },
  { question: "How often are {{store}} coupons updated?", answer: "We check {{store}} regularly and update this page whenever new codes or deals are found.", sortOrder: 4 },
  { question: "Are {{store}} coupons verified?", answer: "Coupons marked as verified were confirmed working by our team on the date shown.", sortOrder: 5 },
  { question: "Do I need an account to use a {{store}} coupon?", answer: "This depends on {{store}}'s own checkout process — most retailers allow guest checkout with a coupon applied.", sortOrder: 6 },
  { question: "What if a {{store}} discount isn't applying at checkout?", answer: "Double-check the code was entered exactly as shown and that your cart meets the offer's conditions.", sortOrder: 7 },
];
