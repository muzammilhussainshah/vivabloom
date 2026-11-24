import { POLICY_KEYS, programExtractionSchema, type PolicyKey, type ProgramExtraction } from "@monocoupon/validation";
import { STORE_PROGRAM_SYSTEM_PROMPT, storeProgramPrompt } from "@/lib/ai/prompts";
import { llmJson } from "./llm";
import { tavilyExtract, tavilySearchAll, type TavilyResult } from "./tavily";
import { brandMatchers, compact, domainOfUrl, mentionsBrand, networkForUrl } from "./domain";
import { focusTermsText, locateQuote, toEvidenceField, type SourceText } from "./evidence";
import type { EvidenceField, IdentityResult, LinkSignals, PolicyItem, ProgramResult, SourceRef, StepUsage } from "./types";

/**
 * Step 2 — does the store run an affiliate program, on what terms, and what
 * does it allow affiliates to do with Google Ads? Finds the program pages
 * (site links + web search), reads them, and has the AI extract the terms
 * with a verbatim quote for every value. Quotes are verified in code.
 */

const MAX_SOURCES = 6;
/** ~4.5k tokens of source text: keeps one call inside Groq's free 8k tokens/minute. */
const SOURCE_CHAR_BUDGET = 17_000;
const AFFILIATE_URL_RE = /affiliat|ambassador|partner|creator|influencer|refer|collab|program|terms/i;

export async function runProgramStep(args: {
  domain: string;
  name: string;
  identity: IdentityResult | null;
  linkSignals: LinkSignals | null;
  deadline: number;
}): Promise<{ program: ProgramResult; policies: PolicyItem[]; sources: SourceRef[]; usage: StepUsage }> {
  const { domain, name, identity, linkSignals } = args;
  const matchers = brandMatchers(name, domain);
  const usage: StepUsage = { tavilyCredits: 0, llmInputTokens: 0, llmOutputTokens: 0 };
  const now = new Date().toISOString();

  // 1. Search the web for the program and its PPC rules.
  const queries = [`"${name}" affiliate program`, `${domain} affiliate program terms PPC paid search brand keywords coupon sites`];
  const searched = await tavilySearchAll(queries, { maxResults: 8 });
  usage.tavilyCredits += searched.credits;

  const relevant = new Map<string, TavilyResult>();
  for (const result of searched.results.flat()) {
    const resultDomain = domainOfUrl(result.url);
    const onSite = resultDomain === domain;
    const aboutBrand = mentionsBrand(`${result.title}\n${result.content}\n${result.url}`, matchers);
    if ((onSite || aboutBrand) && !relevant.has(result.url)) relevant.set(result.url, result);
  }

  // 2. Pick the pages worth reading in full: the site's own affiliate pages, network signup pages, then the best search hits.
  const toRead: string[] = [];
  const add = (url: string | null | undefined) => {
    if (url && !toRead.includes(url) && toRead.length < MAX_SOURCES - 1) toRead.push(url);
  };
  identity?.pages.affiliate.forEach(add);
  identity?.affiliateLinks.forEach((l) => add(l.url));
  [...relevant.values()]
    .filter((r) => AFFILIATE_URL_RE.test(r.url) || AFFILIATE_URL_RE.test(r.title))
    .sort((a, b) => Number(domainOfUrl(b.url) === domain) - Number(domainOfUrl(a.url) === domain) || b.score - a.score)
    .forEach((r) => add(r.url));

  let extracted: { url: string; text: string }[] = [];
  if (toRead.length > 0) {
    try {
      const res = await tavilyExtract(toRead);
      usage.tavilyCredits += res.credits;
      extracted = res.results;
    } catch {
      extracted = [];
    }
  }

  // 3. Assemble numbered sources: full pages (trimmed to the terms paragraphs) first, then search snippets.
  const sources: SourceText[] = [];
  const fullTexts: SourceText[] = [];
  // Only pages from the store itself, a network, or that name the store; the store's own pages first.
  const pages = extracted
    .filter((p) => domainOfUrl(p.url) === domain || networkForUrl(p.url) || mentionsBrand(p.text.slice(0, 20_000), matchers))
    .sort((a, b) => Number(domainOfUrl(b.url) === domain) - Number(domainOfUrl(a.url) === domain));
  const perPage = Math.floor((SOURCE_CHAR_BUDGET * 0.8) / Math.max(1, pages.length));
  for (const page of pages) {
    fullTexts.push(page);
    sources.push({ url: page.url, text: focusTermsText(page.text, Math.max(2000, perPage)) });
  }
  let snippetBudget = SOURCE_CHAR_BUDGET - sources.reduce((s, x) => s + x.text.length, 0);
  for (const r of relevant.values()) {
    if (extracted.some((e) => e.url === r.url)) continue;
    const text = `${r.title}\n${r.content}`.slice(0, 1200);
    if (snippetBudget - text.length < 0 || sources.length >= 12) break;
    snippetBudget -= text.length;
    sources.push({ url: r.url, text });
    fullTexts.push({ url: r.url, text });
  }

  const signals = [
    ...(linkSignals?.networks.map((n) => `${n.network} (${n.evidence})`) ?? []),
    ...(identity?.affiliateLinks.map((l) => `Store site links to ${l.network}: ${l.url}`) ?? []),
    ...(identity?.pages.affiliate.map((u) => `Store site has an affiliate/partner page: ${u}`) ?? []),
  ];
  const detectedNetworks = [
    ...new Set([
      ...(linkSignals?.networks.map((n) => n.network) ?? []),
      ...(identity?.affiliateLinks.map((l) => l.network) ?? []),
      ...[...relevant.values()].map((r) => networkForUrl(r.url)).filter((n): n is string => Boolean(n)),
    ]),
  ];

  const sourceRefs: SourceRef[] = sources.map((s) => ({
    url: s.url,
    title: relevant.get(s.url)?.title || s.url,
    kind: networkForUrl(s.url) ? "network" : domainOfUrl(s.url) === domain ? "affiliate_page" : "search_result",
    fetchedAt: now,
  }));

  if (sources.length === 0) {
    return { program: emptyProgram(detectedNetworks, toRead), policies: unknownPolicies(), sources: sourceRefs, usage };
  }

  // 4. Extract with the AI, then verify every quote against the full source text.
  const llm = await llmJson({
    task: "storeProgram",
    system: STORE_PROGRAM_SYSTEM_PROMPT,
    user: storeProgramPrompt({ name, domain, signals, sources }),
    schema: programExtractionSchema,
    maxOutputTokens: 1800,
    deadline: args.deadline,
  });
  usage.llmInputTokens += llm.inputTokens;
  usage.llmOutputTokens += llm.outputTokens;

  // Quotes are checked against the full page (the AI saw a trimmed window of it, so a true quote is always inside).
  const verifyAgainst: SourceText[] = sources.map((s) => fullTexts.find((f) => f.url === s.url) ?? s);
  return {
    program: buildProgram(llm.data, verifyAgainst, detectedNetworks, toRead),
    policies: buildPolicies(llm.data, verifyAgainst),
    sources: sourceRefs,
    usage,
  };
}

