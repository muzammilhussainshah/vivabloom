import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateText } from "@/lib/ai/openai";
import { resolveModel, themeGeneratePrompt } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";
import { enforceReadability, parseThemeReply } from "@/lib/ai/themeGuard";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`theme:${session.user.email}`, { name: "ai", requests: 5, window: "60 s" });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const brief = typeof (body as { brief?: unknown })?.brief === "string" ? (body as { brief: string }).brief : "";

  try {
    const overrides = await getAiModelOverrides();
    const model = resolveModel("themeGenerate", overrides);
    const reply = await generateText(themeGeneratePrompt(brief), model);
    const parsed = parseThemeReply(reply);
    const values = enforceReadability(parsed.values);

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_theme",
      promptSummary: (brief || "default style").slice(0, 200),
    });

    return NextResponse.json({ name: parsed.name, values });
  } catch (err) {
    console.error("generate-theme failed", err);
    const message = err instanceof Error ? err.message : "Theme generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
