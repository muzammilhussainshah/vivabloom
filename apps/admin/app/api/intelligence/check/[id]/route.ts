import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, StoreCheck, AuditLog } from "@monocoupon/db";
import { RESEARCH_CATEGORIES, updateStoreCheckSchema } from "@monocoupon/validation";

/** Archive / restore a store report, or change its category. Nothing is ever deleted. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid check id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateStoreCheckSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { archived, category } = parsed.data;
  if (category && !(RESEARCH_CATEGORIES as readonly string[]).includes(category)) return NextResponse.json({ error: "Unknown category" }, { status: 400 });

  const set: Record<string, unknown> = {};
  if (archived !== undefined) Object.assign(set, { archived, archivedAt: archived ? new Date() : null });
  if (category !== undefined) set.category = category || null;

  await connectToDatabase();
  const res = await StoreCheck.updateOne({ _id: id }, { $set: set }, { timestamps: false });
  if (!res.matchedCount) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  await AuditLog.create({
    user: session.user.id,
    action: archived === undefined ? "intelligence.category_set" : archived ? "intelligence.check_archive" : "intelligence.check_restore",
    entityType: "StoreCheck",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
}
