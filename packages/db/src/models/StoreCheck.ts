import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const StepStateSchema = new Schema(
  {
    status: { type: String, enum: ["pending", "running", "done", "failed"], default: "pending" },
    error: { type: String, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * One research report per store (keyed by its registrable domain, e.g.
 * "ekster.com"), built by the admin Store Checker in four independent steps
 * — identity, program, reputation, products — so one failing step never
 * loses the others' results (see apps/admin/lib/intelligence/runner.ts).
 *
 * The section payloads are Mixed because their exact shape is owned by
 * apps/admin/lib/intelligence/types.ts. Every researched value inside them
 * carries its own evidence (verbatim quote + source URL) and a
 * verified/unverified/unknown status; `score` is always recomputed in code
 * from those sections, never written by the AI.
 */
const StoreCheckSchema = new Schema(
  {
    domain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: null },
    /** What the admin pasted, tracking parameters included (kept for network detection). */
    inputUrl: { type: String, default: null },
    targetCountry: { type: String, default: null },
    steps: {
      identity: { type: StepStateSchema, default: () => ({}) },
      program: { type: StepStateSchema, default: () => ({}) },
      reputation: { type: StepStateSchema, default: () => ({}) },
      products: { type: StepStateSchema, default: () => ({}) },
    },
    linkSignals: { type: Schema.Types.Mixed, default: null },
    identity: { type: Schema.Types.Mixed, default: null },
    program: { type: Schema.Types.Mixed, default: null },
    policies: { type: Schema.Types.Mixed, default: null },
    reputation: { type: Schema.Types.Mixed, default: null },
    products: { type: Schema.Types.Mixed, default: null },
    score: { type: Schema.Types.Mixed, default: null },
    /** Every page/search result the report relies on: [{ url, title, kind, fetchedAt }]. */
    sources: { type: Schema.Types.Mixed, default: [] },
    usage: {
      tavilyCredits: { type: Number, default: 0 },
      llmInputTokens: { type: Number, default: 0 },
      llmOutputTokens: { type: Number, default: 0 },
    },
    lastCheckedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

StoreCheckSchema.index({ updatedAt: -1 });

export type IStoreCheck = InferSchemaType<typeof StoreCheckSchema>;

export const StoreCheck: Model<IStoreCheck> =
  (models.StoreCheck as Model<IStoreCheck>) ?? model<IStoreCheck>("StoreCheck", StoreCheckSchema);
