import { connectToDatabase, SiteSetting } from "@monocoupon/db";

/**
 * Reads the admin-set per-task AI model overrides from Site Settings.
 * Uses .lean() so the raw `aiModels` map comes back even if the running
 * server's cached Mongoose schema predates the field. Missing/blank values
 * are dropped so callers can fall back to the code default.
 */
export async function getAiModelOverrides(): Promise<Record<string, string>> {
  await connectToDatabase();
  const doc = await SiteSetting.findOne({ key: "main" }, "aiModels").lean();
  const raw = (doc?.aiModels ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}
