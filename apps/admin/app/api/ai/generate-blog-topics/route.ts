import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog, BlogPost, BlogTopicSuggestion, Store } from "@monocoupon/db";
import { generateBlogTopicsSchema, isBlogCountry } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateBlogTopics } from "@/lib/ai/openai";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

// Topics already published or offered for a store shouldn't be suggested again.
async function excludedTopicsFor(storeId: string, currentSuggestions: string[]): Promise<string[]> {
  const posts = await BlogPost.find({ relatedStores: storeId }, "title aiTopic").lean();
  const fromPosts = posts.flatMap((p) => [p.title, p.aiTopic].filter((t): t is string => !!t?.trim()));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...fromPosts, ...currentSuggestions]) {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t.trim());
  }
  return out;
}

// Loads the current suggestion batch for a store, without calling the AI.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const storeId = params.get("storeId");
  if (!storeId) {
    return NextResponse.json({ error: "'storeId' is required" }, { status: 400 });
  }
  const rawCountry = params.get("country")?.toLowerCase() || null;
  const country = rawCountry && isBlogCountry(rawCountry) ? rawCountry : null;

  await connectToDatabase();
  const doc = await BlogTopicSuggestion.findOne({ store: storeId, country }, "topics").lean();
  return NextResponse.json({ topics: doc?.topics ?? [] });
}

// Generates a fresh batch of topic ideas for a store and persists it, replacing
// whatever batch was there before (a "regenerate" is meant to feel different).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`blog-topics:${session.user.email}`, { name: "ai", requests: 5, window: "60 s" });
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

  const parsed = generateBlogTopicsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { storeId, country } = parsed.data;
  const normalizedCountry = country ?? null;

  await connectToDatabase();
  const store = await Store.findById(storeId).populate("categories", "name").lean();
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const existing = await BlogTopicSuggestion.findOne(
    { store: storeId, country: normalizedCountry },
    "topics"
  ).lean();
  const excludeTopics = await excludedTopicsFor(storeId, existing?.topics ?? []);

  try {
    const overrides = await getAiModelOverrides();
    const categories = (store.categories as unknown as { name: string }[] | undefined)?.map((c) => c.name);
    const { topics } = await generateBlogTopics(
      {
        storeName: store.name,
        storeDescription: store.description || undefined,
        categories,
        country: normalizedCountry,
        excludeTopics,
      },
      resolveModel("blogTopics", overrides)
    );

    await BlogTopicSuggestion.findOneAndUpdate(
      { store: storeId, country: normalizedCountry },
      { $set: { topics } },
      { upsert: true }
    );

    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_blog_topics",
      entityType: "Store",
      entityId: storeId,
    });

    return NextResponse.json({ topics });
  } catch (err) {
    console.error("generate-blog-topics failed", err);
    const message = err instanceof Error ? err.message : "Topic generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
