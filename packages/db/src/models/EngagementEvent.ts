import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const EngagementEventSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    deviceId: { type: String, required: true },
    path: { type: String, required: true },
    type: {
      type: String,
      enum: ["dwell", "scroll_depth", "affiliate_click", "coupon_copy"],
      required: true,
    },
    // dwell: milliseconds spent on the page. scroll_depth: milestone
    // percentage reached (25/50/75/100). null for click/copy events.
    value: { type: Number, default: null },
    storeSlug: { type: String, default: null },
    couponId: { type: String, default: null },
    couponCode: { type: String, default: null },
    destinationUrl: { type: String, default: null },
    // Whether any human input (pointer move, touch, key press) preceded this
    // event. false on affiliate_click = synthetic/scripted click. null on
    // events recorded before this field existed.
    hadPointer: { type: Boolean, default: null },
    /** The /it, /fr, etc. path prefix this event happened on, if any — the market a click belongs to, not the visitor's IP-geolocated country. Derived server-side from `path`, see localeCountryFromPath in @monocoupon/validation. */
    localeCountry: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

EngagementEventSchema.index({ sessionId: 1, createdAt: -1 });
EngagementEventSchema.index({ type: 1, createdAt: -1 });
EngagementEventSchema.index({ storeSlug: 1, createdAt: -1 });
EngagementEventSchema.index({ localeCountry: 1, createdAt: -1 });
EngagementEventSchema.index({ createdAt: -1 });

export type IEngagementEvent = InferSchemaType<typeof EngagementEventSchema>;

export const EngagementEvent: Model<IEngagementEvent> =
  (models.EngagementEvent as Model<IEngagementEvent>) ??
  model<IEngagementEvent>("EngagementEvent", EngagementEventSchema);
