import type { Metadata } from "next";
import { connectToDatabase, NewsletterSubscriber } from "@monocoupon/db";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader eyebrow="Newsletter" title="Unsubscribe" description={message} centered divider={false} />
    </div>
  );
}
