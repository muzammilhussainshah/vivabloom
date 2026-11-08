import type { Metadata } from "next";
import { connectToDatabase, ContactMessage } from "@monocoupon/db";
import { markAsRead, deleteMessage } from "./actions";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Date(date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function MessagesPage() {
  await connectToDatabase();
  const messages = await ContactMessage.find({}).sort({ createdAt: -1 }).limit(200).lean();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-text-muted">Contact form submissions — the most recent 200.</p>
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <div
            key={String(m._id)}
            className={`flex flex-col gap-2 rounded-base border p-4 ${
              m.status === "new" ? "border-brand-primary bg-surface" : "border-border bg-surface-muted"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {m.name} <span className="font-normal text-text-muted">&lt;{m.email}&gt;</span>
                  {m.phone && <span className="font-normal text-text-muted"> · {m.phone}</span>}
                </p>
                <p className="text-xs text-text-muted">{formatDate(m.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                {m.status === "new" ? (
                  <form action={markAsRead.bind(null, String(m._id))}>
                    <button type="submit" className="text-sm text-brand-primary hover:underline">
                      Mark as read
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-text-muted">Read</span>
                )}
                <form action={deleteMessage.bind(null, String(m._id))}>
                  <button type="submit" className="text-sm text-brand-secondary hover:underline">
                    Delete
                  </button>
                </form>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.message}</p>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="rounded-base border border-border bg-surface p-6 text-center text-sm text-text-muted">
            No messages yet.
          </p>
        )}
      </div>
    </div>
  );
}
