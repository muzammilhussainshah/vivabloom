import type { PolicyKey } from "@monocoupon/validation";
import type {
  IdentityResult,
  ModelFit,
  PolicyItem,
  ProductsResult,
  ProgramResult,
  ReputationItem,
  ReputationResult,
  RiskLevel,
  ScoreCategory,
  ScoreCriterion,
  ScoreResult,
  Verdict,
} from "./types";

/**
 * Deterministic scoring for the Store Checker. The AI never produces a
 * number here: each criterion awards points only from evidence already
 * stored in the sections, and criteria with no evidence score 0 AND lower
 * the confidence, so "we found nothing" never looks like "everything is fine".
 */

/**
 * How YOU advertise — the rules a program must allow for your setup:
 * a coupon/deals site running Google Search ads on brand + coupon keywords,
 * sending clicks to your own landing page (not direct linking).
 */
export const MY_TRAFFIC_MODEL: { key: PolicyKey; label: string }[] = [
  { key: "coupon_sites", label: "coupon/deal sites" },
  { key: "paid_search", label: "paid search ads" },
  { key: "brand_bidding", label: "bidding on the brand name" },
  { key: "brand_coupon_keywords", label: "brand + coupon keywords" },
  { key: "trademark_in_ads", label: "the brand name in ad text" },
];

const SEVERITY: Record<ReputationItem["kind"], number> = {
  affiliate_unpaid: 30,
  scam_warning: 30,
  affiliate_terminated: 22,
  affiliate_reversal: 15,
  affiliate_delay: 12,
  customer_complaint: 4,
  affiliate_positive: 0,
  customer_positive: 0,
};

const AFFILIATE_PROBLEMS = new Set<ReputationItem["kind"]>(["affiliate_unpaid", "affiliate_terminated", "affiliate_reversal", "affiliate_delay"]);

/** Enough relevant search results to treat "no complaints found" as meaningful. */
const MIN_COVERAGE = 6;

function crit(label: string, points: number, max: number, hasEvidence: boolean, note: string | null = null): ScoreCriterion {
  return { label, points: Math.round(Math.max(0, Math.min(max, points)) * 10) / 10, max, hasEvidence, note };
}

function category(key: string, label: string, criteria: ScoreCriterion[]): ScoreCategory {
  return {
    key,
    label,
    criteria,
    points: Math.round(criteria.reduce((s, c) => s + c.points, 0) * 10) / 10,
    max: criteria.reduce((s, c) => s + c.max, 0),
  };
}

export function evaluateModelFit(policies: PolicyItem[] | null): { status: ModelFit; reasons: string[] } {
  if (!policies) return { status: "unknown", reasons: ["Google Ads rules haven't been checked yet."] };
  const reasons: string[] = [];
  let status: ModelFit = "ok";
  let unknown = 0;
  for (const rule of MY_TRAFFIC_MODEL) {
    const p = policies.find((x) => x.key === rule.key);
    const s = p?.status ?? "unknown";
    if (s === "prohibited") {
      status = "conflict";
      reasons.push(`The program prohibits ${rule.label}.`);
    } else if (s === "restricted" || s === "requires_approval") {
      if (status !== "conflict") status = "check";
      reasons.push(`${rule.label.charAt(0).toUpperCase()}${rule.label.slice(1)} ${s === "restricted" ? "is only allowed with conditions" : "needs written approval first"}.`);
    } else if (s === "unknown") {
      unknown++;
    }
  }
  if (status === "ok" && unknown > 0) {
    status = unknown === MY_TRAFFIC_MODEL.length ? "unknown" : "check";
    reasons.push(
      unknown === MY_TRAFFIC_MODEL.length
        ? "None of the rules that matter for your ads were found publicly — ask the affiliate manager in writing before spending."
        : `${unknown} of the rules that matter for your ads weren't found — confirm them in writing before spending.`
    );
  }
  if (status === "ok") reasons.push("Every rule that matters for your ads is explicitly allowed.");
  return { status, reasons };
}

