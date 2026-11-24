import { describe, expect, it } from "vitest";
import type { ProgramExtraction } from "@monocoupon/validation";
import { analyzeLink, brandMatchers, domainMatchesBrand, isLikelyStoreDomain, mentionsBrand, networkForUrl, parseStoreInput, registrableDomain } from "./domain";
import { focusTermsText, quoteInText, toEvidenceField } from "./evidence";
import { isAllowedByRobots, parseRobots } from "./robots";
import { isPrivateAddress } from "./safeFetch";
import { bottomLine, computeScore, evaluateModelFit } from "./score";
import { buildPolicies, buildProgram } from "./program";
import { commissionRange, popularityScore, priceFit, productFamily, productKey, ratingFromHtml } from "./products";
import { recencyFactor, sourceTier } from "./reputation";
import type { IdentityResult, PolicyItem, ProgramResult, ReputationResult, StoreCheckView } from "./types";
import { isAvoidStore, sortChecks } from "./sort";
import { guessDomain } from "./discover";
import { cleanText } from "./text";
import { trafficTier } from "./traffic";

describe("store input & link analysis", () => {
  it("turns an ad/affiliate link into the store domain and detects the network", () => {
    const input = parseStoreInput(
      "https://www.ekster.com/en-int?utm_source=RAN&ranMID=45176&ranEAID=3360653&tw_source=rakuten&gad_source=1&gclid=Cj0K"
    );
    expect(input.kind).toBe("url");
    if (input.kind !== "url") return;
    expect(input.domain).toBe("ekster.com");
    const signals = analyzeLink(input.url);
    expect(signals.networks.map((n) => n.network)).toEqual(["Rakuten Advertising"]);
    expect(signals.fromGoogleAds).toBe(true);
    expect(signals.cleanUrl).toBe("https://www.ekster.com/en-int");
  });

  it("recognises Social Snowball referral links", () => {
    const input = parseStoreInput("https://www.kittyspout.com/?snowball=QUAN99802&gclid=x");
    if (input.kind !== "url") throw new Error("expected url");
    expect(analyzeLink(input.url).networks[0]?.network).toBe("Social Snowball");
  });

  it("treats text with spaces as a brand name", () => {
    expect(parseStoreInput("Kitty Spout")).toEqual({ kind: "name", name: "Kitty Spout" });
  });

  it("uses the registrable domain", () => {
    expect(registrableDomain("shop.brand.co.uk")).toBe("brand.co.uk");
    expect(registrableDomain("www.tabs.co")).toBe("tabs.co");
  });

  it("never treats marketplaces or networks as a store", () => {
    expect(isLikelyStoreDomain("amazon.com")).toBe(false);
    expect(isLikelyStoreDomain("awin.com")).toBe(false);
    expect(isLikelyStoreDomain("kittyspout.com")).toBe(true);
  });

  it("maps network domains", () => {
    expect(networkForUrl("https://kittyspout.socialsnowball.io/signup/abc")).toBe("Social Snowball");
    expect(networkForUrl("https://af.uppromote.com/x/register")).toBe("UpPromote");
    expect(networkForUrl("https://example.com")).toBeNull();
  });
});

describe("brand matching", () => {
  it("matches compact brand names but not look-alikes", () => {
    const m = brandMatchers("KittySpout", "kittyspout.com");
    expect(mentionsBrand("The Kitty Spout fountain review", m)).toBe(true);
    expect(mentionsBrand("Kitty Up | Affiliate Register", m)).toBe(false);
  });

  it("requires a short domain to stand alone", () => {
    const m = brandMatchers("Tabs", "tabs.co");
    expect(mentionsBrand("Shop at tabs.co/products today", m)).toBe(true);
    expect(mentionsBrand("note2tabs.com affiliate program", m)).toBe(false);
    expect(mentionsBrand("Manage your browser tabs", m)).toBe(true); // short single-word names match as whole words only
  });

  it("does not match everything when the domain is unknown", () => {
    const m = brandMatchers("Zz", "");
    expect(mentionsBrand("completely unrelated text", m)).toBe(false);
  });
});

