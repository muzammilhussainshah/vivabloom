"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, NewsletterSubscriber } from "@monocoupon/db";
import { logAudit } from "@/lib/audit";

export async function unsubscribe(id: string) {
  await connectToDatabase();
  const subscriber = await NewsletterSubscriber.findByIdAndUpdate(id, { status: "unsubscribed" }, { new: true });
  if (subscriber) {
    await logAudit("subscriber.unsubscribe", { entityType: "NewsletterSubscriber", entityId: id });
  }
  revalidatePath("/subscribers");
}

export async function deleteSubscriber(id: string) {
  await connectToDatabase();
  await NewsletterSubscriber.findByIdAndDelete(id);
  await logAudit("subscriber.delete", { entityType: "NewsletterSubscriber", entityId: id });
  revalidatePath("/subscribers");
}
