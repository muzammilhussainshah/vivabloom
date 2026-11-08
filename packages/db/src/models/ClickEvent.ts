import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const ClickEventSchema = new Schema(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    type: { type: String, enum: ["view", "click"], required: true },
    ipHash: { type: String, default: null },
    country: { type: String, default: null },
    userAgent: { type: String, default: null },
    referrer: { type: String, default: null },
    utm: {
      source: { type: String, default: null },
      medium: { type: String, default: null },
      campaign: { type: String, default: null },
      term: { type: String, default: null },
      content: { type: String, default: null },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ClickEventSchema.index({ coupon: 1, createdAt: -1 });
ClickEventSchema.index({ product: 1, createdAt: -1 });
ClickEventSchema.index({ store: 1, createdAt: -1 });

export type IClickEvent = InferSchemaType<typeof ClickEventSchema>;

export const ClickEvent: Model<IClickEvent> =
  (models.ClickEvent as Model<IClickEvent>) ?? model<IClickEvent>("ClickEvent", ClickEventSchema);
