import { createHmac } from "node:crypto";

/** HMAC-SHA256 of an IP address — the raw IP is never persisted. */
export function hashIp(ip: string | null): string | null {
  const secret = process.env.IP_HASH_SECRET;
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}
