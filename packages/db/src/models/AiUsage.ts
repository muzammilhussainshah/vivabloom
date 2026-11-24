import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * Per-day usage of one AI model, counted from the responses the app itself
 * receives (providers don't expose a "tokens left today" endpoint). When a
 * provider answers "rate limit reached" we also keep what it told us — the
 * limit, how much was used, and when it frees up — since that is exact.
 */
const AiUsageSchema = new Schema(
  {
    /** UTC day, YYYY-MM-DD. */
    day: { type: String, required: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    requests: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    /** Last "rate limit reached" the provider reported. */
    limitKind: { type: String, default: null },
    dayLimit: { type: Number, default: null },
    limitUsed: { type: Number, default: null },
    blockedUntil: { type: Date, default: null },
    limitSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AiUsageSchema.index({ day: 1, provider: 1, model: 1 }, { unique: true });

export type IAiUsage = InferSchemaType<typeof AiUsageSchema>;

if (models.AiUsage && !models.AiUsage.schema.path("limitKind")) mongoose.deleteModel("AiUsage");

export const AiUsage: Model<IAiUsage> = (models.AiUsage as Model<IAiUsage>) ?? model<IAiUsage>("AiUsage", AiUsageSchema);
