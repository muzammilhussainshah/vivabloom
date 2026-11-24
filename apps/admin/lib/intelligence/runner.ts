import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { STORE_CHECK_STEPS, type StoreCheckStep } from "@monocoupon/validation";
import { analyzeLink, brandMatchers, domainOfUrl, isLikelyStoreDomain, mentionsBrand, nameFromDomain, parseStoreInput } from "./domain";
import { tavilySearch } from "./tavily";
import { runIdentityStep } from "./identity";
import { analyzePastedTerms, mergePastedTerms, runProgramStep } from "./program";
import { runReputationStep } from "./reputation";
import { runProductsStep } from "./products";
import { computeScore } from "./score";
import type { IdentityResult, LinkSignals, PolicyItem, ProductsResult, ProgramResult, ReputationResult, SourceRef, StepUsage, StoreCheckView } from "./types";

/**
 * Orchestrates a Store Check. Each step is its own short request (the admin
 * page calls them one after another), so every step fits a serverless time
 * limit, and a failing step leaves the others' saved results intact.
 */

/** A finished report younger than this is reused instead of spending credits again (unless the admin forces a re-check). */
const FRESH_MS = 14 * 24 * 60 * 60 * 1000;
/** Each step must finish well inside the route's maxDuration (60s). */
const STEP_BUDGET_MS = 55_000;

export class UserFacingError extends Error {}

async function resolveDomainFromName(name: string): Promise<{ domain: string; credits: number }> {
  const { results, credits } = await tavilySearch(`${name} official website online store`, { maxResults: 8 });
  const matchers = brandMatchers(name, "");
  const ranked = results
    .map((r) => ({ r, domain: domainOfUrl(r.url) }))
    .filter((x): x is { r: (typeof results)[number]; domain: string } => Boolean(x.domain) && isLikelyStoreDomain(x.domain as string));
  // Prefer a domain that contains the brand name itself ("kittyspout.com" for "Kitty Spout").
  const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const best =
    ranked.find((x) => nameKey.includes(x.domain.split(".")[0] ?? "~") || (x.domain.split(".")[0] ?? "").includes(nameKey)) ??
    ranked.find((x) => mentionsBrand(`${x.r.title} ${x.r.content}`, matchers));
  if (!best) throw new UserFacingError(`Couldn't find an official website for "${name}". Paste the store's link instead.`);
  return { domain: best.domain, credits };
}

/** Creates (or reuses) the StoreCheck for whatever the admin pasted. */
export async function startStoreCheck(opts: { query: string; country?: string | null; force?: boolean; userId?: string | null }): Promise<{ id: string; reused: boolean }> {
  const input = parseStoreInput(opts.query);
  let domain: string;
  let inputUrl: string | null = null;
  let linkSignals: LinkSignals | null = null;
  let name: string | null = null;
  let credits = 0;

  if (input.kind === "url") {
    domain = input.domain;
    inputUrl = input.url.toString();
    linkSignals = analyzeLink(input.url);
  } else {
    const resolved = await resolveDomainFromName(input.name);
    domain = resolved.domain;
    credits = resolved.credits;
    name = input.name;
  }
  if (!isLikelyStoreDomain(domain)) throw new UserFacingError(`${domain} is a marketplace, network or publisher, not a store's own website.`);

  await connectToDatabase();
  const existing = await StoreCheck.findOne({ domain }).lean();
  const allDone = existing && STORE_CHECK_STEPS.every((s) => existing.steps?.[s]?.status === "done");
  const fresh = existing?.lastCheckedAt && Date.now() - new Date(existing.lastCheckedAt).getTime() < FRESH_MS;

  if (existing && allDone && fresh && !opts.force) {
    // Keep any newly pasted link's signals (e.g. a network parameter) without re-running anything.
    if (linkSignals?.networks.length) await StoreCheck.updateOne({ _id: existing._id }, { $set: { linkSignals, inputUrl } });
    return { id: String(existing._id), reused: true };
  }

  const pendingSteps = Object.fromEntries(STORE_CHECK_STEPS.map((s) => [s, { status: "pending", error: null, updatedAt: new Date() }]));
  const doc = await StoreCheck.findOneAndUpdate(
    { domain },
    {
      $set: {
        steps: pendingSteps,
        ...(inputUrl ? { inputUrl, linkSignals } : {}),
        ...(name && !existing?.name ? { name } : {}),
        ...(opts.country ? { targetCountry: opts.country } : {}),
      },
      $setOnInsert: { domain, createdBy: opts.userId ?? null },
      $inc: { "usage.tavilyCredits": credits },
    },
    { upsert: true, new: true }
  );
  return { id: String(doc._id), reused: false };
}

function mergeSources(existing: SourceRef[], incoming: SourceRef[]): SourceRef[] {
  const byUrl = new Map(existing.map((s) => [s.url, s]));
  for (const s of incoming) byUrl.set(s.url, s);
  return [...byUrl.values()].slice(-80);
}

