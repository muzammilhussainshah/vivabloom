import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { STORE_CHECK_STEPS, type StoreCheckStep } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { runStoreCheckStep, UserFacingError } from "@/lib/intelligence/runner";

/**
 * Runs ONE research step of a Store Check (identity | program | reputation |
 * products). Steps are separate requests so each fits the serverless time
 * limit; the step's result, or its error, is saved on the StoreCheck.
 */
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; step: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, step } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid check id" }, { status: 400 });
  if (!(STORE_CHECK_STEPS as readonly string[]).includes(step)) return NextResponse.json({ error: "Unknown step" }, { status: 400 });

  const rate = await checkRateLimit(`store-check-step:${session.user.email}`, { name: "intelligence-step", requests: 30, window: "60 s" });
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });

  try {
    const result = await runStoreCheckStep(id, step as StoreCheckStep);
    return NextResponse.json(result, { status: result.status === "done" ? 200 : 502 });
  } catch (err) {
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error(`store check step ${step} crashed`, err);
    return NextResponse.json({ error: "The step crashed unexpectedly." }, { status: 500 });
  }
}
