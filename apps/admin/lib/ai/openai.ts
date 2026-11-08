import OpenAI from "openai";
import { claudeComplete, isClaudeModel } from "./claude";
import {
  AD_COPY_SYSTEM_PROMPT,
  AD_DESCRIPTION_COUNT,
  AD_DESCRIPTION_MAX_CHARS,
  AD_DESCRIPTION_THEMES,
  AD_HEADLINE_CATEGORIES,
  AD_HEADLINE_COUNT,
  AD_HEADLINE_MAX_CHARS,
  AD_MAX_HEADLINES_WITH_STORE_NAME,
  AI_MODELS,
  ARTICLE_SYSTEM_PROMPT,
  BLOG_TOPICS_SYSTEM_PROMPT,
  CATEGORY_CONTENT_SYSTEM_PROMPT,
  CATEGORY_SUGGEST_SYSTEM_PROMPT,
  SITE_LINK_DESCRIPTION_MAX_CHARS,
  SITE_LINK_PAGES,
  SITE_LINK_SYSTEM_PROMPT,
  SITE_LINK_TEXT_MAX_CHARS,
  TEXT_SYSTEM_PROMPT,
  adCopyPrompt,
  articlePrompt,
  blogTopicsPrompt,
  categoryContentPrompt,
  categorySuggestPrompt,
  siteLinkCopyPrompt,
  type AdCandidate,
  type ArticleProduct,
  type GeneratedAdCopy,
  type GeneratedArticle,
  type GeneratedBlogTopics,
  type GeneratedCategoryContent,
  type GeneratedCategorySuggestions,
  type GeneratedSiteLink,
  type GeneratedSiteLinkCopy,
  type SiteLinkPageKey,
} from "./prompts";

export type {
  GeneratedAdCopy,
  GeneratedArticle,
  GeneratedBlogTopics,
  GeneratedCategoryContent,
  GeneratedCategorySuggestions,
  GeneratedSiteLinkCopy,
};

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to apps/admin/.env.local.");
  }
  if (!client) {
    // The SDK defaults to a 10-minute timeout and 2 automatic retries, so a
    // slow call can hold a request open for half an hour with the UI stuck on
    // "Generating…". Fail fast enough to show the user an error instead.
    client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
  }
  return client;
}

/**
 * JSON-mode completion for the simple (non-reasoning) tasks. Routes to Claude when
 * the chosen model is a Claude id, otherwise uses OpenAI exactly as before.
 */
async function jsonCompletion(opts: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}): Promise<string | null> {
  if (isClaudeModel(opts.model)) {
    return claudeComplete({ model: opts.model, system: opts.system, prompt: opts.user, maxTokens: opts.maxTokens, json: true });
  }
  const response = await getClient().chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return response.choices[0]?.message?.content ?? null;
}

/** Generates short marketing/editorial copy. Capped output length to bound cost. */
export async function generateText(
  prompt: string,
  model: string = AI_MODELS.text.blogDraft
): Promise<string> {
  if (isClaudeModel(model)) {
    return claudeComplete({ model, system: TEXT_SYSTEM_PROMPT, prompt, maxTokens: 700 });
  }
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 700,
    temperature: 0.7,
    messages: [
      { role: "system", content: TEXT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }
  return text.trim();
}

/**
 * Normalizes the model's output into tagged candidates. Accepts both the
 * tagged `{ text, category }` shape and a bare string, so a model that ignores
 * the tagging contract still produces usable copy (just untagged).
 */
export function toCandidates(raw: unknown): AdCandidate[] {
  if (!Array.isArray(raw)) return [];
  const out: AdCandidate[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) out.push({ text: item.trim(), category: "" });
    } else if (item && typeof item === "object") {
      const { text, category } = item as { text?: unknown; category?: unknown };
      if (typeof text === "string" && text.trim()) {
        out.push({ text: text.trim(), category: typeof category === "string" ? category.trim().toLowerCase() : "" });
      }
    }
  }
  return out;
}

const AD_STOPWORDS = new Set(["a", "an", "the", "to", "for", "of", "on", "at", "in", "up", "your", "you", "with", "and"]);

