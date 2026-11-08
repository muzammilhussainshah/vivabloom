import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const KeywordTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    /** Brand phrases (lowercase), longest-first. Retained for reference/back-compat. */
    brandTokens: { type: [String], default: [] },
    /** The base brand word (lowercase, e.g. "tabs") swapped for the target store name. */
    brandName: { type: String, default: "", trim: true, lowercase: true },
    /** The template's own descriptor word (lowercase, e.g. "chocolate") swapped for a store descriptor. */
    brandDescriptor: { type: String, default: "", trim: true, lowercase: true },
    keywords: { type: [String], default: [] },
    negativeKeywords: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type IKeywordTemplate = InferSchemaType<typeof KeywordTemplateSchema>;

export const KeywordTemplate: Model<IKeywordTemplate> =
  (models.KeywordTemplate as Model<IKeywordTemplate>) ??
  model<IKeywordTemplate>("KeywordTemplate", KeywordTemplateSchema);