export async function runStoreCheckStep(id: string, step: StoreCheckStep): Promise<{ status: "done" | "failed"; error: string | null }> {
  await connectToDatabase();
  const doc = await StoreCheck.findById(id).lean();
  if (!doc) throw new UserFacingError("Store check not found.");

  await StoreCheck.updateOne({ _id: doc._id }, { $set: { [`steps.${step}`]: { status: "running", error: null, updatedAt: new Date() } } });
  const deadline = Date.now() + STEP_BUDGET_MS;
  const identity = doc.identity as IdentityResult | null;
  const name = identity?.name ?? doc.name ?? nameFromDomain(doc.domain);

  try {
    let set: Record<string, unknown> = {};
    let usage: StepUsage;
    let sources: SourceRef[] = [];

    if (step === "identity") {
      const r = await runIdentityStep({ domain: doc.domain, startUrl: (doc.linkSignals as LinkSignals | null)?.cleanUrl ?? null, fallbackName: doc.name ?? null, targetCountry: doc.targetCountry });
      set = { identity: r.identity, name: doc.name ?? r.identity.name };
      usage = r.usage;
      sources = r.sources;
    } else if (step === "program") {
      const r = await runProgramStep({ domain: doc.domain, name, identity, linkSignals: doc.linkSignals as LinkSignals | null, deadline });
      const pasted = doc.pastedTerms as PastedTerms | null;
      // Terms the admin pasted earlier stay applied when the public research is refreshed.
      set = pasted?.program ? mergePastedTerms(r.program, r.policies, pasted) : { program: r.program, policies: r.policies };
      usage = r.usage;
      sources = r.sources;
    } else if (step === "reputation") {
      const r = await runReputationStep({ domain: doc.domain, name, deadline });
      set = { reputation: r.reputation };
      usage = r.usage;
      sources = r.sources;
    } else {
      const r = await runProductsStep({
        domain: doc.domain,
        name,
        identity,
        program: doc.program as ProgramResult | null,
        policies: doc.policies as PolicyItem[] | null,
        targetCountry: doc.targetCountry ?? null,
        deadline,
      });
      set = { products: r.products };
      usage = r.usage;
      sources = r.sources;
    }

    const merged = { ...doc, ...set } as typeof doc & Record<string, unknown>;
    const score = computeScore({
      identity: merged.identity as IdentityResult | null,
      program: merged.program as ProgramResult | null,
      policies: merged.policies as PolicyItem[] | null,
      reputation: merged.reputation as ReputationResult | null,
      products: merged.products as ProductsResult | null,
    });

    await StoreCheck.updateOne(
      { _id: doc._id },
      {
        $set: {
          ...set,
          score,
          sources: mergeSources((doc.sources as SourceRef[] | null) ?? [], sources),
          lastCheckedAt: new Date(),
          [`steps.${step}`]: { status: "done", error: null, updatedAt: new Date() },
        },
        $inc: { "usage.tavilyCredits": usage.tavilyCredits, "usage.llmInputTokens": usage.llmInputTokens, "usage.llmOutputTokens": usage.llmOutputTokens },
      }
    );
    return { status: "done", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Step failed";
    console.error(`store-check ${step} failed for ${doc.domain}`, err);
    await StoreCheck.updateOne({ _id: doc._id }, { $set: { [`steps.${step}`]: { status: "failed", error: message.slice(0, 500), updatedAt: new Date() } } });
    return { status: "failed", error: message };
  }
}

interface PastedTerms {
  text: string;
  addedAt: string;
  program: ProgramResult;
  policies: PolicyItem[];
}

/** Analyses pasted program terms, stores them, merges them into the report and re-scores. */
export async function applyPastedTerms(id: string, text: string): Promise<void> {
  await connectToDatabase();
  const doc = await StoreCheck.findById(id).lean();
  if (!doc) throw new UserFacingError("Store check not found.");
  const identity = doc.identity as IdentityResult | null;
  const name = identity?.name ?? doc.name ?? nameFromDomain(doc.domain);
  const analysed = await analyzePastedTerms({ domain: doc.domain, name, text, deadline: Date.now() + STEP_BUDGET_MS });
  const pasted: PastedTerms = { text: text.slice(0, 80_000), addedAt: new Date().toISOString(), program: analysed.program, policies: analysed.policies };
  const merged = mergePastedTerms(doc.program as ProgramResult | null, doc.policies as PolicyItem[] | null, pasted);
  const score = computeScore({
    identity,
    program: merged.program,
    policies: merged.policies,
    reputation: doc.reputation as ReputationResult | null,
    products: doc.products as ProductsResult | null,
  });
  await StoreCheck.updateOne(
    { _id: doc._id },
    {
      $set: { pastedTerms: pasted, program: merged.program, policies: merged.policies, score },
      $inc: { "usage.llmInputTokens": analysed.usage.llmInputTokens, "usage.llmOutputTokens": analysed.usage.llmOutputTokens },
    }
  );
}

/** Plain, serialisable view of a StoreCheck for server/client components. */
export function toView(doc: Record<string, unknown>): StoreCheckView {
  const plain = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  const steps = (plain.steps ?? {}) as StoreCheckView["steps"];
  for (const s of STORE_CHECK_STEPS) steps[s] = steps[s] ?? { status: "pending", error: null, updatedAt: null };
  return {
    id: String(plain._id),
    domain: String(plain.domain),
    name: (plain.name as string | null) ?? null,
    inputUrl: (plain.inputUrl as string | null) ?? null,
    targetCountry: (plain.targetCountry as string | null) ?? null,
    steps,
    linkSignals: (plain.linkSignals as LinkSignals | null) ?? null,
    identity: (plain.identity as IdentityResult | null) ?? null,
    program: (plain.program as ProgramResult | null) ?? null,
    policies: (plain.policies as PolicyItem[] | null) ?? null,
    reputation: (plain.reputation as ReputationResult | null) ?? null,
    products: (plain.products as ProductsResult | null) ?? null,
    score: (plain.score as StoreCheckView["score"]) ?? null,
    sources: (plain.sources as SourceRef[] | null) ?? [],
    usage: (plain.usage as StoreCheckView["usage"]) ?? { tavilyCredits: 0, llmInputTokens: 0, llmOutputTokens: 0 },
    lastCheckedAt: (plain.lastCheckedAt as string | null) ?? null,
    pastedTermsAt: ((plain.pastedTerms as { addedAt?: string } | null)?.addedAt as string | undefined) ?? null,
  };
}