/**
 * Content tokens of a line, minus stopwords and the store's own name. Digits
 * collapse to "#" so "40% Off" and "50% Off" register as the same message —
 * swapping the number is the most common way a near-duplicate slips through.
 */
function contentTokens(text: string, storeTokens: Set<string>): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9%$\s]/g, " ")
      .replace(/\d+/g, "#")
      .split(/\s+/)
      .filter((w) => w && !AD_STOPWORDS.has(w) && !storeTokens.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Two lines count as the same message when half their content words overlap —
 * "50% Off Sitewide" vs "Up To 50% Off Orders". Deliberately aggressive: the
 * prompt over-generates candidates precisely so this can throw work away, and
 * a rejected near-duplicate costs nothing while a kept one costs Ad Strength.
 */
const NEAR_DUPLICATE_THRESHOLD = 0.5;

/** A stated discount ("50% off", "$20 off") — allowed only in the offer slots. */
const DISCOUNT_PATTERN = /\d\s*(%|percent|off|\$)|\$\s*\d/i;

type AdCopyReasoningEffort = "low" | "medium" | "high";

/**
 * Ad copy is the slowest AI call in the app: a reasoning model thinking through
 * a slot plan before writing ~40 tagged assets. These bound it so the request
 * finishes inside the route's `maxDuration` instead of the platform killing it
 * mid-flight, or the shared 60s client timeout firing as "Request timed out."
 */
const AD_COPY_REQUEST_TIMEOUT_MS = 50_000;

/**
 * Total wall-clock allowance for all calls in one generation, held under the
 * route's `maxDuration` so we return a real ad or a real error rather than
 * being killed. The optional top-up call gets only the time left over.
 */
const AD_COPY_TOTAL_BUDGET_MS = 50_000;

/** Not worth a top-up call with less time than this remaining. */
const AD_COPY_MIN_TOPUP_MS = 12_000;

/**
 * "low" keeps a single call comfortably inside the timeout. Diversity no longer
 * depends on the model reasoning hard about it — `selectAdLines` enforces the
 * category slots, the store-name cap and the near-duplicate rule after the
 * fact — so the extra thinking time buys adherence, not correctness. Raise to
 * "medium" only alongside a higher `maxDuration` and request timeout.
 */
const AD_COPY_REASONING_EFFORT: AdCopyReasoningEffort = "low";

/**
 * o-series and gpt-5+ models think before answering and accept
 * `reasoning_effort`; the gpt-4 family rejects that parameter with a 400 and
 * takes `temperature` instead. The model is admin-selectable, so which family
 * we are talking to has to be decided per call rather than assumed.
 */
function isReasoningModel(model: string): boolean {
  return /^o\d/.test(model) || /^gpt-([5-9]|\d{2,})/.test(model);
}

/**
 * On a reasoning model this budget covers the thinking AND the answer, and the
 * thinking runs first — set it too low and the model burns the whole allowance
 * reasoning, then returns empty content with finish_reason "length". The ad
 * copy itself is only ~1.5k tokens (≈35 tagged headlines plus 8 descriptions);
 * the rest is headroom for reasoning. Unused tokens are not billed.
 */
const AD_COPY_MAX_COMPLETION_TOKENS = 16000;

/**
 * Picks the final assets from the model's candidates, enforcing the diversity
 * the prompt asks for rather than trusting the model to have honored it.
 *
 * Two rules are hard and never relaxed: no near-duplicate of a line already
 * chosen, and no more discount-carrying headlines than the offer slots allow.
 * A near-duplicate contributes nothing to Ad Strength and is exactly what
 * "your headlines are too similar" penalizes, so returning 13 distinct
 * headlines beats returning 15 with two that say the same thing. When the pool
 * is too thin, the caller re-prompts for more candidates instead.
 *
 * The store-name and per-category caps are soft: they shape a healthy pool but
 * are relaxed tier by tier rather than leaving the ad short.
 */
export function selectAdLines(
  candidates: AdCandidate[],
  {
    maxChars,
    count,
    slots,
    storeName = "",
    maxWithStoreName,
    maxWithDiscount,
  }: {
    maxChars: number;
    count: number;
    /** Per-category ceiling; categories absent from the map are unconstrained. */
    slots?: Map<string, number>;
    storeName?: string;
    maxWithStoreName?: number;
    maxWithDiscount?: number;
  }
): string[] {
  const storeTokens = new Set(
    storeName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean)
  );

  const valid = candidates.filter((c) => c.text.length <= maxChars);

  const chosen: string[] = [];
  const chosenKeys = new Set<string>();
  const chosenTokens: Set<string>[] = [];
  const perCategory = new Map<string, number>();
  let withStoreName = 0;
  let withDiscount = 0;

  // Tier 0 = every rule, 1 = allow the store name freely, 2 = ignore the
  // per-category caps (and admit untagged candidates).
  for (let tier = 0; tier < 3 && chosen.length < count; tier += 1) {
    for (const candidate of valid) {
      if (chosen.length === count) break;

      const key = candidate.text.toLowerCase();
      if (chosenKeys.has(key)) continue;

      const tokens = contentTokens(candidate.text, storeTokens);
      const hasStoreName = storeTokens.size > 0 && [...storeTokens].every((t) => key.includes(t));
      const hasDiscount = DISCOUNT_PATTERN.test(candidate.text);

      // Hard rules.
      if (chosenTokens.some((t) => jaccard(tokens, t) >= NEAR_DUPLICATE_THRESHOLD)) continue;
      if (maxWithDiscount !== undefined && hasDiscount && withDiscount >= maxWithDiscount) continue;

      // Soft rules.
      if (tier < 2 && slots) {
        const limit = slots.get(candidate.category);
        if (limit !== undefined && (perCategory.get(candidate.category) ?? 0) >= limit) continue;
        // An untagged candidate can't be slotted, so hold it back for tier 2+.
        if (limit === undefined) continue;
      }
      if (tier < 1 && maxWithStoreName !== undefined && hasStoreName && withStoreName >= maxWithStoreName) continue;

      chosen.push(candidate.text);
      chosenKeys.add(key);
      chosenTokens.push(tokens);
      perCategory.set(candidate.category, (perCategory.get(candidate.category) ?? 0) + 1);
      if (hasStoreName) withStoreName += 1;
      if (hasDiscount) withDiscount += 1;
    }
  }

  return chosen;
}