describe("quote verification", () => {
  const page = "Prohibited:\n- All coupon sites;\n- All search ads (e.g. Google or Bing Search);\nCommission is **20%** of referred sales.";

  it("accepts a verbatim quote despite formatting differences", () => {
    expect(quoteInText("All search ads (e.g. Google or Bing Search)", page)).toBe(true);
    expect(quoteInText("Commission is 20% of referred sales", page)).toBe(true);
  });

  it("accepts ellipsis-joined fragments in order", () => {
    expect(quoteInText("All coupon sites; … All search ads", page)).toBe(true);
  });

  it("rejects paraphrases and too-short quotes", () => {
    expect(quoteInText("Coupon websites are not allowed", page)).toBe(false);
    expect(quoteInText("20%", page)).toBe(false);
  });

  it("marks unmatched values as unverified and empty ones as unknown", () => {
    const sources = [{ url: "https://a.com", text: page }];
    expect(toEvidenceField("20%", "Commission is 20% of referred sales", 0, sources).status).toBe("verified");
    expect(toEvidenceField("25%", "Commission is 25% of sales", 0, sources).status).toBe("unverified");
    expect(toEvidenceField(null, null, null, sources).status).toBe("unknown");
  });

  it("keeps the ad rules of a long terms page inside the budget", () => {
    const filler = Array.from({ length: 300 }, (_, i) => `Affiliates agree to clause ${i} of the affiliate agreement.`).join("\n");
    const text = `${filler}\nThe following are prohibited:\nAll search ads (e.g. Google or Bing Search);\n${filler}`;
    const focused = focusTermsText(text, 2000);
    expect(focused.length).toBeLessThanOrEqual(2100);
    expect(focused).toContain("All search ads (e.g. Google or Bing Search);");
  });
});

