import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, StoreShortlist } from "@monocoupon/db";
import { shortlistSchema } from "@monocoupon/validation";
import { compact } from "@/lib/intelligence/domain";

/** Star / un-star a store, or save the note on a shortlisted one. Free — no credits. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = shortlistSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { name, domain, shortlisted, memo } = parsed.data;
  const nameKey = compact(name);
  if (!nameKey) return NextResponse.json({ error: "Invalid store name" }, { status: 400 });

  await connectToDatabase();
  const match = { $or: [{ nameKey }, ...(domain ? [{ domain }] : [])] };
  if (shortlisted === false) {
    await StoreShortlist.deleteMany(match);
    return NextResponse.json({ ok: true, shortlisted: false });
  }
  const existing = await StoreShortlist.findOne(match);
  if (existing) {
    if (memo !== undefined) existing.memo = memo;
    if (domain && !existing.domain) existing.domain = domain;
    await existing.save();
  } else if (shortlisted === true) {
    await StoreShortlist.create({ nameKey, name, domain: domain ?? null, memo: memo ?? "", addedBy: session.user.id ?? null });
  } else {
    return NextResponse.json({ error: "Store is not on the shortlist" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, shortlisted: true });
}
