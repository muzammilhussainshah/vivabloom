import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * One doc per (store, country): the current batch of AI-suggested, not-yet-
 * used blog topics for that store, optionally localized to one of
 * BLOG_COUNTRIES (@monocoupon/validation) — `country: null` is the
 * country-agnostic batch. "Regenerate" replaces `topics` wholesale; picking a
 * topic and saving a post pulls that single entry back out (see
 * apps/admin/app/(dashboard)/blog/actions.ts) so the same idea isn't offered
 * twice.
 */
const BlogTopicSuggestionSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    country: { type: String, default: null },
    topics: { type: [String], default: [] },
  },
  { timestamps: true }
);

BlogTopicSuggestionSchema.index({ store: 1, country: 1 }, { unique: true });

export type IBlogTopicSuggestion = InferSchemaType<typeof BlogTopicSuggestionSchema>;

export const BlogTopicSuggestion: Model<IBlogTopicSuggestion> =
  (models.BlogTopicSuggestion as Model<IBlogTopicSuggestion>) ??
  model<IBlogTopicSuggestion>("BlogTopicSuggestion", BlogTopicSuggestionSchema);
