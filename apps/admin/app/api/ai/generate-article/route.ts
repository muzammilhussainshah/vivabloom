import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateArticle } from "@/lib/ai/openai";
import { resolveModel, type ArticleProduct } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";
import { isBlogCountry } from "@monocoupon/validation";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`article:${session.user.email}`, { name: "ai", requests: 5, window: "60 s" });
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

  const { topic, storeName, products, country } = (body ?? {}) as {
    topic?: unknown;
    storeName?: unknown;
    products?: unknown;
    country?: unknown;
  };
  if (typeof topic !== "string" || !topic.trim()) {
    return NextResponse.json({ error: "'topic' is required" }, { status: 400 });
  }

  const parsedProducts: ArticleProduct[] | undefined = Array.isArray(products)
    ? products.filter(
        (p): p is ArticleProduct =>
          !!p && typeof p === "object" && typeof p.name === "string" && typeof p.productUrl === "string"
      )
    : undefined;
  const parsedCountry = typeof country === "string" && isBlogCountry(country) ? country : undefined;

  try {
    const overrides = await getAiModelOverrides();
    const article = await generateArticle(
      topic.trim(),
      typeof storeName === "string" && storeName.trim() ? storeName.trim() : undefined,
      resolveModel("article", overrides),
      parsedProducts,
      parsedCountry
    );

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_article",
      promptSummary: topic.slice(0, 200),
    });

    return NextResponse.json(article);
  } catch (err) {
    console.error("generate-article failed", err);
    const message = err instanceof Error ? err.message : "Article generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
