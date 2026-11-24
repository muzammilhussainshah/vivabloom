import { AiUsage, connectToDatabase } from "@monocoupon/db";

/**
 * Counts every AI call the app makes (tokens per model per day) and remembers
 * "rate limit reached" answers exactly as the provider reported them. Wired in
 * through a wrapped fetch on the OpenAI/Groq clients (see getClient), so no
 * call site needs to change. Tracking must never break an AI call: every
 * failure here is swallowed.
 */

export type AiProvider = "groq" | "openai";

const today = () => new Date().toISOString().slice(0, 10);

/** "31m35.184s" / "1h2m3s" / "45s" → milliseconds. */
export function parseWait(text: string): number | null {
  const m = text.match(/try again in\s+(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/i);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
}

/** Pulls the numbers out of Groq's 429 message ("... tokens per day (TPD): Limit 200000, Used 198684 ... try again in 31m35s"). */
export function parseRateLimit(message: string): { kind: "day" | "minute" | "other"; limit: number | null; used: number | null; waitMs: number | null } {
  const kind = /\(TPD\)|per day|\(RPD\)/i.test(message) ? "day" : /\(TPM\)|per minute|\(RPM\)/i.test(message) ? "minute" : "other";
  const limit = message.match(/Limit\s+(\d+)/i)?.[1];
  const used = message.match(/Used\s+(\d+)/i)?.[1];
  return { kind, limit: limit ? Number(limit) : null, used: used ? Number(used) : null, waitMs: parseWait(message) };
}

async function record(provider: AiProvider, model: string, inc: { requests?: number; inputTokens?: number; outputTokens?: number }, set: Record<string, unknown> = {}) {
  await connectToDatabase();
  await AiUsage.updateOne(
    { day: today(), provider, model },
    { $inc: { requests: inc.requests ?? 0, inputTokens: inc.inputTokens ?? 0, outputTokens: inc.outputTokens ?? 0 }, ...(Object.keys(set).length ? { $set: set } : {}) },
    { upsert: true }
  );
}

async function inspect(provider: AiProvider, requestModel: string | null, res: Response) {
  if (res.status === 429) {
    const body = (await res.text().catch(() => "")) || "";
    let message = body;
    try {
      message = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body;
    } catch {
      /* keep raw text */
    }
    const model = requestModel ?? message.match(/model `([^`]+)`/)?.[1] ?? "unknown";
    const info = parseRateLimit(message);
    await record(provider, model, { requests: 1 }, {
      limitKind: info.kind,
      dayLimit: info.limit,
      limitUsed: info.used,
      blockedUntil: info.waitMs != null ? new Date(Date.now() + info.waitMs) : null,
      limitSeenAt: new Date(),
    });
    return;
  }
  if (!res.ok) return;
  const json = (await res.json().catch(() => null)) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  if (!json?.usage) return;
  await record(provider, requestModel ?? json.model ?? "unknown", { requests: 1, inputTokens: json.usage.prompt_tokens ?? 0, outputTokens: json.usage.completion_tokens ?? 0 });
}

/** A fetch that behaves exactly like the global one but also notes token usage and rate-limit answers. */
export function trackedFetch(provider: AiProvider): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init);
    try {
      let model: string | null = null;
      if (typeof init?.body === "string") model = (JSON.parse(init.body) as { model?: string }).model ?? null;
      void inspect(provider, model, res.clone()).catch(() => {});
    } catch {
      /* never break the AI call */
    }
    return res;
  };
}
