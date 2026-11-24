import type { PolicyKey, PolicyStatus, ReputationKind, StoreCheckStep } from "@monocoupon/validation";

/**
 * Shapes of the Mixed sections stored on StoreCheck (packages/db). Dates are
 * ISO strings so a section can be passed straight to client components.
 */

/**
 * verified   = the AI's claim was matched word-for-word in the cited source.
 * unverified = a value was found but its quote couldn't be matched — shown with a warning.
 * unknown    = nothing found. Never guessed.
 */
export type FieldStatus = "verified" | "unverified" | "unknown";

export interface EvidenceField<T> {
  value: T | null;
  status: FieldStatus;
  quote: string | null;
  sourceUrl: string | null;
}

export type SourceKind = "store_site" | "affiliate_page" | "network" | "search_result" | "review" | "registry" | "archive";

export interface SourceRef {
  url: string;
  title: string;
  kind: SourceKind;
  fetchedAt: string;
}

export interface NetworkSignal {
  network: string;
  evidence: string;
}

export interface LinkSignals {
  cleanUrl: string;
  networks: NetworkSignal[];
  fromGoogleAds: boolean;
}

export interface IdentityResult {
  name: string;
  title: string | null;
  description: string | null;
  logo: string | null;
  homepageUrl: string;
  reachable: boolean;
  /** Our own fetcher was refused (robots.txt or the site blocking bots) — data came from a web-extract fallback instead. */
  fetchedVia: "direct" | "extract" | "none";
  https: boolean;
  platform: "shopify" | null;
  currency: string | null;
  domainCreatedAt: string | null;
  domainAgeYears: number | null;
  registrar: string | null;
  waybackFirstSeen: string | null;
  onlineYears: number | null;
  legalName: string | null;
  pages: {
    privacy: string | null;
    terms: string | null;
    refund: string | null;
    shipping: string | null;
    contact: string | null;
    about: string | null;
    affiliate: string[];
  };
  contact: { emails: string[]; phones: string[]; address: string | null };
  socials: { platform: string; url: string }[];
  /** Links on the site that point at an affiliate network / platform signup page. */
  affiliateLinks: { url: string; network: string }[];
}

export interface ProgramResult {
  found: "yes" | "no" | "unclear";
  active: "yes" | "no" | "unclear";
  network: EvidenceField<string>;
  /** Networks seen in link parameters or site links, independent of the AI. */
  detectedNetworks: string[];
  applicationUrl: string | null;
  commission: EvidenceField<string> & {
    type: "percentage" | "fixed" | "tiered" | "unknown";
    rateMin: number | null;
    rateMax: number | null;
    fixedAmount: number | null;
  };
  cookieDays: EvidenceField<number>;
  payoutThreshold: EvidenceField<string>;
  payoutSchedule: EvidenceField<string>;
  paymentMethods: EvidenceField<string>;
  validationPeriod: EvidenceField<string>;
  approvalRequirements: EvidenceField<string>;
  notes: string[];
  checkedUrls: string[];
}

export interface PolicyItem {
  key: PolicyKey;
  status: PolicyStatus;
  quote: string | null;
  sourceUrl: string | null;
  explanation: string;
  /** Came from program terms the admin pasted (no public URL). */
  fromPastedTerms?: boolean;
  /** The AI claimed a status but its quote wasn't found in the source, so it was downgraded to unknown. */
  unverifiedClaim: PolicyStatus | null;
}

export interface ReputationItem {
  kind: Exclude<ReputationKind, "irrelevant">;
  summary: string;
  quote: string | null;
  url: string;
  title: string;
  date: string | null;
  /** 0–1: how much weight this source carries (news/regulator 1.0 … unknown blog 0.3, the store's own site 0.1). */
  sourceTier: number;
  /** sourceTier × recency — what the risk score actually uses. */
  weight: number;
}

export interface ReputationResult {
  items: ReputationItem[];
  customerRating: {
    value: number;
    scale: number;
    count: number | null;
    platform: string | null;
    url: string | null;
    quote: string | null;
  } | null;
  /** How many search results were actually about this store — low coverage means "not enough data", not "clean". */
  coverage: number;
  queries: string[];
}

export interface ProductComponent {
  key: "popularity" | "commission" | "reviews" | "bestseller" | "priceFit" | "discount" | "pageQuality";
  label: string;
  /** 0–1, or null when there's no data for it (excluded from the score, lowers confidence). */
  value: number | null;
  weight: number;
}

export interface ProductItem {
  id: string;
  name: string;
  url: string;
  image: string | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  available: boolean;
  rating: number | null;
  reviewCount: number | null;
  /** Position in the store's own Best Sellers list. */
  bestsellerRank: number | null;
  /** Position among products featured on the homepage. */
  featuredRank?: number | null;
  /** How many "best selling <brand> products" search results name it. */
  webMentions?: number;
  productType: string | null;
  estCommissionMin: number | null;
  estCommissionMax: number | null;
  score: number;
  confidence: number;
  components: ProductComponent[];
  why: string;
  strengths: string[];
  risks: string[];
  adAngle: string;
  audience: string;
  keywordIdeas: string[];
}

export interface ProductsResult {
  source: "shopify" | "sitemap" | "none";
  totalFound: number;
  top: ProductItem[];
  note: string | null;
  /** Which popularity evidence the store offered (shown so a thin ranking is explained). */
  signals?: { bestsellerList: string | null; homepageFeatured: number; webResults: number };
}

export interface ScoreCriterion {
  label: string;
  points: number;
  max: number;
  /** false = no evidence either way (lowers confidence). */
  hasEvidence: boolean;
  note: string | null;
}

export interface ScoreCategory {
  key: string;
  label: string;
  points: number;
  max: number;
  criteria: ScoreCriterion[];
}

export type Verdict = "good" | "caution" | "risky" | "insufficient";
export type RiskLevel = "low" | "medium" | "high" | "insufficient";
export type ModelFit = "ok" | "check" | "conflict" | "unknown";

export interface ScoreResult {
  trust: number;
  risk: number;
  riskLevel: RiskLevel;
  confidence: number;
  verdict: Verdict;
  categories: ScoreCategory[];
  positives: string[];
  negatives: string[];
  modelFit: { status: ModelFit; reasons: string[] };
  /** The plain-language answer shown first ("Don't run your coupon ads for this store"). */
  bottomLine?: { tone: "good" | "warn" | "bad" | "muted"; title: string; detail: string };
}

export interface StepState {
  status: "pending" | "running" | "done" | "failed";
  error: string | null;
  updatedAt: string | Date | null;
}

export interface StoreCheckView {
  id: string;
  domain: string;
  name: string | null;
  inputUrl: string | null;
  targetCountry: string | null;
  steps: Record<StoreCheckStep, StepState>;
  linkSignals: LinkSignals | null;
  identity: IdentityResult | null;
  program: ProgramResult | null;
  policies: PolicyItem[] | null;
  reputation: ReputationResult | null;
  products: ProductsResult | null;
  score: ScoreResult | null;
  sources: SourceRef[];
  usage: { tavilyCredits: number; llmInputTokens: number; llmOutputTokens: number };
  lastCheckedAt: string | null;
  /** When the admin last pasted program terms for this store. */
  pastedTermsAt: string | null;
}

/** Usage counters a step reports back so the runner can $inc them on the StoreCheck. */
export interface StepUsage {
  tavilyCredits: number;
  llmInputTokens: number;
  llmOutputTokens: number;
}

export const EMPTY_USAGE: StepUsage = { tavilyCredits: 0, llmInputTokens: 0, llmOutputTokens: 0 };
