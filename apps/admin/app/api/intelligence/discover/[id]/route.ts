import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { deleteDiscovery, filterSavedDiscovery } from "@/lib/intelligence/discover";

export const maxDuration = 60;

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

/** Filters a search saved before program filtering to stores with an affiliate program (free: no web-search credits). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await filterSavedDiscovery(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("filter saved discovery failed", err);
    return NextResponse.json({ error: "Filtering failed" }, { status: 502 });
  }
}
