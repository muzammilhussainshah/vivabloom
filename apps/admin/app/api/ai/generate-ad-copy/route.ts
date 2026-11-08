import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateAdCopy } from "@/lib/ai/openai";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

/**
 * Ad copy runs a reasoning model over a slot plan, which takes far longer than
 * the platform's default function budget allows — without this the request is
 * killed mid-flight and the UI sits on "Generating…" until it reports a
 * timeout. 60s is the ceiling on Vercel's Hobby plan; Pro allows up to 300.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`adcopy:${session.user.email}`, { name: "ai", requests: 5, window: "60 s" });
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

  const { storeName, descriptors, topKeywords, popularKeywords, bestOffer, extraNotes } = (body ?? {}) as {
    storeName?: unknown;
    descriptors?: unknown;
    topKeywords?: unknown;
    popularKeywords?: unknown;
    bestOffer?: unknown;
    extraNotes?: unknown;
  };
  if (typeof storeName !== "string" || !storeName.trim()) {
    return NextResponse.json({ error: "'storeName' is required" }, { status: 400 });
  }

  const strArray = (value: unknown): string[] | undefined =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && !!v.trim()) : undefined;

  try {
    const overrides = await getAiModelOverrides();
    const adCopy = await generateAdCopy(
      {
        storeName: storeName.trim(),
        descriptors: strArray(descriptors),
        topKeywords: strArray(topKeywords),
        popularKeywords: strArray(popularKeywords),
        bestOffer: typeof bestOffer === "string" && bestOffer.trim() ? bestOffer.trim() : undefined,
        extraNotes: typeof extraNotes === "string" && extraNotes.trim() ? extraNotes.trim() : undefined,
        currentDate: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      },
      resolveModel("adCopy", overrides)
    );

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action: "ai.generate_ad_copy",
      promptSummary: `Ad copy for ${storeName}`.slice(0, 200),
    });

    return NextResponse.json(adCopy);
  } catch (err) {
    console.error("generate-ad-copy failed", err);
    const message = err instanceof Error ? err.message : "Ad copy generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
