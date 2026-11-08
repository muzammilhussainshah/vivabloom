import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateImage } from "@/lib/ai/gemini";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`image:${session.user.email}`, { name: "ai", requests: 5, window: "60 s" });
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not set. Add it to apps/admin/.env.local." },
      { status: 500 }
    );
  }

  try {
    const overrides = await getAiModelOverrides();
    const model = resolveModel(typeof task === "string" ? task : null, overrides);
    const image = await generateImage(prompt, model);
    const extension = image.mimeType === "image/jpeg" ? "jpg" : "png";
    const filename = `ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const blob = await put(filename, image.data, {
      access: "public",
      contentType: image.mimeType,
    });

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_image",
      promptSummary: prompt.slice(0, 200),
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("generate-image failed", err);
    const message = err instanceof Error ? err.message : "Image generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
