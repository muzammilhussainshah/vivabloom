import type { Metadata } from "next";
import { connectToDatabase, NewsletterSubscriber } from "@monocoupon/db";
import { unsubscribe, deleteSubscriber } from "./actions";

export const metadata: Metadata = { title: "Subscribers" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export default async function SubscribersPage() {
  await connectToDatabase();
  const subscribers = await NewsletterSubscriber.find({}).sort({ subscribedAt: -1 }).limit(500).lean();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Subscribers</h1>
        <p className="text-sm text-text-muted">Newsletter subscribers — the most recent 500.</p>
      </div>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Source</th>
              <th className="p-3">Subscribed</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={String(s._id)} className="border-b border-border last:border-0">
                <td className="p-3">{s.email}</td>
                <td className="p-3">
                  {s.status === "confirmed" && <span className="text-brand-accent">Confirmed</span>}
                  {s.status === "pending" && <span className="text-text-muted">Pending</span>}
                  {s.status === "unsubscribed" && <span className="text-brand-secondary">Unsubscribed</span>}
                </td>
                <td className="p-3 text-text-muted">{s.source ?? "—"}</td>
                <td className="p-3 text-text-muted">{formatDate(s.subscribedAt)}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-3">
                    {s.status !== "unsubscribed" && (
                      <form action={unsubscribe.bind(null, String(s._id))}>
                        <button type="submit" className="text-brand-secondary hover:underline">
                          Unsubscribe
                        </button>
                      </form>
                    )}
                    <form action={deleteSubscriber.bind(null, String(s._id))}>
                      <button type="submit" className="text-brand-secondary hover:underline">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No subscribers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
