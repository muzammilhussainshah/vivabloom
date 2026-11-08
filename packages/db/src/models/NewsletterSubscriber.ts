import mongoose, { type InferSchemaType, type Model } from "mongoose";
import crypto from "node:crypto";
const { Schema, model, models } = mongoose;

const NewsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "confirmed", "unsubscribed"], default: "pending" },
    source: { type: String, default: null },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribeToken: { type: String, default: () => crypto.randomUUID() },
  },
  { timestamps: true }
);

export type INewsletterSubscriber = InferSchemaType<typeof NewsletterSubscriberSchema>;

export const NewsletterSubscriber: Model<INewsletterSubscriber> =
  (models.NewsletterSubscriber as Model<INewsletterSubscriber>) ??
  model<INewsletterSubscriber>("NewsletterSubscriber", NewsletterSubscriberSchema);
