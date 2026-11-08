import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * Marks a fraud-flagged session (see fraudSignals.ts) as reviewed by the
 * admin — e.g. "I looked at this, it's not actually suspicious." Sessions
 * aren't their own documents (they're an aggregation over TrackingEvent +
 * EngagementEvent rows sharing a sessionId), so review state is tracked
 * separately here, keyed by that sessionId. Presence of a row = reviewed;
 * absence = unread.
 */
const SuspiciousReviewSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export type ISuspiciousReview = InferSchemaType<typeof SuspiciousReviewSchema>;

export const SuspiciousReview: Model<ISuspiciousReview> =
  (models.SuspiciousReview as Model<ISuspiciousReview>) ??
  model<ISuspiciousReview>("SuspiciousReview", SuspiciousReviewSchema);
