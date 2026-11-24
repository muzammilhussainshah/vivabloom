import { AiUsage, AuditLog, connectToDatabase } from "@monocoupon/db";
import { resolveModel } from "./prompts";
import { getAiModelOverrides } from "./overrides";

/** What the always-visible "AI limits" box shows. */
export interface UsageStatus {
  search: { configured: boolean; plan: string | null; used: number | null; limit: number | null; error: string | null };
  groq: {
    configured: boolean;
    blocked: boolean;
    blockedUntil: string | null;
    models: { model: string; requests: number; tokens: number; dayLimit: number | null; limitUsed: number | null; blockedUntil: string | null; limitKind: string | null }[];
  };
  images: { provider: string; today: number; month: number; dailyLimit: number | null };
  fetchedAt: string;
}

/** Groq's free tier gives the gpt-oss models 200,000 tokens/day (confirmed by its own 429 message); other models report theirs when they hit it. */
const KNOWN_GROQ_DAY_LIMIT: [RegExp, number][] = [[/gpt-oss/, 200_000]];

let tavilyCache: { at: number; value: UsageStatus["search"] } | null = null;

async function tavilyUsage(): Promise<UsageStatus["search"]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { configured: false, plan: null, used: null, limit: null, error: null };
  if (tavilyCache && Date.now() - tavilyCache.at < 60_000) return tavilyCache.value;
  let value: UsageStatus["search"];
  try {
    const res = await fetch("https://api.tavily.com/usage", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { account?: { current_plan?: string; plan_usage?: number; plan_limit?: number | null }; key?: { usage?: number; limit?: number | null } };
    value = {
      configured: true,
      plan: json.account?.current_plan ?? null,
      used: json.account?.plan_usage ?? json.key?.usage ?? null,
      limit: json.account?.plan_limit ?? json.key?.limit ?? null,
      error: null,
    };
  } catch (err) {
    value = { configured: true, plan: null, used: null, limit: null, error: err instanceof Error ? err.message : "Could not read usage" };
  }
  tavilyCache = { at: Date.now(), value };
  return value;
}

function imageProvider(model: string): string {
  if (model.startsWith("cloudflare/")) return "Cloudflare FLUX";
  if (model.includes("gemini")) return "Gemini";
  return model;
}

export async function getUsageStatus(): Promise<UsageStatus> {
  await connectToDatabase();
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [search, usageDocs, imagesToday, imagesMonth, overrides] = await Promise.all([
    tavilyUsage(),
    AiUsage.find({ provider: "groq", $or: [{ day }, { blockedUntil: { $gt: now } }] }).lean(),
    AuditLog.countDocuments({ action: "ai.generate_image", createdAt: { $gte: dayStart } }),
    AuditLog.countDocuments({ action: "ai.generate_image", createdAt: { $gte: monthStart } }),
    getAiModelOverrides(),
  ]);

  const byModel = new Map<string, UsageStatus["groq"]["models"][number]>();
  for (const d of usageDocs) {
    const cur = byModel.get(d.model) ?? { model: d.model, requests: 0, tokens: 0, dayLimit: null, limitUsed: null, blockedUntil: null, limitKind: null };
    if (d.day === day) {
      cur.requests += d.requests ?? 0;
      cur.tokens += (d.inputTokens ?? 0) + (d.outputTokens ?? 0);
    }
    // The newest limit message wins (it carries the exact numbers and the time it frees up).
    if (d.blockedUntil && (!cur.blockedUntil || d.blockedUntil.toISOString() > cur.blockedUntil)) {
      cur.blockedUntil = d.blockedUntil.toISOString();
      cur.limitKind = d.limitKind ?? null;
      cur.limitUsed = d.limitUsed ?? null;
    }
    cur.dayLimit = d.dayLimit ?? cur.dayLimit;
    byModel.set(d.model, cur);
  }
  const models = [...byModel.values()].map((m) => ({
    ...m,
    dayLimit: m.dayLimit ?? KNOWN_GROQ_DAY_LIMIT.find(([re]) => re.test(m.model))?.[1] ?? null,
    // A "blocked until" in the past is history, not a block.
    blockedUntil: m.blockedUntil && new Date(m.blockedUntil) > now ? m.blockedUntil : null,
  }));
  models.sort((a, b) => b.tokens - a.tokens);
  const blockedUntil = models.map((m) => m.blockedUntil).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;

  const imageModel = resolveModel("blogCover", overrides);
  const limitEnv = Number(process.env.AI_IMAGE_DAILY_LIMIT);

  return {
    search,
    groq: { configured: Boolean(process.env.GROQ_API_KEY), blocked: Boolean(blockedUntil), blockedUntil, models },
    images: { provider: imageProvider(imageModel), today: imagesToday, month: imagesMonth, dailyLimit: Number.isFinite(limitEnv) && limitEnv > 0 ? limitEnv : null },
    fetchedAt: now.toISOString(),
  };
}
