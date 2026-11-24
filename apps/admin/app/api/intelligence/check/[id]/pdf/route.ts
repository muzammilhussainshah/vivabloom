import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { logAudit } from "@/lib/audit";
import { toView } from "@/lib/intelligence/runner";
import { getPersonalRecord } from "@/lib/intelligence/personal";
import { generateStoreReportPdf } from "@/lib/intelligence/reportPdf";

/** Downloads a Store Check report as a PDF (built from the saved report — no research or credits). */
export const maxDuration = 30;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid check id" }, { status: 400 });

  await connectToDatabase();
  const doc = await StoreCheck.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Store check not found" }, { status: 404 });
  const check = toView(doc as unknown as Record<string, unknown>);
  const personal = await getPersonalRecord(check.domain).catch(() => null);

  const pdf = await generateStoreReportPdf(check, personal);
  await logAudit("intelligence.report_pdf", { entityType: "StoreCheck", entityId: id });

  const slug = check.domain.replace(/[^a-z0-9.-]/gi, "-");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="store-check-${slug}-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
