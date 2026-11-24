import { reputationExtractionSchema } from "@monocoupon/validation";
import { STORE_REPUTATION_SYSTEM_PROMPT, storeReputationPrompt } from "@/lib/ai/prompts";
import { llmJson } from "./llm";
import { tavilySearchAll, type TavilyResult } from "./tavily";
import { brandMatchers, domainOfUrl, mentionsBrand } from "./domain";
import { quoteInText } from "./evidence";
import type { ReputationItem, ReputationResult, SourceRef, StepUsage } from "./types";

/**
 * Step 3 — what do affiliates and customers say? Web search for payment /
 * termination complaints and general reviews, AI classification of each
 * result (with a verified quote), then weighting by how credible and how
 * recent each source is. Complaints are treated as allegations: the risk
 * score weighs them, nothing here calls a store fraudulent by itself.
 */

/** ~3.5k tokens — the reputation model runs on its own Groq budget. */
const CHAR_BUDGET = 13_000;
const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

/** How much a source's word counts (0–1). */
export function sourceTier(url: string, storeDomain: string): number {
  const domain = domainOfUrl(url) ?? "";
  if (domain === storeDomain) return 0.1;
  if (/\.gov(\.[a-z]{2})?$|ftc\.gov|bbb\.org/.test(domain)) return 1;
  if (/(reuters|bbc|nytimes|theguardian|wsj|cnbc|forbes|bloomberg|businessinsider|techcrunch)\./.test(domain)) return 0.9;
  if (/(affiliatefix|warriorforum|affiliatesummit|affiliatemarketingforum|blackhatworld|digitalpoint|webmasterworld)\./.test(domain)) return 0.7;
  if (/(trustpilot|sitejabber|reviews\.io|resellerratings|productreview|pissedconsumer|complaintsboard)\./.test(domain)) return 0.6;
  if (/reddit\.com|quora\.com/.test(domain)) return 0.45;
  return 0.3;
}

export function recencyFactor(date: string | null, now = Date.now()): number {
  if (!date) return 0.5;
  const t = Date.parse(date.length === 4 ? `${date}-07-01` : date.length === 7 ? `${date}-15` : date);
  if (!Number.isFinite(t)) return 0.5;
  const months = Math.max(0, (now - t) / MONTH_MS);
  return Math.exp(-months / 12);
}

export async function runReputationStep(args: { domain: string; name: string; deadline: number }): Promise<{
  reputation: ReputationResult;
  sources: SourceRef[];
  usage: StepUsage;
}> {
  const { domain, name } = args;
  const matchers = brandMatchers(name, domain);
  const usage: StepUsage = { tavilyCredits: 0, llmInputTokens: 0, llmOutputTokens: 0 };
  const queries = [
    `"${name}" affiliate program review payments`,
    `"${name}" affiliate not paid OR terminated OR "commission" complaint`,
    `"${name}" reviews complaints scam`,
    `"${name}" trustpilot reviews`,
  ];
  const searched = await tavilySearchAll(queries, { maxResults: 8 });
  usage.tavilyCredits += searched.credits;

  const seen = new Set<string>();
  const results: TavilyResult[] = [];
  for (const r of searched.results.flat()) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    if (mentionsBrand(`${r.title}\n${r.content}\n${r.url}`, matchers)) results.push(r);
  }

  const now = new Date().toISOString();
  const empty: ReputationResult = { items: [], customerRating: null, coverage: 0, queries };
  if (results.length === 0) return { reputation: empty, sources: [], usage };

  const inputs: { url: string; title: string; date: string | null; text: string }[] = [];
  let budget = CHAR_BUDGET;
  for (const r of results) {
    const text = r.content.replace(/\s+/g, " ").slice(0, 900);
    if (budget - text.length < 0 || inputs.length >= 22) break;
    budget -= text.length;
    inputs.push({ url: r.url, title: r.title.slice(0, 150), date: r.publishedDate ? r.publishedDate.slice(0, 10) : null, text });
  }

  const llm = await llmJson({
    task: "storeReputation",
    system: STORE_REPUTATION_SYSTEM_PROMPT,
    user: storeReputationPrompt({ name, domain, results: inputs }),
    schema: reputationExtractionSchema,
    maxOutputTokens: 1800,
    deadline: args.deadline,
  });
  usage.llmInputTokens += llm.inputTokens;
  usage.llmOutputTokens += llm.outputTokens;

  const items: ReputationItem[] = [];
  for (const item of llm.data.items) {
    if (item.kind === "irrelevant") continue;
    const input = inputs[item.index];
    if (!input) continue;
    // A classification only counts when its quote really is in that result.
    if (!quoteInText(item.quote, `${input.title}\n${input.text}`)) continue;
    const date = input.date ?? item.date;
    const tier = sourceTier(input.url, domain);
    items.push({
      kind: item.kind,
      summary: item.summary,
      quote: item.quote,
      url: input.url,
      title: input.title,
      date,
      sourceTier: tier,
      weight: Math.round(tier * recencyFactor(date) * 100) / 100,
    });
  }

  let customerRating: ReputationResult["customerRating"] = null;
  const cr = llm.data.customerRating;
  const crInput = cr?.index != null ? inputs[cr.index] : undefined;
  if (cr?.value != null && crInput && quoteInText(cr.quote, `${crInput.title}\n${crInput.text}`)) {
    customerRating = {
      value: cr.value,
      scale: cr.scale ?? 5,
      count: cr.count,
      platform: cr.platform,
      url: crInput.url,
      quote: cr.quote,
    };
  }

  const sources: SourceRef[] = items.map((i) => ({
    url: i.url,
    title: i.title,
    kind: sourceTier(i.url, domain) >= 0.6 && sourceTier(i.url, domain) < 0.9 ? "review" : "search_result",
    fetchedAt: now,
  }));
  if (customerRating?.url && !sources.some((s) => s.url === customerRating?.url)) {
    sources.push({ url: customerRating.url, title: customerRating.platform ?? "Customer rating", kind: "review", fetchedAt: now });
  }

  return { reputation: { items, customerRating, coverage: results.length, queries }, sources, usage };
}
