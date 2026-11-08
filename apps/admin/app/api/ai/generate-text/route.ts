import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateText } from "@/lib/ai/openai";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`text:${session.user.email}`, { name: "ai", requests: 5, window: "60 s" });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, task } = (body ?? {}) as { prompt?: unknown; task?: unknown };
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "'prompt' is required" }, { status: 400 });
  }

  try {
    const overrides = await getAiModelOverrides();
    const model = resolveModel(typeof task === "string" ? task : null, overrides);
    const text = await generateText(prompt, model);

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_text",
      promptSummary: prompt.slice(0, 200),
    });

    return NextResponse.json({ text });
  } catch (err) {
    console.error("generate-text failed", err);
    const message = err instanceof Error ? err.message : "Text generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
