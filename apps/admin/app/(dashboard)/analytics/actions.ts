"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, SuspiciousReview } from "@monocoupon/db";
import { logAudit } from "@/lib/audit";

export async function markSessionReviewed(sessionId: string) {
  await connectToDatabase();
  await SuspiciousReview.updateOne({ sessionId }, { $setOnInsert: { sessionId } }, { upsert: true });
  await logAudit("suspiciousSession.markReviewed", { entityType: "TrackingEvent", entityId: sessionId });
  revalidatePath("/analytics");
}

export async function markSessionUnreviewed(sessionId: string) {
  await connectToDatabase();
  await SuspiciousReview.deleteOne({ sessionId });
  await logAudit("suspiciousSession.markUnreviewed", { entityType: "TrackingEvent", entityId: sessionId });
  revalidatePath("/analytics");
}
