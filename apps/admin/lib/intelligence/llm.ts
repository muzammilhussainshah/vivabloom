import { apiModel, getClient, groqParams } from "@/lib/ai/openai";
import { resolveModel } from "@/lib/ai/prompts";
import { getAiModelOverrides } from "@/lib/ai/overrides";

/**
 * One JSON-mode chat call for the Store Checker, with:
 * - the model chosen per task on the admin "AI Models" page;
 * - Zod validation of the reply, plus one repair attempt that shows the model its own errors;
 * - a wait-and-retry when the provider says "rate limited" (Groq's free tier
 *   allows ~8k tokens/minute per model), bounded so a step stays inside its
 *   serverless time budget.
 */

type StoreTask = "storeProgram" | "storeReputation" | "storeProducts" | "storeDiscovery";

/** The slice of a Zod schema we use (the schemas live in @monocoupon/validation; admin doesn't depend on zod directly). */
interface Validator<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };
}

export interface LlmResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

function isReasoningOpenAiModel(model: string): boolean {
  return !model.startsWith("groq/") && /^(o\d|gpt-5)/.test(model);
}

function retryAfterMs(err: unknown): number | null {
  const e = err as { status?: number; headers?: Record<string, string> | Headers };
  if (e?.status !== 429) return null;
  const header = e.headers instanceof Headers ? e.headers.get("retry-after") : e.headers?.["retry-after"];
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) ? Math.min(seconds * 1000 + 500, 30_000) : 12_000;
}

export async function llmJson<T>(opts: {
  task: StoreTask;
  system: string;
  user: string;
  schema: Validator<T>;
  maxOutputTokens: number;
  /** Absolute time (ms epoch) after which we stop retrying. */
  deadline: number;
}): Promise<LlmResult<T>> {
  const overrides = await getAiModelOverrides();
  const model = resolveModel(opts.task, overrides);
  const client = getClient(model);
  const isGroq = model.startsWith("groq/");
  const reasoning = isReasoningOpenAiModel(model);

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  let inputTokens = 0;
  let outputTokens = 0;
  let lastError = "The AI returned no usable answer.";

  for (let attempt = 0; attempt < 4; attempt++) {
    const remaining = opts.deadline - Date.now();
    if (remaining < 4_000) break;
    let raw: string | null | undefined;
    try {
      const response = await client.chat.completions.create(
        {
          model: apiModel(model),
          messages,
          response_format: { type: "json_object" },
          ...(reasoning ? { max_completion_tokens: opts.maxOutputTokens * 3 } : { max_tokens: isGroq ? opts.maxOutputTokens + 800 : opts.maxOutputTokens }),
          ...(reasoning ? {} : { temperature: 0 }),
          ...groqParams(model),
        },
        { timeout: Math.min(remaining - 1_000, 50_000), maxRetries: 0 }
      );
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;
      raw = response.choices[0]?.message?.content;
    } catch (err) {
      const wait = retryAfterMs(err);
      if (wait != null && Date.now() + wait < opts.deadline - 8_000) {
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`AI request failed (${model}): ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!raw) {
      lastError = "The AI returned an empty response.";
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      lastError = "The AI returned malformed JSON.";
      messages.push({ role: "assistant", content: raw.slice(0, 4000) }, { role: "user", content: "That was not valid JSON. Return the same answer as one valid JSON object only." });
      continue;
    }
    const parsed = opts.schema.safeParse(json);
    if (parsed.success) return { data: parsed.data, model, inputTokens, outputTokens };
    lastError = `The AI reply did not match the expected shape: ${parsed.error.issues[0]?.message ?? "invalid"}`;
    messages.push(
      { role: "assistant", content: raw.slice(0, 4000) },
      { role: "user", content: `Your JSON did not match the required shape (${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}). Return the corrected JSON object only.` }
    );
  }
  throw new Error(lastError);
}
