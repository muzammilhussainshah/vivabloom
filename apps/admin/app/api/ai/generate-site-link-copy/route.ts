import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateSiteLinkCopy } from "@/lib/ai/openai";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

/** Sitelinks are a single fast call, but still well over the default budget. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`sitelinkcopy:${session.user.email}`, {
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

  const { storeName, preferredKeywords, alreadyUsedKeywords, bestOffer, extraNotes, language } = (body ?? {}) as {
    storeName?: unknown;
    preferredKeywords?: unknown;
    alreadyUsedKeywords?: unknown;
    bestOffer?: unknown;
    extraNotes?: unknown;
    language?: unknown;
  };
  if (typeof storeName !== "string" || !storeName.trim()) {
    return NextResponse.json({ error: "'storeName' is required" }, { status: 400 });
  }

  const strArray = (value: unknown): string[] | undefined =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && !!v.trim()) : undefined;

  const resolvedLanguage = typeof language === "string" && language.trim() ? language.trim() : undefined;

  try {
    const overrides = await getAiModelOverrides();
    const siteLinks = await generateSiteLinkCopy(
      {
        storeName: storeName.trim(),
        preferredKeywords: strArray(preferredKeywords),
        alreadyUsedKeywords: strArray(alreadyUsedKeywords),
        bestOffer: typeof bestOffer === "string" && bestOffer.trim() ? bestOffer.trim() : undefined,
        extraNotes: typeof extraNotes === "string" && extraNotes.trim() ? extraNotes.trim() : undefined,
        currentDate: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        language: resolvedLanguage,
      },
      resolveModel("siteLinkCopy", overrides)
    );

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_site_link_copy",
      promptSummary: `Sitelink copy for ${storeName}${resolvedLanguage ? ` (${resolvedLanguage})` : ""}`.slice(0, 200),
    });

    return NextResponse.json(siteLinks);
  } catch (err) {
    console.error("generate-site-link-copy failed", err);
    const message = err instanceof Error ? err.message : "Sitelink copy generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
