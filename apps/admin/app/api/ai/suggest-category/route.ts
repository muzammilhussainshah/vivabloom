import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog, Category } from "@monocoupon/db";
import { suggestCategorySchema } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { fetchSiteSignal } from "@/lib/urlFetch";
import { generateCategorySuggestions } from "@/lib/ai/openai";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

/**
 * Given a store URL, checks it against every existing category and proposes
 * new-category name ideas — the Categories list's "Generate by AI" panel.
 * Fetches the store's page title/meta description first (best-effort, never
 * fails the request) so the AI has real signal beyond the bare URL.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`suggest-category:${session.user.email}`, {
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

  const parsed = suggestCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { storeUrl } = parsed.data;

  try {
    const [site] = await Promise.all([fetchSiteSignal(storeUrl), connectToDatabase()]);
    const existingCategories = await Category.find({}, "slug name description").sort({ name: 1 }).lean();

    const overrides = await getAiModelOverrides();
    const { matchedCategorySlug, suggestions } = await generateCategorySuggestions(
      {
        storeUrl,
        siteTitle: site.title,
        siteDescription: site.description,
        existingCategories: existingCategories.map((c) => ({
          slug: c.slug,
          name: c.name,
          description: c.description || undefined,
        })),
      },
      resolveModel("categorySuggest", overrides)
    );

    const matchedCategory = matchedCategorySlug
      ? existingCategories.find((c) => c.slug === matchedCategorySlug)
      : undefined;

    await AuditLog.create({
      user: session.user.id,
      action: "ai.suggest_category",
      promptSummary: storeUrl.slice(0, 200),
    });

    return NextResponse.json({
      siteTitle: site.title ?? null,
      siteDescription: site.description ?? null,
      matchedCategory: matchedCategory
        ? { id: String(matchedCategory._id), slug: matchedCategory.slug, name: matchedCategory.name }
        : null,
      suggestions,
    });
  } catch (err) {
    console.error("suggest-category failed", err);
    const message = err instanceof Error ? err.message : "Category suggestion failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
