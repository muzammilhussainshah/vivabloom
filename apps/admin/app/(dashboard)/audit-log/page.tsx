import type { Metadata } from "next";
import { connectToDatabase, AuditLog } from "@monocoupon/db";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Date(date).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AuditLogPage() {
  await connectToDatabase();
  const entries = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("user", "name email")
    .lean();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-text-muted">The most recent 200 admin actions.</p>
      </div>

      <div className="overflow-x-auto rounded-base border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const user = entry.user as unknown as { name?: string; email?: string } | null;
              return (
                <tr key={String(entry._id)} className="border-b border-border last:border-0">
                  <td className="p-3 whitespace-nowrap text-text-muted">{formatDate(entry.createdAt)}</td>
                  <td className="p-3">{user?.name ?? user?.email ?? "Unknown"}</td>
                  <td className="p-3 font-mono text-xs">{entry.action}</td>
                  <td className="p-3 text-text-muted">
                    {entry.entityType ? `${entry.entityType}${entry.entityId ? ` #${entry.entityId.slice(-6)}` : ""}` : "—"}
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-text-muted">
                  No audit log entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
