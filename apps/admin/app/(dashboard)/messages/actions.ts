"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, ContactMessage } from "@monocoupon/db";
import { logAudit } from "@/lib/audit";

export async function markAsRead(id: string) {
  await connectToDatabase();
  const message = await ContactMessage.findByIdAndUpdate(id, { status: "read" }, { new: true });
  if (message) {
    await logAudit("contactMessage.markRead", { entityType: "ContactMessage", entityId: id });
  }
  revalidatePath("/messages");
}

export async function deleteMessage(id: string) {
  await connectToDatabase();
  await ContactMessage.findByIdAndDelete(id);
  await logAudit("contactMessage.delete", { entityType: "ContactMessage", entityId: id });
  revalidatePath("/messages");
}
