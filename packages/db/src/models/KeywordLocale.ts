import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * One language's campaign vocabulary. Source of truth lives in
 * `keyword-research/locales/*.json` and is pushed here by
 * `pnpm db:import-locales`, mirroring how keyword templates are managed.
 *
 * Order inside every array is rank — it decides which terms survive when a
 * campaign hits its keyword ceiling, so it is meaningful data, not cosmetic.
 */
const KeywordLocaleSchema = new Schema(
  {
    /** Language code, e.g. "de". */
    code: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    /** Human label, e.g. "German". */
    language: { type: String, required: true, trim: true },
    /** ISO 3166-1 alpha-2 countries where this language is worth targeting. */
    countries: { type: [String], default: [] },

    intentTerms: { type: [String], default: [] },
    offerModifiers: { type: [String], default: [] },
    qualifierModifiers: { type: [String], default: [] },
    urgencyModifiers: { type: [String], default: [] },
    amountModifiers: { type: [String], default: [] },
    seasonalModifiers: { type: [String], default: [] },
    verticals: { type: [String], default: [] },
    geoModifiers: { type: [String], default: [] },
    fillerModifiers: { type: [String], default: [] },
    paymentModifiers: { type: [String], default: [] },
    informationalModifiers: { type: [String], default: [] },
    connectors: { type: [String], default: [] },

    /** English month name → local spellings, so one campaign month resolves everywhere. */
    months: { type: Schema.Types.Mixed, default: {} },
    /** Word-order templates using {brand} / {descriptor} / {intent} / {modifier}. */
    patterns: { type: [String], default: [] },
    /** This language's negatives. Never ranked, never capped. */
    negativeKeywords: { type: [String], default: [] },

    /** Also emit accent-stripped twins ("código" → "codigo"). */
    stripAccents: { type: Boolean, default: false },
    /** Also emit split/joined compound forms ("Gutscheincode" ↔ "Gutschein Code"). */
    compoundForms: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type IKeywordLocale = InferSchemaType<typeof KeywordLocaleSchema>;

export const KeywordLocale: Model<IKeywordLocale> =
  (models.KeywordLocale as Model<IKeywordLocale>) ??
  model<IKeywordLocale>("KeywordLocale", KeywordLocaleSchema);