describe("robots.txt", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /checkout\nAllow: /checkout/public\nDisallow: /*.json$\n\nUser-agent: VivaBloomAdminBot\nDisallow: /private\nSitemap: https://x.com/sitemap.xml");
  it("uses the most specific group", () => {
    expect(isAllowedByRobots(rules, "VivaBloomAdminBot", "/checkout")).toBe(true);
    expect(isAllowedByRobots(rules, "VivaBloomAdminBot", "/private/a")).toBe(false);
  });
  it("applies longest-match and wildcards for others", () => {
    expect(isAllowedByRobots(rules, "OtherBot", "/checkout/x")).toBe(false);
    expect(isAllowedByRobots(rules, "OtherBot", "/checkout/public/x")).toBe(true);
    expect(isAllowedByRobots(rules, "OtherBot", "/products.json")).toBe(false);
    expect(isAllowedByRobots(rules, "OtherBot", "/products.json?limit=1")).toBe(true);
  });
  it("reads sitemaps", () => {
    expect(rules.sitemaps).toEqual(["https://x.com/sitemap.xml"]);
  });
});

describe("SSRF guard", () => {
  it("blocks private and loopback addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress("104.18.20.1")).toBe(false);
  });
});

const extraction = (over: Partial<ProgramExtraction> = {}): ProgramExtraction => ({
  programFound: "yes",
  programActive: "yes",
  network: null,
  applicationUrl: null,
  commission: null,
  cookieDays: null,
  payoutThreshold: null,
  payoutSchedule: null,
  paymentMethods: null,
  validationPeriod: null,
  approvalRequirements: null,
  policies: [],
  notes: [],
  ...over,
});

describe("policies are evidence-only", () => {
  const sources = [{ url: "https://tabs.co/pages/affiliate-rules", text: "The following are prohibited:\n- All coupon sites;\n- All search ads (e.g. Google or Bing Search);" }];

  it("keeps a status only when its quote is in the source", () => {
    const policies = buildPolicies(
      extraction({
        policies: [
          { key: "coupon_sites", status: "prohibited", quote: "All coupon sites;", source: 0, explanation: "" },
          { key: "paid_search", status: "prohibited", quote: "All search ads (e.g. Google or Bing Search)", source: 0, explanation: "" },
          { key: "direct_linking", status: "allowed", quote: "Direct linking is welcome on all channels", source: 0, explanation: "" },
        ],
      }),
      sources
    );
    const byKey = Object.fromEntries(policies.map((p) => [p.key, p]));
    expect(byKey.paid_search?.status).toBe("prohibited");
    expect(byKey.coupon_sites?.status).toBe("prohibited");
    expect(byKey.direct_linking?.status).toBe("unknown");
    expect(byKey.direct_linking?.unverifiedClaim).toBe("allowed");
    // Implied: no paid search at all ⇒ no brand bidding ⇒ no brand + coupon keywords (same quote).
    expect(byKey.brand_bidding?.status).toBe("prohibited");
    expect(byKey.brand_coupon_keywords?.status).toBe("prohibited");
    expect(byKey.brand_coupon_keywords?.quote).toBe("All search ads (e.g. Google or Bing Search)");
    expect(byKey.trademark_in_ads?.status).toBe("unknown");
    expect(policies).toHaveLength(6);
  });

  it("never implies anything towards 'allowed'", () => {
    const policies = buildPolicies(
      extraction({ policies: [{ key: "paid_search", status: "allowed", quote: "All search ads (e.g. Google or Bing Search)", source: 0, explanation: "" }] }),
      sources
    );
    expect(policies.find((p) => p.key === "brand_bidding")?.status).toBe("unknown");
  });

  it("only trusts a commission rate whose number is in the quote", () => {
    const src = [{ url: "https://s.com/affiliate", text: "Earn 18% commission on every sale you refer." }];
    const ok = buildProgram(
      extraction({ commission: { value: "18%", type: "percentage", rateMin: 18, rateMax: 18, fixedAmount: null, quote: "Earn 18% commission on every sale", source: 0 } }),
      src,
      [],
      []
    );
    expect(ok.commission.status).toBe("verified");
    expect(ok.commission.rateMin).toBe(18);
    const wrong = buildProgram(
      extraction({ commission: { value: "25%", type: "percentage", rateMin: 25, rateMax: 25, fixedAmount: null, quote: "Earn 18% commission on every sale", source: 0 } }),
      src,
      [],
      []
    );
    expect(wrong.commission.status).toBe("unverified");
    expect(wrong.commission.rateMin).toBeNull();
  });
});

const identity = (over: Partial<IdentityResult> = {}): IdentityResult => ({
  name: "Shop",
  title: null,
  description: null,
  logo: null,
  homepageUrl: "https://shop.com/",
  reachable: true,
  fetchedVia: "direct",
  https: true,
  platform: "shopify",
  currency: "USD",
  domainCreatedAt: "2015-01-01T00:00:00Z",
  domainAgeYears: 11,
  registrar: null,
  waybackFirstSeen: "2016-01-01T00:00:00Z",
  onlineYears: 10,
  legalName: null,
  pages: { privacy: "x", terms: "x", refund: "x", shipping: null, contact: "x", about: null, affiliate: [] },
  contact: { emails: ["a@shop.com"], phones: [], address: "1 Main Street" },
  socials: [
    { platform: "Instagram", url: "x" },
    { platform: "Facebook", url: "y" },
  ],
  affiliateLinks: [],
  ...over,
});

const verified = <T,>(value: T) => ({ value, status: "verified" as const, quote: "q", sourceUrl: "u" });
const unknown = { value: null, status: "unknown" as const, quote: null, sourceUrl: null };
const program: ProgramResult = {
  found: "yes",
  active: "yes",
  network: verified("Awin"),
  detectedNetworks: ["Awin"],
  applicationUrl: "https://awin.com/x",
  commission: { ...verified("10%"), type: "percentage", rateMin: 10, rateMax: 10, fixedAmount: null },
  cookieDays: verified(30),
  payoutThreshold: verified("$50"),
  payoutSchedule: verified("monthly"),
  paymentMethods: unknown,
  validationPeriod: verified("45 days"),
  approvalRequirements: unknown,
  notes: [],
  checkedUrls: [],
};
const allowedPolicies: PolicyItem[] = (["paid_search", "brand_bidding", "brand_coupon_keywords", "trademark_in_ads", "coupon_sites", "direct_linking"] as const).map((key) => ({
  key,
  status: "allowed",
  quote: "q",
  sourceUrl: "u",
  explanation: "",
  unverifiedClaim: null,
}));
const cleanRep: ReputationResult = {
  items: [{ kind: "affiliate_positive", summary: "", quote: "q", url: "https://reddit.com/r/a", title: "", date: null, sourceTier: 0.45, weight: 0.3 }],
  customerRating: { value: 4.6, scale: 5, count: 900, platform: "Trustpilot", url: "u", quote: "q" },
  coverage: 12,
  queries: [],
};

describe("scoring", () => {
  it("rates an established, transparent, compatible store as safe", () => {
    const s = computeScore({ identity: identity(), program, policies: allowedPolicies, reputation: cleanRep, products: null });
    expect(s.verdict).toBe("good");
    expect(s.trust).toBeGreaterThanOrEqual(75);
    expect(s.modelFit.status).toBe("ok");
  });

  it("flags a store whose terms ban your ads even if it is otherwise trustworthy", () => {
    const policies = allowedPolicies.map((p) => (p.key === "coupon_sites" ? { ...p, status: "prohibited" as const } : p));
    const s = computeScore({ identity: identity(), program, policies, reputation: cleanRep, products: null });
    expect(s.modelFit.status).toBe("conflict");
    expect(s.verdict).toBe("caution");
    expect(s.negatives[0]).toContain("coupon");
  });

  it("calls a store risky when credible sources report unpaid commissions", () => {
    const rep: ReputationResult = {
      ...cleanRep,
      items: [
        { kind: "affiliate_unpaid", summary: "", quote: "q", url: "https://www.affiliatefix.com/t/1", title: "", date: "2026-09", sourceTier: 0.7, weight: 0.65 },
        { kind: "affiliate_terminated", summary: "", quote: "q", url: "https://www.reddit.com/r/x/1", title: "", date: "2026-08", sourceTier: 0.45, weight: 0.4 },
        { kind: "affiliate_unpaid", summary: "", quote: "q", url: "https://www.trustpilot.com/review/x", title: "", date: "2026-07", sourceTier: 0.6, weight: 0.5 },
      ],
    };
    const s = computeScore({ identity: identity(), program, policies: allowedPolicies, reputation: rep, products: null });
    expect(s.riskLevel).toBe("high");
    expect(s.verdict).toBe("risky");
  });

  it("never reports 'safe' when there is no evidence", () => {
    const s = computeScore({ identity: null, program: null, policies: null, reputation: null, products: null });
    expect(s.verdict).toBe("insufficient");
    expect(s.confidence).toBeLessThan(0.35);
  });

  it("asks for written confirmation when rules are missing", () => {
    expect(evaluateModelFit(allowedPolicies.map((p) => ({ ...p, status: "unknown" as const }))).status).toBe("unknown");
    expect(evaluateModelFit(allowedPolicies.map((p) => (p.key === "brand_bidding" ? { ...p, status: "unknown" as const } : p))).status).toBe("check");
  });
});

describe("products", () => {
  it("estimates commission only from a verified rate", () => {
    expect(commissionRange(100, program)).toEqual({ min: 10, max: 10 });
    expect(commissionRange(100, { ...program, commission: { ...program.commission, status: "unverified" } })).toEqual({ min: null, max: null });
  });

  it("groups variants into one product family without merging a whole brand", () => {
    expect(productFamily("Daily Ultimate Longevity - Quarterly Refills", "IM8 Health")).toBe(productFamily("Daily Ultimate Longevity", "IM8 Health"));
    expect(productFamily("The Beckham Stack Pro - Quarterly Refills (Pro)", "IM8 Health")).toBe(productFamily("The Beckham Stack Pro - Quarterly Refills", "IM8 Health"));
    expect(productFamily("The KittySpout™ - Wireless Fountain 2.0", "KittySpout")).not.toBe(productFamily("The KittySpout™ - Health & Happiness Cat Kit", "KittySpout"));
    expect(productFamily("The KittySpout™ - Wireless Fountain 2.0", "KittySpout")).not.toBe(productFamily("Stainless Steel Replacement Filters", "KittySpout"));
  });

  it("prefers prices that suit paid search", () => {
    expect(priceFit(10)).toBeLessThan(0.2);
    expect(priceFit(120)).toBe(1);
    expect(priceFit(1500)).toBeLessThan(0.5);
  });

  it("reads ratings from JSON-LD and Judge.me markup", () => {
    const ld = `<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"price":"20","priceCurrency":"USD"},"aggregateRating":{"ratingValue":"4.8","reviewCount":"321"}}</script>`;
    expect(ratingFromHtml(ld)).toEqual({ rating: 4.8, reviewCount: 321, currency: "USD" });
    expect(ratingFromHtml(`<div data-average-rating='4.50' data-number-of-reviews='77'></div>`)).toMatchObject({ rating: 4.5, reviewCount: 77 });
  });
});

describe("reputation weighting", () => {
  it("weights sources by credibility and recency", () => {
    expect(sourceTier("https://www.ftc.gov/x", "shop.com")).toBe(1);
    expect(sourceTier("https://shop.com/reviews", "shop.com")).toBe(0.1);
    expect(sourceTier("https://www.reddit.com/r/x", "shop.com")).toBeLessThan(sourceTier("https://www.trustpilot.com/review/x", "shop.com"));
    const now = Date.parse("2026-11-24");
    expect(recencyFactor("2026-11", now)).toBeGreaterThan(recencyFactor("2023-01", now));
    expect(recencyFactor(null, now)).toBe(0.5);
  });
});

describe("popularity", () => {
  const base = { key: "k", id: "1", name: "X", url: "u", image: null, price: 50, compareAtPrice: null, currency: "USD", available: true, productType: null, descriptionLength: 0, imageCount: 0, bestsellerRank: null, featuredRank: null, webMentions: 0, rating: null, reviewCount: null };
  const present = { bestseller: true, featured: true, reviews: true, mentions: true };

  it("ranks the store's #1 best-seller above a product missing from every list", () => {
    const top = popularityScore({ ...base, bestsellerRank: 1, featuredRank: 2, reviewCount: 800, webMentions: 3 }, present) ?? 0;
    const unknownProduct = popularityScore(base, present) ?? 0;
    expect(top).toBeGreaterThan(0.85);
    expect(unknownProduct).toBe(0);
  });

  it("is unknown when the store offers no popularity signals at all", () => {
    expect(popularityScore(base, { bestseller: false, featured: false, reviews: false, mentions: false })).toBeNull();
  });

  it("treats the same product linked differently as one", () => {
    expect(productKey("https://www.ekster.com/en-int/products/grid-backpack?variant=1")).toBe(productKey("https://www.ekster.com/products/grid-backpack"));
    expect(productKey("https://www.myprotein.com/p/sports-nutrition/impact-whey-protein-powder/10530943/#reviews")).toBe(
      productKey("https://www.myprotein.com/p/sports-nutrition/impact-whey-protein-powder/10530943")
    );
  });

  it("reads ProductGroup structured data (variants)", () => {
    const html = `<script type="application/ld+json">{"@type":"ProductGroup","name":"Impact Whey","aggregateRating":{"ratingValue":4.6,"reviewCount":51234},"hasVariant":[{"@type":"Product","offers":{"price":"24.99","priceCurrency":"GBP"}},{"@type":"Product","offers":{"price":"18.49","priceCurrency":"GBP"}}]}</script>`;
    expect(ratingFromHtml(html)).toEqual({ rating: 4.6, reviewCount: 51234, currency: "GBP" });
  });

  it("groups 'Name: subtitle' variants", () => {
    expect(productFamily("Daily Ultimate Longevity: Healthy Aging", "IM8 Health")).toBe(productFamily("Daily Ultimate Longevity - Quarterly Refills", "IM8 Health"));
  });
});

describe("bottom line", () => {
  it("says don't advertise when the terms ban your ads, even for a trustworthy store", () => {
    const s = computeScore({ identity: identity(), program, policies: allowedPolicies.map((p) => (p.key === "coupon_sites" ? { ...p, status: "prohibited" as const } : p)), reputation: cleanRep, products: null });
    expect(bottomLine(s, program).title).toMatch(/Don't run your coupon ads/);
  });

  it("asks for written approval when a trustworthy store's ad rules are unknown", () => {
    const s = computeScore({ identity: identity(), program, policies: allowedPolicies.map((p) => ({ ...p, status: "unknown" as const })), reputation: cleanRep, products: null });
    expect(s.bottomLine?.tone).toBe("warn");
    expect(s.bottomLine?.title).toMatch(/confirm the ad rules/);
  });

  it("gives the go-ahead only when the store is trustworthy and the rules allow your ads", () => {
    const s = computeScore({ identity: identity(), program, policies: allowedPolicies, reputation: cleanRep, products: null });
    expect(s.bottomLine?.tone).toBe("good");
  });
});

describe("checked stores ordering", () => {
  const mk = (id: string, tone: "good" | "warn" | "bad" | "muted", verdict: "good" | "caution" | "risky" | "insufficient", trust: number) =>
    ({ id, lastCheckedAt: `2026-11-2${id.length}T00:00:00Z`, score: { trust, risk: 10, verdict, bottomLine: { tone, title: "", detail: "" } } }) as unknown as StoreCheckView;

  it("puts promotable stores first and stores to avoid last", () => {
    const list = [mk("ban", "bad", "caution", 69), mk("ok", "good", "good", 80), mk("confirm", "warn", "good", 74), mk("care", "warn", "caution", 60)];
    expect(sortChecks(list, "best").map((c) => c.id)).toEqual(["ok", "confirm", "care", "ban"]);
    expect(sortChecks(list, "trust").map((c) => c.id)).toEqual(["ok", "confirm", "ban", "care"]);
  });
});

describe("finding a brand's own website", () => {
  it("only accepts a domain whose name matches the brand", () => {
    expect(domainMatchesBrand("vitaminshoppe.com", "The Vitamin Shoppe")).toBe(true);
    expect(domainMatchesBrand("tavily.com", "The Vitamin Shoppe")).toBe(false);
    expect(domainMatchesBrand("legionathletics.com", "Legion Athletics")).toBe(true);
    expect(domainMatchesBrand("revshare.so", "Legion Athletics")).toBe(false);
  });

  it("guesses a .com from the brand name (confirmed later by the site itself)", () => {
    expect(guessDomain("Legion Athletics")).toBe("legionathletics.com");
    expect(guessDomain("The Vitamin Shoppe")).toBe("vitaminshoppe.com");
    expect(isLikelyStoreDomain("tavily.com")).toBe(false);
  });
});

describe("risky stores tab", () => {
  it("puts stores whose bottom line says don't advertise into the avoid tab", () => {
    const view = (tone: "good" | "warn" | "bad" | "muted" | null) => ({ score: tone ? { bottomLine: { tone } } : null }) as unknown as StoreCheckView;
    expect(isAvoidStore(view("bad"))).toBe(true);
    expect(isAvoidStore(view("warn"))).toBe(false);
    expect(isAvoidStore(view(null))).toBe(false);
  });
});

describe("display text", () => {
  it("removes markdown left in AI quotes", () => {
    expect(cleanText("You’ll earn **10% commission**on every sale")).toBe("You’ll earn 10% commission on every sale");
    expect(cleanText("[Become an Affiliate](https://x.com/a(b)c)")).toBe("Become an Affiliate");
  });
});

describe("traffic tiers", () => {
  it("maps a rank to a popularity tier", () => {
    expect(trafficTier(5_000)).toBe("very_high");
    expect(trafficTier(205_481)).toBe("medium");
    expect(trafficTier(900_000)).toBe("low");
    expect(trafficTier(null)).toBe("unranked");
  });
});

describe("categoryOf", () => {
  it("prefers the saved category, else guesses from the store's text, else null", async () => {
    const { categoryOf } = await import("./category");
    const base = { name: "X", domain: "x.com", identity: null, products: null };
    expect(categoryOf({ ...base, category: "Fashion" })).toBe("Fashion");
    expect(categoryOf({ ...base, category: null, name: "Whey Protein Co", domain: "wheyprotein.com" })).toBe("Supplements");
    expect(categoryOf({ ...base, category: null })).toBeNull();
  });
});

describe("network detection", () => {
  it("finds every network named in text and only those next to the brand on third-party pages", async () => {
    const { findNetworks, networksNearBrand, brandMatchers } = await import("./domain");
    expect(findNetworks("Join via Social Snowball or apply on https://app.impact.com/x and ShareASale").sort()).toEqual(["Impact", "ShareASale (now Awin)", "Social Snowball"]);
    expect(findNetworks("We have an impact on the world")).toEqual([]);
    const m = brandMatchers("Emmafy", "emmafy.com");
    const filler = "x ".repeat(2000);
    expect(networksNearBrand(`Emmafy affiliate program runs on Social Snowball. ${filler} Other brand is on Awin.`, m)).toEqual(["Social Snowball"]);
  });
});
