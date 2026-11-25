import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { fetchCityDemand } from "@/lib/intelligence/cityDemand";
import type { ProductsResult } from "@/lib/intelligence/types";

/**
 * Loads (or refreshes) monthly Google searches per city for the store's brand,
 * brand + coupon keywords and top products, from the admin's Google Ads
 * Keyword Planner, and saves it on the report. No web-search credits.
 */
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid check id" }, { status: 400 });

  await connectToDatabase();
  const doc = await StoreCheck.findById(id, "domain name identity products targetCountry").lean();
  if (!doc) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  const brand = (doc.identity as { name?: string } | null)?.name || doc.name || doc.domain.split(".")[0]!;
  try {
    const result = await fetchCityDemand({ brand, market: doc.targetCountry ?? "us", products: ((doc.products as ProductsResult | null)?.top ?? []) });
    await StoreCheck.updateOne({ _id: doc._id }, { $set: { cityDemand: result } }, { timestamps: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load city demand." }, { status: 502 });
  }
}