function emptyProgram(detectedNetworks: string[], checkedUrls: string[]): ProgramResult {
  const unknown = { value: null, status: "unknown" as const, quote: null, sourceUrl: null };
  return {
    found: detectedNetworks.length ? "unclear" : "no",
    active: "unclear",
    network: detectedNetworks[0] ? { value: detectedNetworks[0], status: "unverified", quote: null, sourceUrl: null } : unknown,
    detectedNetworks,
    applicationUrl: null,
    commission: { ...unknown, type: "unknown", rateMin: null, rateMax: null, fixedAmount: null },
    cookieDays: unknown,
    payoutThreshold: unknown,
    payoutSchedule: unknown,
    paymentMethods: unknown,
    validationPeriod: unknown,
    approvalRequirements: unknown,
    notes: [],
    checkedUrls,
  };
}

export function buildProgram(data: ProgramExtraction, sources: SourceText[], detectedNetworks: string[], checkedUrls: string[]): ProgramResult {
  const field = (f: { value: string | null; quote: string | null; source: number | null } | null) =>
    toEvidenceField(f?.value ?? null, f?.quote, f?.source, sources);

  // A quote must be in the source AND actually say the thing: the network's name, the rate's number, the cookie's days.
  const requireInQuote = <T,>(f: EvidenceField<T>, mustContain: (quote: string) => boolean): EvidenceField<T> =>
    f.status === "verified" && !mustContain(f.quote ?? "") ? { ...f, status: "unverified" } : f;
  const numbersIn = (q: string) => q.match(/\d+(?:\.\d+)?/g) ?? [];

  const commissionField = requireInQuote(
    toEvidenceField(data.commission?.value ?? null, data.commission?.quote, data.commission?.source, sources),
    (q) => {
      const nums = [data.commission?.rateMin, data.commission?.rateMax, data.commission?.fixedAmount].filter((n): n is number => n != null);
      return numbersIn(q).length > 0 && (nums.length === 0 || nums.some((n) => numbersIn(q).some((x) => Number(x) === n)));
    }
  );
  const commissionTrusted = commissionField.status === "verified";
  const networkWord = compact(data.network?.value?.replace(/\(.*?\)/g, "") ?? "").slice(0, 6);
  const networkField = requireInQuote(field(data.network), (q) => networkWord.length >= 3 && compact(q).includes(networkWord));
  const cookieField = requireInQuote(
    toEvidenceField(data.cookieDays?.value ?? null, data.cookieDays?.quote, data.cookieDays?.source, sources),
    (q) => numbersIn(q).some((x) => Number(x) === data.cookieDays?.value)
  );
  let applicationUrl = data.applicationUrl && /^https?:\/\//i.test(data.applicationUrl) ? data.applicationUrl : null;
  // Only keep an application URL the sources actually contain (or that is one of the pages we read).
  if (applicationUrl && !sources.some((s) => s.url === applicationUrl || s.text.includes(applicationUrl as string))) applicationUrl = null;

  return {
    found: data.programFound,
    active: data.programActive,
    network: networkField,
    detectedNetworks,
    applicationUrl,
    commission: {
      ...commissionField,
      type: data.commission?.type ?? "unknown",
      // Numeric rates are only trusted when the commission quote itself verified.
      rateMin: commissionTrusted ? (data.commission?.rateMin ?? null) : null,
      rateMax: commissionTrusted ? (data.commission?.rateMax ?? data.commission?.rateMin ?? null) : null,
      fixedAmount: commissionTrusted ? (data.commission?.fixedAmount ?? null) : null,
    },
    cookieDays: cookieField,
    payoutThreshold: field(data.payoutThreshold),
    payoutSchedule: field(data.payoutSchedule),
    paymentMethods: field(data.paymentMethods),
    validationPeriod: field(data.validationPeriod),
    approvalRequirements: field(data.approvalRequirements),
    notes: data.notes.slice(0, 4),
    checkedUrls,
  };
}

