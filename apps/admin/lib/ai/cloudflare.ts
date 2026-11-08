/**
 * Image generation on Cloudflare Workers AI (free daily allowance, no card needed).
 * Model ids look like "cloudflare/@cf/black-forest-labs/flux-1-schnell"; the
 * "cloudflare/" prefix only routes the call here and is dropped before the request.
 */
export const CLOUDFLARE_PREFIX = "cloudflare/";

export function isCloudflareModel(model: string): boolean {
  return model.startsWith(CLOUDFLARE_PREFIX);
}

// FLUX.1 schnell accepts prompts up to 2048 characters.
const MAX_PROMPT_CHARS = 2048;

export async function generateCloudflareImage(
  prompt: string,
  model: string
): Promise<{ data: Buffer; mimeType: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set in apps/admin/.env.local.");
  }

  const cfModel = model.slice(CLOUDFLARE_PREFIX.length);
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.slice(0, MAX_PROMPT_CHARS), steps: 4 }),
    signal: AbortSignal.timeout(60_000),
  });

  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    result?: { image?: string };
    errors?: { message?: string }[];
  } | null;

  if (!res.ok || !body?.success || !body.result?.image) {
    const reason = body?.errors?.map((e) => e.message).filter(Boolean).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare image generation failed: ${reason}`);
  }

  // FLUX schnell returns a base64-encoded JPEG.
  return { data: Buffer.from(body.result.image, "base64"), mimeType: "image/jpeg" };
}
