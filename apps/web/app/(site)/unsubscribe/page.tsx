import type { Metadata } from "next";
import { connectToDatabase, NewsletterSubscriber } from "@monocoupon/db";

export const metadata: Metadata = { title: "Unsubscribe" };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let message = "Invalid or missing unsubscribe link.";
  if (token) {
    await connectToDatabase();
    const subscriber = await NewsletterSubscriber.findOne({ unsubscribeToken: token });
    if (subscriber) {
      subscriber.status = "unsubscribed";
      await subscriber.save();
      message = `You've been unsubscribed (${subscriber.email}). You won't receive any more emails from us.`;
    } else {
      message = "This unsubscribe link is invalid or has already been used.";
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 py-16 text-center sm:px-8">
      <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">Unsubscribe</h1>
      <p className="text-text-muted">{message}</p>
    </div>
  );
}
