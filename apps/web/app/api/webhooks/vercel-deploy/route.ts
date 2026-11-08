import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateAllPPCPaths } from "@/lib/revalidateAll";

/**
 * Vercel calls this after every deployment (subscribed via `vercel webhooks
 * create`, scoped to just this project's `deployment.succeeded` event — see
 * the setup note in .env.example for the exact command;
 * `deployment.ready` isn't accepted at project scope, only account/team scope).
 * Its only job is closing the gap `revalidateAllPPCPaths` exists for: a new
 * deploy ships new code, but already-cached ISR pages from the *previous*
 * deployment don't know to throw themselves out, so without this a code
 * change can sit invisible behind a warm cache for up to 24h.
 *
 * Vercel signs the raw body with HMAC-SHA1 using the secret shown once at
 * webhook-creation time (VERCEL_WEBHOOK_SECRET here) — verify against the
 * raw bytes, not the parsed JSON, since re-serializing could change spacing
 * and silently break the signature.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-vercel-signature");
  const expected = crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
  if (
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, payload } = body as { type?: string; payload?: { target?: string; project?: { id?: string } } };

  // Ignore preview deploys and any other event type this webhook might
  // someday be subscribed to — only a successful PRODUCTION deploy of THIS
  // project should trigger a full-site bust.
  if (type !== "deployment.succeeded" || payload?.target !== "production") {
    return NextResponse.json({ skipped: true, type, target: payload?.target ?? null });
  }

  const result = await revalidateAllPPCPaths(request.nextUrl.origin);
  return NextResponse.json({ revalidated: true, ...result });
}