function unknownPolicies(): PolicyItem[] {
  return POLICY_KEYS.map((key) => ({ key, status: "unknown", quote: null, sourceUrl: null, explanation: "Not found in any source.", unverifiedClaim: null }));
}

/**
 * A rule only keeps a non-unknown status when its quote is found in a source;
 * it's never defaulted to "allowed". Then two strictly logical implications
 * are applied (only ever towards "prohibited", carrying the same quote):
 * no paid search at all ⇒ no brand bidding ⇒ no brand + coupon keywords.
 */
export function buildPolicies(data: ProgramExtraction, sources: SourceText[]): PolicyItem[] {
  const items = verifyPolicies(data, sources);
  const get = (k: PolicyKey) => items.find((p) => p.key === k) as PolicyItem;
  const imply = (from: PolicyKey, to: PolicyKey, why: string) => {
    const a = get(from);
    const b = get(to);
    if (a.status === "prohibited" && b.status === "unknown") {
      Object.assign(b, { status: "prohibited", quote: a.quote, sourceUrl: a.sourceUrl, explanation: why, unverifiedClaim: null });
    }
  };
  imply("paid_search", "brand_bidding", "All paid search is prohibited, so bidding on the brand is too.");
  imply("brand_bidding", "brand_coupon_keywords", "Bidding on the brand is prohibited, and brand + coupon keywords contain the brand.");
  imply("paid_search", "brand_coupon_keywords", "All paid search is prohibited, so brand + coupon keywords are too.");
  return items;
}

function verifyPolicies(data: ProgramExtraction, sources: SourceText[]): PolicyItem[] {
  return POLICY_KEYS.map((key: PolicyKey) => {
    const item = data.policies.find((p) => p.key === key);
    if (!item || item.status === "unknown") {
      return { key, status: "unknown", quote: null, sourceUrl: null, explanation: item?.explanation || "Not addressed in the sources found.", unverifiedClaim: null };
    }
    const found = locateQuote(item.quote, sources, item.source);
    if (!found) {
      return {
        key,
        status: "unknown",
        quote: item.quote,
        sourceUrl: null,
        explanation: "The AI suggested a rule but its quote could not be matched in the source, so it is not trusted.",
        unverifiedClaim: item.status,
      };
    }
    return { key, status: item.status, quote: item.quote, sourceUrl: found.url, explanation: item.explanation, unverifiedClaim: null };
  });
}
