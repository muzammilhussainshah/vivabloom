import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set. Add it to apps/web/.env.local.");
  }
  if (!client) client = new Resend(apiKey);
  return client;
}

function fromAddress(): string {
  // Defaults to Resend's sandbox sender, which only delivers to the
  // account owner's own verified email — real delivery to arbitrary
  // recipients requires verifying a sending domain in Resend and setting
  // RESEND_FROM_EMAIL to an address on that domain.
  return process.env.RESEND_FROM_EMAIL || "VivaBloom <onboarding@resend.dev>";
}

export interface ContactNotificationInput {
  to: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
}

export async function sendContactNotification({ to, name, email, phone, message }: ContactNotificationInput) {
  const resend = getClient();
  await resend.emails.send({
    from: fromAddress(),
    to,
    replyTo: email,
    subject: `New contact form message from ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export interface NewsletterWelcomeInput {
  to: string;
  siteUrl: string;
  unsubscribeToken: string;
}

export async function sendNewsletterWelcome({ to, siteUrl, unsubscribeToken }: NewsletterWelcomeInput) {
  const resend = getClient();
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${unsubscribeToken}`;
  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: "You're subscribed to VivaBloom deals",
    text: [
      "Thanks for subscribing! You'll get the latest coupon codes and deals in your inbox.",
      "",
      `Didn't sign up? Unsubscribe here: ${unsubscribeUrl}`,
    ].join("\n"),
  });
}