/**
 * Generates Google Ads RSA copy (15 headlines ≤30 chars, 4 descriptions
 * ≤90 chars) as structured JSON. The model over-generates candidates; we keep
 * the first N that pass the hard character limits, topping up with a second
 * call if too many candidates were over-length.
 */
export async function generateAdCopy(
  args: Parameters<typeof adCopyPrompt>[0],
  model: string = AI_MODELS.text.adCopy
): Promise<GeneratedAdCopy> {
  const openai = getClient();
  const headlineSlots = new Map(AD_HEADLINE_CATEGORIES.map((c) => [c.key as string, c.slots as number]));
  const descriptionSlots = new Map(AD_DESCRIPTION_THEMES.map((t) => [t.key as string, 1]));
  const offerSlots = AD_HEADLINE_CATEGORIES.find((c) => c.key === "offer")?.slots ?? 2;

  async function requestCandidates(
    extraNotes?: string,
    effort: AdCopyReasoningEffort = AD_COPY_REASONING_EFFORT,
    timeoutMs: number = AD_COPY_REQUEST_TIMEOUT_MS
  ): Promise<{ headlines: AdCandidate[]; descriptions: AdCandidate[] }> {
    if (isClaudeModel(model)) {
      const text = await claudeComplete({
        model,
        system: AD_COPY_SYSTEM_PROMPT,
        prompt: adCopyPrompt({ ...args, extraNotes: [args.extraNotes, extraNotes].filter(Boolean).join("\n") }),
        maxTokens: AD_COPY_MAX_COMPLETION_TOKENS,
        json: true,
      });
      let parsedClaude: Record<string, unknown>;
      try {
        parsedClaude = JSON.parse(text);
      } catch {
        throw new Error("Claude returned malformed JSON.");
      }
      return {
        headlines: toCandidates(parsedClaude.headlines),
        descriptions: toCandidates(parsedClaude.descriptions),
      };
    }
    const reasoning = isReasoningModel(model);
    const response = await openai.chat.completions.create(
      {
        model,
        max_completion_tokens: AD_COPY_MAX_COMPLETION_TOKENS,
        ...(reasoning ? { reasoning_effort: effort } : { temperature: 0.7 }),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AD_COPY_SYSTEM_PROMPT },
          {
            role: "user",
            content: adCopyPrompt({ ...args, extraNotes: [args.extraNotes, extraNotes].filter(Boolean).join("\n") }),
          },
        ],
      },
      // Overrides the client-wide 60s/1-retry policy, which suits the app's
      // short gpt-4o-mini calls but not this one: a retry here would double an
      // already-long wait and blow the route's budget, so fail on the first try.
      { timeout: timeoutMs, maxRetries: 0 }
    );

    const choice = response.choices[0];
    const raw = choice?.message?.content;
    if (!raw) {
      // A reasoning model spends `max_completion_tokens` on its thinking first
      // and only then writes the answer. Exhaust the budget while reasoning and
      // the API returns finish_reason "length" with genuinely empty content —
      // no error, no partial JSON — so surface that rather than a bare "empty
      // response", and fall back to cheaper reasoning so the user still gets an ad.
      const usage = response.usage as (typeof response.usage & {
        completion_tokens_details?: { reasoning_tokens?: number };
      }) | undefined;
      console.error("generate-ad-copy returned no content", {
        model,
        effort,
        finishReason: choice?.finish_reason,
        completionTokens: usage?.completion_tokens,
        reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
        budget: AD_COPY_MAX_COMPLETION_TOKENS,
      });
      if (choice?.finish_reason === "length") {
        // Only worth retrying on a reasoning model, where cheaper thinking
        // leaves more of the budget for the answer.
        if (reasoning && effort !== "low") return requestCandidates(extraNotes, "low");
        throw new Error(
          `${model} used its entire ${AD_COPY_MAX_COMPLETION_TOKENS}-token budget before writing any copy${
            reasoning ? ", even at low reasoning effort" : ""
          }. Raise AD_COPY_MAX_COMPLETION_TOKENS in lib/ai/openai.ts.`
        );
      }
      throw new Error(`${model} returned an empty response (finish reason: ${choice?.finish_reason ?? "unknown"}).`);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("OpenAI returned malformed JSON.");
    }
    return {
      headlines: toCandidates(parsed.headlines),
      descriptions: toCandidates(parsed.descriptions),
    };
  }

  const select = (headlines: AdCandidate[], descriptions: AdCandidate[]) => ({
    headlines: selectAdLines(headlines, {
      maxChars: AD_HEADLINE_MAX_CHARS,
      count: AD_HEADLINE_COUNT,
      slots: headlineSlots,
      storeName: args.storeName,
      maxWithStoreName: AD_MAX_HEADLINES_WITH_STORE_NAME,
      maxWithDiscount: offerSlots,
    }),
    descriptions: selectAdLines(descriptions, {
      maxChars: AD_DESCRIPTION_MAX_CHARS,
      count: AD_DESCRIPTION_COUNT,
      slots: descriptionSlots,
      storeName: args.storeName,
    }),
  });

  const startedAt = Date.now();
  const pool = await requestCandidates();
  let { headlines, descriptions } = select(pool.headlines, pool.descriptions);

  // Only worth a second call if the ad is meaningfully short. Chasing the last
  // headline or two used to double the wait for a marginal gain — and a 13/15
  // ad that renders beats a 15/15 ad the platform killed before it returned.
  const clearlyShort =
    headlines.length < AD_HEADLINE_COUNT - 2 || descriptions.length < AD_DESCRIPTION_COUNT - 1;
  const remainingMs = AD_COPY_TOTAL_BUDGET_MS - (Date.now() - startedAt);

  if (clearlyShort && remainingMs >= AD_COPY_MIN_TOPUP_MS) {
    // Ask for replacements against the pool we already have, then re-select
    // over both sets so the diversity rules apply to the combined candidates
    // rather than letting the top-up bypass them.
    const retry = await requestCandidates(
      `Previous candidates were rejected for exceeding the character limits or for repeating a message another headline already made. Keep every headline clearly under ${AD_HEADLINE_MAX_CHARS} characters and every description under ${AD_DESCRIPTION_MAX_CHARS}. Each new line must make a point none of these already make: ` +
        [...headlines, ...descriptions].join(" | "),
      AD_COPY_REASONING_EFFORT,
      remainingMs
    );
    ({ headlines, descriptions } = select(
      [...pool.headlines, ...retry.headlines],
      [...pool.descriptions, ...retry.descriptions]
    ));
  }

  if (headlines.length === 0 || descriptions.length === 0) {
    throw new Error("The model did not return any usable ad copy. Try again.");
  }

  return { headlines, descriptions };
}

