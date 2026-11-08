import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, NewsletterSubscriber } from "@monocoupon/db";
import { newsletterSubscribeSchema } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendNewsletterWelcome } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

export async function POST(request: NextRequest) {
  const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ip = rawIp ?? "unknown";

  const rate = await checkRateLimit(`newsletter:${ip}`, { name: "newsletter", requests: 5, window: "60 m" });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { honeypot, ...fields } = (body as { honeypot?: unknown } & Record<string, unknown>) ?? {};
  // Honeypot: a hidden field real users never see or fill in. Bots that
  // blindly fill every form field trip this — return a fake success so
  // they don't learn to adapt.
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return NextResponse.json({ success: true });
  }

  const parsed = newsletterSubscribeSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await NewsletterSubscriber.findOne({ email: parsed.data.email });
  if (existing) {
    if (existing.status === "unsubscribed") {
      existing.status = "confirmed";
      existing.subscribedAt = new Date();
      await existing.save();
    }
    return NextResponse.json({ success: true });
  }

  const subscriber = await NewsletterSubscriber.create({
    email: parsed.data.email,
    status: "confirmed",
    source: "footer",
  });

  try {
    await sendNewsletterWelcome({
      to: subscriber.email,
      siteUrl: SITE_URL,
      unsubscribeToken: subscriber.unsubscribeToken,
    });
  } catch (err) {
    console.error("Failed to send newsletter welcome email", err);
  }

  return NextResponse.json({ success: true });
}
