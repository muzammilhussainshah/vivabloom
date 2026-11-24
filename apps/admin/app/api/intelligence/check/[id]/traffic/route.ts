import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { fetchTraffic } from "@/lib/intelligence/traffic";

/** Fetches (or refreshes) a store's popularity-rank history and saves it on the report. Free — no search credits. */
export const maxDuration = 30;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid check id" }, { status: 400 });

  await connectToDatabase();
  const doc = await StoreCheck.findById(id, "domain identity").lean();
  if (!doc?.identity) return NextResponse.json({ error: "Run the store check first." }, { status: 404 });
  const traffic = await fetchTraffic(doc.domain);
  if (!traffic) return NextResponse.json({ error: "The ranking service is busy — try again in a minute." }, { status: 502 });
  await StoreCheck.updateOne({ _id: doc._id }, { $set: { "identity.traffic": traffic } });
  return NextResponse.json({ ok: true });
}
