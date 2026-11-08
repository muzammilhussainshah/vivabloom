import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateCategoryContent } from "@/lib/ai/openai";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

/** The category-form "Generate All" button: fills description + SEO fields for a chosen category name. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`category-content:${session.user.email}`, {
    name: "ai",
    requests: 5,
    window: "60 s",
  });
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

  const { name, storeUrl, siteTitle, siteDescription } = (body ?? {}) as {
    name?: unknown;
    storeUrl?: unknown;
    siteTitle?: unknown;
    siteDescription?: unknown;
  };
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "'name' is required" }, { status: 400 });
  }

  try {
    const overrides = await getAiModelOverrides();
    const content = await generateCategoryContent(
      {
        name: name.trim(),
        storeUrl: typeof storeUrl === "string" && storeUrl.trim() ? storeUrl.trim() : undefined,
        siteTitle: typeof siteTitle === "string" && siteTitle.trim() ? siteTitle.trim() : undefined,
        siteDescription:
          typeof siteDescription === "string" && siteDescription.trim() ? siteDescription.trim() : undefined,
      },
      resolveModel("categoryContent", overrides)
    );

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_category_content",
      promptSummary: name.slice(0, 200),
    });

    return NextResponse.json(content);
  } catch (err) {
    console.error("generate-category-content failed", err);
    const message = err instanceof Error ? err.message : "Category content generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
