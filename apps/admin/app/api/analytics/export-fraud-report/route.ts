import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, getSiteSettings } from "@monocoupon/db";
import { auth } from "@/auth";
import { getFraudReportData } from "@/lib/exportFraudReport";
import { generateFraudReportPdf } from "@/lib/generateFraudReportPdf";
import { logAudit } from "@/lib/audit";

const MAX_SESSIONS = 50;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionIds = Array.from(new Set(request.nextUrl.searchParams.getAll("sessionId").filter(Boolean)));
  if (sessionIds.length === 0) {
    return NextResponse.json({ error: "Select at least one session to export." }, { status: 400 });
  }
  if (sessionIds.length > MAX_SESSIONS) {
    return NextResponse.json({ error: `Select ${MAX_SESSIONS} sessions or fewer per export.` }, { status: 400 });
  }

  await connectToDatabase();
  const [data, settings] = await Promise.all([getFraudReportData(sessionIds), getSiteSettings()]);
  if (data.length === 0) {
    return NextResponse.json({ error: "None of the selected sessions could be found." }, { status: 404 });
  }

  const pdf = await generateFraudReportPdf(data, settings.siteName || "VivaBloom");
  await logAudit("suspiciousSession.exportFraudReport", {
    entityType: "TrackingEvent",
    entityId: `${data.length} sessions`,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invalid-click-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