/** Trims text to fit a hard character limit at the last whole word, never mid-word. */
function fitToLimit(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return safe.replace(/[\s,.;:!-]+$/, "").trim();
}

/** Deterministic fallback per page, in case the model omits a field — proven wording, store name swapped in. */
function defaultSiteLink(key: SiteLinkPageKey, storeName: string): GeneratedSiteLink {
  const templates: Record<SiteLinkPageKey, { text: string; description1: string; description2: string }> = {
    "todays-deals": {
      text: `Today's ${storeName} Deals`,
      description1: "Codes tested & updated daily",
      description2: "Don't miss expiring offers",
    },
    "free-shipping-codes": {
      text: "Free Shipping Codes",
      description1: `Skip delivery fees on ${storeName}`,
      description2: "Stack with discount codes",
    },
    "secret-codes": {
      text: "Secret Promo Codes",
      description1: `Hidden ${storeName} deals revealed`,
      description2: "Copy, paste & save instantly",
    },
    "exclusive-deals": {
      text: "All Active Deals",
      description1: "More codes, more savings",
      description2: "Browse every active deal",
    },
    "never-pay-full": {
      text: `Don't Pay Full at ${storeName}`,
      description1: `Working ${storeName} codes every time`,
      description2: "Save more at checkout",
    },
    "exclusive-offers": {
      text: `Exclusive ${storeName} Offers`,
      description1: "Deals you won't find elsewhere",
      description2: "Only on VivaBloom",
    },
  };
  const t = templates[key];
  return {
    text: fitToLimit(t.text, SITE_LINK_TEXT_MAX_CHARS),
    description1: fitToLimit(t.description1, SITE_LINK_DESCRIPTION_MAX_CHARS),
    description2: fitToLimit(t.description2, SITE_LINK_DESCRIPTION_MAX_CHARS),
  };
}

