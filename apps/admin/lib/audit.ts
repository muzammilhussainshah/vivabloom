import { auth } from "@/auth";
import { connectToDatabase, AuditLog } from "@monocoupon/db";

/**
 * Writes an audit trail entry for the current session's admin action.
 * Never throws — a logging failure shouldn't fail the mutation it's
 * describing, so errors are swallowed and just logged to the console.
 */
export async function logAudit(
  action: string,
  opts?: { entityType?: string; entityId?: string }
): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return;

    await connectToDatabase();
    await AuditLog.create({
      user: session.user.id,
      action,
      entityType: opts?.entityType ?? null,
      entityId: opts?.entityId ?? null,
    });
  } catch (err) {
    console.error(`Failed to write audit log for action "${action}"`, err);
  }
}
