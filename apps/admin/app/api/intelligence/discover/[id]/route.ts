import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { deleteDiscovery } from "@/lib/intelligence/discover";

/** Removes one saved "Find stores" search from the history (Store Checks themselves are kept). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await deleteDiscovery(id);
  await connectToDatabase();
  await AuditLog.create({ user: session.user.id, action: "intelligence.discover_delete", entityType: "StoreDiscovery", entityId: id });
  return NextResponse.json({ ok: true });
}
