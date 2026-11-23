import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateImage } from "@/lib/ai/gemini";
import { generateText } from "@/lib/ai/openai";
import { toLandscape } from "@/lib/ai/imageShape";
import { blogCoverFallbackScene, blogCoverRenderPrompt, resolveModel } from "@/lib/ai/prompts";
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
    const taskName = typeof task === "string" ? task : null;
    const model = resolveModel(taskName, overrides);
    const isBlogCover = taskName === "blogCover";

    // Blog covers: `prompt` is the art-director brief (blogCoverImagePrompt).
    // The text model turns it into one photo scene, which is wrapped with the
    // photographic/landscape rules for the image model. If the text step fails
    // the cover is still generated, from a scene built off the title.
    let finalPrompt = prompt;
    if (isBlogCover) {
      let scene: string;
      try {
        scene = await generateText(prompt, resolveModel("blogCoverScene", overrides));
      } catch (err) {
        console.warn("blog cover scene step failed; using title fallback", err);
        scene = blogCoverFallbackScene(prompt);
      }
      finalPrompt = blogCoverRenderPrompt(scene);
    }

    let image = await generateImage(finalPrompt, model, isBlogCover ? { aspectRatio: "16:9" } : {});
    // Blog banners are 16:9; FLUX only returns squares, so crop them to fit.
    if (isBlogCover) image = await toLandscape(image);
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
      promptSummary: finalPrompt.slice(0, 200),
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("generate-image failed", err);
    const message = err instanceof Error ? err.message : "Image generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
