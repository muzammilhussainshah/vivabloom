import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { pastedTermsSchema } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { applyPastedTerms, UserFacingError } from "@/lib/intelligence/runner";

/** Analyses affiliate-program terms the admin pasted (e.g. from a network dashboard) and merges them into the report. */
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid check id" }, { status: 400 });

  const rate = await checkRateLimit(`store-check-terms:${session.user.email}`, { name: "intelligence-terms", requests: 6, window: "60 s" });
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = pastedTermsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  try {
    await applyPastedTerms(id, parsed.data.text);
    await connectToDatabase();
    await AuditLog.create({ user: session.user.id, action: "intelligence.terms_pasted", entityType: "StoreCheck", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("pasted terms analysis failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed." }, { status: 502 });
  }
}