export function computeScore(input: {
  identity: IdentityResult | null;
  program: ProgramResult | null;
  policies: PolicyItem[] | null;
  reputation: ReputationResult | null;
  products: ProductsResult | null;
}): ScoreResult {
  const { identity: id, program: pg, reputation: rep, policies } = input;
  const positives: string[] = [];
  const negatives: string[] = [];

  /* ---- A. Company & website (25) ---- */
  const age = id?.domainAgeYears ?? null;
  const online = id?.onlineYears ?? null;
  const ageYears = Math.max(age ?? 0, online ?? 0);
  const company = category("company", "Company & website", [
    crit("Domain age", age == null ? 0 : age >= 5 ? 6 : age >= 2 ? 4 : age >= 1 ? 2 : 0, 6, age != null, age != null ? `${age} years` : "Registration date not available"),
    crit("Online history (web archive)", online == null ? 0 : online >= 3 ? 4 : online >= 1 ? 2 : 0, 4, online != null, online != null ? `First archived ${online} years ago` : null),
    crit("Contact email or phone", (id?.contact.emails.length ?? 0) + (id?.contact.phones.length ?? 0) > 0 ? 4 : 0, 4, Boolean(id?.reachable)),
    crit("Business address", id?.contact.address ? 3 : 0, 3, Boolean(id?.reachable)),
    crit("Privacy policy", id?.pages.privacy ? 2 : 0, 2, Boolean(id?.reachable)),
    crit("Terms of service", id?.pages.terms ? 2 : 0, 2, Boolean(id?.reachable)),
    crit("Refund / returns policy", id?.pages.refund ? 2 : 0, 2, Boolean(id?.reachable)),
    crit("Active social profiles", Math.min(2, id?.socials.length ?? 0), 2, Boolean(id?.reachable)),
  ]);
  if (ageYears >= 5) positives.push(`Established: online for ${ageYears}+ years.`);
  else if (age != null && age < 1) negatives.push("Very new domain (registered less than a year ago).");
  if (id?.reachable && !id.contact.address && !id.contact.emails.length && !id.contact.phones.length) negatives.push("No contact details or address found on the site.");
  if (id?.reachable && !id.pages.refund) negatives.push("No refund/returns policy page found — refund-driven commission reversals are harder to judge.");

  /* ---- B. Affiliate program (25) ---- */
  const evid = (status: string | undefined) => status === "verified" || status === "unverified";
  const found = pg?.found === "yes";
  const inactive = pg?.active === "no";
  const commissionPts = pg?.commission.status === "verified" ? 5 : pg?.commission.status === "unverified" ? 2 : 0;
  const program = category("program", "Affiliate program", [
    crit("Program exists and is open", found && !inactive ? 7 : 0, 7, Boolean(pg) && pg?.found !== "unclear", inactive ? "Program appears closed / not active" : null),
    crit("Commission stated", commissionPts, 5, evid(pg?.commission.status), pg?.commission.value ?? null),
    crit("Cookie duration stated", pg?.cookieDays.status === "verified" ? 3 : pg?.cookieDays.status === "unverified" ? 1 : 0, 3, evid(pg?.cookieDays.status)),
    crit("Payout terms stated", pg?.payoutSchedule.status === "verified" || pg?.payoutThreshold.status === "verified" ? 4 : evid(pg?.payoutSchedule.status) || evid(pg?.payoutThreshold.status) ? 2 : 0, 4, evid(pg?.payoutSchedule.status) || evid(pg?.payoutThreshold.status)),
    crit("Network identified", pg?.network.status === "verified" || (pg?.detectedNetworks.length ?? 0) > 0 ? 3 : 0, 3, Boolean(pg)),
    crit("Application link found", pg?.applicationUrl ? 3 : 0, 3, Boolean(pg)),
  ]);
  if (pg) {
    if (inactive) negatives.push("The store's own pages say the affiliate program is not active.");
    else if (found) positives.push(`Affiliate program found${pg.network.value ? ` (${pg.network.value})` : pg.detectedNetworks[0] ? ` (${pg.detectedNetworks[0]})` : ""}.`);
    else if (pg.found === "no") negatives.push("No affiliate program found for this store.");
    if (pg.commission.status === "verified") positives.push(`Commission: ${pg.commission.value}.`);
  }

  /* ---- C. Payment reliability (30) ---- */
  const items = rep?.items ?? [];
  const coverage = rep?.coverage ?? 0;
  const affiliateProblems = items.filter((i) => AFFILIATE_PROBLEMS.has(i.kind));
  const credibleProblems = affiliateProblems.filter((i) => i.weight >= 0.15);
  const problemWeight = credibleProblems.reduce((s, i) => s + i.weight * SEVERITY[i.kind], 0);
  const paidEvidence = items.filter((i) => i.kind === "affiliate_positive");
  const noProblemsPts = !rep ? 0 : credibleProblems.length > 0 ? Math.max(0, 12 - problemWeight / 2) : coverage >= MIN_COVERAGE ? 12 : 4;
  const payment = category("payment", "Payment reliability", [
    crit(
      "No credible unpaid / termination reports",
      noProblemsPts,
      12,
      Boolean(rep) && (credibleProblems.length > 0 || coverage >= MIN_COVERAGE),
      !rep ? null : credibleProblems.length ? `${credibleProblems.length} report(s) found` : coverage < MIN_COVERAGE ? "Too little public discussion to judge" : "None found"
    ),
    crit("Affiliates report being paid", Math.min(6, paidEvidence.length * 3), 6, paidEvidence.length > 0),
    crit("Payout schedule stated", pg?.payoutSchedule.status === "verified" ? 6 : pg?.payoutSchedule.status === "unverified" ? 2 : 0, 6, evid(pg?.payoutSchedule.status)),
    crit("Commission approval period stated", pg?.validationPeriod.status === "verified" ? 6 : pg?.validationPeriod.status === "unverified" ? 2 : 0, 6, evid(pg?.validationPeriod.status)),
  ]);
  for (const kind of ["affiliate_unpaid", "affiliate_terminated", "affiliate_reversal", "affiliate_delay"] as const) {
    const n = credibleProblems.filter((i) => i.kind === kind).length;
    if (!n) continue;
    const label = { affiliate_unpaid: "unpaid commissions", affiliate_terminated: "affiliate accounts being terminated", affiliate_reversal: "commissions being reversed", affiliate_delay: "late affiliate payments" }[kind];
    negatives.push(`${n} public report${n > 1 ? "s" : ""} of ${label}.`);
  }
  if (paidEvidence.length) positives.push(`${paidEvidence.length} source(s) say affiliates do get paid.`);
  if (rep && coverage < MIN_COVERAGE) negatives.push("Very little public discussion about this store — reputation can't be confirmed either way.");

  /* ---- D. Reputation (20) ---- */
  const rating = rep?.customerRating;
  const rating5 = rating ? (rating.value / rating.scale) * 5 : null;
  const scams = items.filter((i) => i.kind === "scam_warning" && i.weight >= 0.15);
  const customerComplaints = items.filter((i) => i.kind === "customer_complaint");
  const reputation = category("reputation", "Customer reputation", [
    crit(
      "Customer rating",
      rating5 == null ? 0 : rating5 >= 4.2 && (rating?.count ?? 0) >= 50 ? 10 : rating5 >= 4 ? 8 : rating5 >= 3.5 ? 5 : 0,
      10,
      rating5 != null,
      rating ? `${rating.value}/${rating.scale}${rating.count ? ` from ${rating.count.toLocaleString()} reviews` : ""}${rating.platform ? ` on ${rating.platform}` : ""}` : null
    ),
    crit("No scam warnings", !rep ? 0 : scams.length ? 0 : coverage >= MIN_COVERAGE ? 6 : 2, 6, Boolean(rep) && (scams.length > 0 || coverage >= MIN_COVERAGE)),
    crit("Few customer complaints", !rep ? 0 : Math.max(0, 4 - customerComplaints.length), 4, Boolean(rep) && coverage >= MIN_COVERAGE),
  ]);
  if (rating5 != null && rating5 >= 4) positives.push(`Customers rate it ${rating?.value}/${rating?.scale}${rating?.platform ? ` on ${rating.platform}` : ""}.`);
  if (rating5 != null && rating5 < 3.5) negatives.push(`Low customer rating: ${rating?.value}/${rating?.scale}${rating?.platform ? ` on ${rating.platform}` : ""}.`);
  if (scams.length) negatives.push(`${scams.length} source(s) call it a scam — read them before deciding.`);

  const categories = [company, program, payment, reputation];
  const trust = Math.round(categories.reduce((s, c) => s + c.points, 0));
  const evidenced = categories.flatMap((c) => c.criteria).filter((c) => c.hasEvidence).reduce((s, c) => s + c.max, 0);
  const confidence = Math.round((evidenced / 100) * 100) / 100;

  /* ---- Risk (0–100, separate from trust) ---- */
  // Max two items per website so one forum thread can't dominate.
  const perDomain = new Map<string, number>();
  let risk = 0;
  for (const item of [...items].sort((a, b) => b.weight - a.weight)) {
    const host = new URL(item.url).hostname;
    const n = perDomain.get(host) ?? 0;
    if (n >= 2) continue;
    perDomain.set(host, n + 1);
    risk += SEVERITY[item.kind] * item.weight;
  }
  if (age != null && age < 1) risk += 15;
  if (id?.reachable && !id.contact.emails.length && !id.contact.phones.length && !id.contact.address) risk += 8;
  risk = Math.min(100, Math.round(risk));

  const strongAffiliateEvidence = credibleProblems.filter((i) => i.kind === "affiliate_unpaid" || i.kind === "affiliate_terminated").length >= 2;
  let riskLevel: RiskLevel = risk >= 50 || strongAffiliateEvidence ? "high" : risk >= 25 ? "medium" : "low";
  if (riskLevel === "low" && confidence < 0.35) riskLevel = "insufficient";

  const modelFit = evaluateModelFit(policies);
  if (modelFit.status === "conflict") negatives.unshift(...modelFit.reasons.map((r) => `Your ads: ${r}`));

  let verdict: Verdict;
  if (confidence < 0.35 && riskLevel !== "high") verdict = "insufficient";
  else if (riskLevel === "high" || trust < 40) verdict = "risky";
  else if (riskLevel === "medium" || trust < 65 || modelFit.status === "conflict" || inactive || pg?.found === "no") verdict = "caution";
  else verdict = "good";

  const result: ScoreResult = { trust, risk, riskLevel, confidence, verdict, categories, positives: positives.slice(0, 6), negatives: negatives.slice(0, 8), modelFit };
  result.bottomLine = bottomLine(result, pg);
  return result;
}

