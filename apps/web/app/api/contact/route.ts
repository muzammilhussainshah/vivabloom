import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, ContactMessage, getSiteSettings } from "@monocoupon/db";
import { contactMessageSchema } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendContactNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ip = rawIp ?? "unknown";

  const rate = await checkRateLimit(`contact:${ip}`, { name: "contact", requests: 3, window: "60 m" });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many messages sent. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { turnstileToken, ...fields } = (body as { turnstileToken?: unknown } & Record<string, unknown>) ?? {};
  const verified = await verifyTurnstile(typeof turnstileToken === "string" ? turnstileToken : null, ip);
  if (!verified) {
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }

  const parsed = contactMessageSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await connectToDatabase();
  await ContactMessage.create(parsed.data);

  // The message is already saved above — if the notification email fails
  // to send, the submission still succeeds for the user; the admin can
  // still see it via the Messages page. Don't fail the request over this.
  try {
    const settings = await getSiteSettings();
    const to = settings.contact?.email;
    if (to) {
      await sendContactNotification({ to, ...parsed.data });
    } else {
      console.warn("No contact email configured in Site Settings — contact notification not sent");
    }
  } catch (err) {
    console.error("Failed to send contact notification email", err);
  }

  return NextResponse.json({ success: true });
}