/**
 * Generates Google Ads Sitelink Extension copy (text ≤25 chars, two
 * description lines ≤35 chars each) for all 6 fixed sitelink pages in one
 * call. Any field the model omits or returns over-length falls back to a
 * proven, deterministic default rather than failing the whole request.
 */
export async function generateSiteLinkCopy(
  args: Parameters<typeof siteLinkCopyPrompt>[0],
  model: string = AI_MODELS.text.siteLinkCopy
): Promise<GeneratedSiteLinkCopy> {
  const raw = await jsonCompletion({
    model,
    system: SITE_LINK_SYSTEM_PROMPT,
    user: siteLinkCopyPrompt(args),
    maxTokens: 700,
    temperature: 0.8,
  });
  if (!raw) throw new Error("OpenAI returned an empty response.");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned malformed JSON.");
  }

  const result = {} as GeneratedSiteLinkCopy;
  for (const page of SITE_LINK_PAGES) {
    const entry = parsed[page.key] as Partial<GeneratedSiteLink> | undefined;
    const fallback = defaultSiteLink(page.key, args.storeName);
    result[page.key] = {
      text:
        typeof entry?.text === "string" && entry.text.trim()
          ? fitToLimit(entry.text, SITE_LINK_TEXT_MAX_CHARS)
          : fallback.text,
      description1:
        typeof entry?.description1 === "string" && entry.description1.trim()
          ? fitToLimit(entry.description1, SITE_LINK_DESCRIPTION_MAX_CHARS)
          : fallback.description1,
      description2:
        typeof entry?.description2 === "string" && entry.description2.trim()
          ? fitToLimit(entry.description2, SITE_LINK_DESCRIPTION_MAX_CHARS)
          : fallback.description2,
    };
  }
  return result;
}

/**
 * Generates a batch of high-search-intent blog topic ideas for one store,
 * excluding titles/topics the caller already knows about (published posts and
 * the store's current unused suggestion batch). Returns deduped, trimmed,
 * non-empty strings — never throws for a short/malformed batch, since the
 * caller is happy with fewer topics rather than failing the whole request.
 */