export interface BottomLine {
  tone: "good" | "warn" | "bad" | "muted";
  title: string;
  detail: string;
}

/**
 * The one-sentence answer at the top of a report: should you spend money
 * promoting this store with YOUR ads? Combines store trust with the ad-rule
 * fit, because a trustworthy store whose terms ban your traffic is still a
 * "no" for you.
 */
export function bottomLine(score: ScoreResult, program: ProgramResult | null): BottomLine {
  const firstNegative = score.negatives.find((n) => !n.startsWith("Your ads:"));
  if (score.verdict === "risky") {
    return { tone: "bad", title: "Avoid for now", detail: firstNegative ?? "There are credible problems or too many trust gaps to risk ad spend." };
  }
  if (score.modelFit.status === "conflict") {
    return {
      tone: "bad",
      title: "Don't run your coupon ads for this store",
      detail: `Its own affiliate terms ban how you advertise — ${score.modelFit.reasons[0]?.replace(/^The program /, "the program ").replace(/\.$/, "") ?? "see the rules below"}. Doing it anyway risks a ban and unpaid commissions.`,
    };
  }
  if (program && (program.active === "no" || program.found === "no")) {
    return { tone: "warn", title: "No open affiliate program found", detail: program.active === "no" ? "The store's own pages say the program is not active." : "We couldn't find an affiliate program for this store." };
  }
  if (score.verdict === "insufficient") {
    return { tone: "muted", title: "Not enough public information", detail: "Ask the affiliate manager for the terms in writing (paste them below to analyse them) before spending." };
  }
  if (score.verdict === "good" && score.modelFit.status === "ok") {
    return { tone: "good", title: "Good candidate — you can promote it", detail: "Trustworthy store, and its terms explicitly allow how you advertise." };
  }
  if (score.verdict === "good") {
    return {
      tone: "warn",
      title: "Trustworthy store — confirm the ad rules first",
      detail: "The store looks solid, but its rules for coupon sites and brand keywords aren't public. Get written approval from the affiliate manager before spending.",
    };
  }
  return { tone: "warn", title: "Possible, but proceed with care", detail: firstNegative ?? "Some important details are missing or unclear." };
}
