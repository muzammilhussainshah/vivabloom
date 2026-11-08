import Anthropic from "@anthropic-ai/sdk";

/** Claude models are picked per task on the AI Models admin page; any id starting with "claude" routes here. */
export function isClaudeModel(model: string): boolean {
  return model.startsWith("claude");
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to apps/admin/.env.local.");
  }
  if (!client) client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  return client;
}

/**
 * Plain text completion. Sampling params (temperature etc.) are not sent: current
 * Claude models reject non-default values. Effort is "low" because these are short
 * copywriting jobs, and the output cap leaves headroom for any reasoning tokens.
 */
export async function claudeComplete(opts: {
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  json?: boolean;
}): Promise<string> {
  const system = opts.json
    ? `${opts.system}\n\nRespond with a single valid JSON object only, with no markdown fences and no text before or after it.`
    : opts.system;

  const response = await getClient().messages.create({
    model: opts.model,
    max_tokens: Math.max(opts.maxTokens * 4, 2000),
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`${opts.model} declined this request.`);
  }
  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error(`${opts.model} returned an empty response.`);
  if (!opts.json) return text;

  // Tolerate a stray ```json fence even though the prompt asks for bare JSON.
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : text;
}