export async function generateBlogTopics(
  args: Parameters<typeof blogTopicsPrompt>[0],
  model: string = AI_MODELS.text.blogTopics
): Promise<GeneratedBlogTopics> {
  const raw = await jsonCompletion({
    model,
    system: BLOG_TOPICS_SYSTEM_PROMPT,
    user: blogTopicsPrompt(args),
    maxTokens: 700,
    temperature: 0.9,
  });
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned malformed JSON.");
  }

  const seen = new Set<string>();
  const topics = Array.isArray(parsed.topics)
    ? parsed.topics
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => {
          if (!t) return false;
          const key = t.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
    : [];

  if (topics.length === 0) {
    throw new Error("The model did not return any usable topics. Try again.");
  }

  return { topics };
}

/**
 * Generates a full, SEO-ready blog article as structured JSON in one call —
 * title, excerpt, HTML body, tags, and meta fields — optionally themed around
 * a specific store. Uses OpenAI's JSON mode so the response parses reliably.
 */
export async function generateArticle(
  topic: string,
  storeName?: string,
  model: string = AI_MODELS.text.article,
  products?: ArticleProduct[],
  /** BLOG_COUNTRIES code — see localRelevanceBlock in ./prompts. Omit for a country-agnostic article. */
  country?: string | null
): Promise<GeneratedArticle> {
  const raw = await jsonCompletion({
    model,
    system: ARTICLE_SYSTEM_PROMPT,
    user: articlePrompt({ topic, storeName, products, country }),
    maxTokens: 1400,
    temperature: 0.7,
  });
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned malformed JSON.");
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    title: str(parsed.title),
    excerpt: str(parsed.excerpt),
    content: str(parsed.content),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => str(t)).filter(Boolean)
      : [],
    seoTitle: str(parsed.seoTitle),
    seoDescription: str(parsed.seoDescription),
  };
}

/**
 * Judges whether an existing category fits a store (by URL/site signal) and
 * always proposes fresh new-category name ideas alongside that judgment. Never
 * throws for a missing match (that's a valid, common outcome) — only for a
 * response with zero usable suggestions, since the caller needs at least
 * those to offer the admin a next step.
 */
export async function generateCategorySuggestions(
  args: Parameters<typeof categorySuggestPrompt>[0],
  model: string = AI_MODELS.text.categorySuggest
): Promise<GeneratedCategorySuggestions> {
  const raw = await jsonCompletion({
    model,
    system: CATEGORY_SUGGEST_SYSTEM_PROMPT,
    user: categorySuggestPrompt(args),
    maxTokens: 500,
    temperature: 0.8,
  });
  if (!raw) throw new Error("OpenAI returned an empty response.");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned malformed JSON.");
  }

  const validSlugs = new Set(args.existingCategories.map((c) => c.slug));
  const matchedCategorySlug =
    typeof parsed.matchedCategorySlug === "string" && validSlugs.has(parsed.matchedCategorySlug)
      ? parsed.matchedCategorySlug
      : null;

  const seen = new Set<string>();
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => {
          if (!s) return false;
          const key = s.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
    : [];

  if (suggestions.length === 0 && !matchedCategorySlug) {
    throw new Error("The model did not return any usable suggestions. Try again.");
  }

  return { matchedCategorySlug, suggestions };
}

/**
 * Generates a category's description + SEO fields as structured JSON — the
 * category-form "Generate All" button.
 */
export async function generateCategoryContent(
  args: Parameters<typeof categoryContentPrompt>[0],
  model: string = AI_MODELS.text.categoryContent
): Promise<GeneratedCategoryContent> {
  const raw = await jsonCompletion({
    model,
    system: CATEGORY_CONTENT_SYSTEM_PROMPT,
    user: categoryContentPrompt(args),
    maxTokens: 400,
    temperature: 0.7,
  });
  if (!raw) throw new Error("OpenAI returned an empty response.");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned malformed JSON.");
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    description: str(parsed.description),
    seoTitle: str(parsed.seoTitle),
    seoDescription: str(parsed.seoDescription),
  };
}
