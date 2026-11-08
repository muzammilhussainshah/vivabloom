"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, SiteSetting } from "@monocoupon/db";
import {
  AI_TASKS,
  IMAGE_MODEL_OPTIONS,
  TEXT_MODEL_OPTIONS,
  codeDefaultModel,
} from "@/lib/ai/prompts";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; success?: boolean } | undefined;

export async function updateAiModels(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  // Build the override map from the form. We only persist a task when the
  // chosen model is a valid option AND differs from the code default — so an
  // untouched dropdown keeps tracking whatever the code default is.
  const aiModels: Record<string, string> = {};

  for (const task of AI_TASKS) {
    const selected = String(formData.get(`model_${task.key}`) ?? "").trim();
    if (!selected) continue;
    const allowed = task.kind === "text" ? TEXT_MODEL_OPTIONS : IMAGE_MODEL_OPTIONS;
    if (!allowed.includes(selected)) continue;
    if (selected === codeDefaultModel(task.key)) continue;
    aiModels[task.key] = selected;
  }

  await connectToDatabase();
  await SiteSetting.findOneAndUpdate({ key: "main" }, { key: "main", aiModels }, { upsert: true });
  await logAudit("settings.aiModels.update", { entityType: "SiteSetting", entityId: "main" });

  revalidatePath("/ai-settings");
  return { success: true };
}
