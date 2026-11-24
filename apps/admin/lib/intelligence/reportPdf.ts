// Same pdfkit "standalone" build as lib/generateFraudReportPdf.ts: it embeds
// the base-14 font data, which survives Next.js bundling.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { POLICY_KEYS, getResearchCountry } from "@monocoupon/validation";
import type { PersonalRecord } from "./personal";
import { MY_TRAFFIC_MODEL } from "./score";
import type { EvidenceField, StoreCheckView } from "./types";

/**
 * A printable/shareable PDF of a Store Check report. Uses pdfkit's flowing
 * text layout (no hand-placed rows) so long quotes wrap and page-break on
 * their own; only small decorative boxes are drawn at measured positions.
 */

const M = 48;
const C = {
  heading: "#111827",
  body: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  soft: "#f3f4f6",
  good: "#047857",
  warn: "#b45309",
  bad: "#b91c1c",
  info: "#0369a1",
};
const TONE: Record<string, string> = { good: C.good, warn: C.warn, bad: C.bad, muted: C.muted, info: C.info };

const POLICY_LABEL: Record<string, string> = {
  paid_search: "Paid search ads (Google / Bing)",
  brand_bidding: "Bidding on the brand name",
  brand_coupon_keywords: "Brand + coupon keywords",
  trademark_in_ads: "Brand name in ad text",
  coupon_sites: "Coupon & deal sites accepted",
  direct_linking: "Direct linking to the store",
};
const POLICY_STATUS: Record<string, { label: string; tone: string }> = {
  allowed: { label: "ALLOWED", tone: "good" },
  prohibited: { label: "NOT ALLOWED", tone: "bad" },
  restricted: { label: "WITH CONDITIONS", tone: "warn" },
  requires_approval: { label: "NEEDS APPROVAL", tone: "warn" },
  unknown: { label: "NOT FOUND", tone: "muted" },
};
const VERDICT: Record<string, string> = { good: "Trustworthy store", caution: "Some concerns", risky: "High risk", insufficient: "Not enough data" };
const FIT: Record<string, string> = { ok: "Fits your ads", check: "Confirm before spending", conflict: "Not allowed for your ads", unknown: "Ad rules not found" };
const KIND: Record<string, string> = {
  affiliate_unpaid: "Unpaid commission",
  affiliate_terminated: "Account terminated",
  affiliate_reversal: "Commission reversed",
  affiliate_delay: "Late payment",
  affiliate_positive: "Affiliate got paid",
  customer_complaint: "Customer complaint",
  customer_positive: "Customer praise",
  scam_warning: "Scam warning",
};

/**
 * The embedded Helvetica only covers WinAnsi, so anything else (★, ✓, →,
 * non-breaking hyphens from AI text, emoji) would print as garbage. Map the
 * common ones and drop the rest.
 */
const MAP: Record<string, string> = {
  "‑": "-", "‐": "-", "‒": "-", "−": "-", " ": " ", " ": " ", " ": " ",
  "★": "*", "☆": "*", "✓": "", "✔": "", "✕": "x", "✖": "x", "→": "->", "↗": "", "←": "<-",
  "≈": "~", "≤": "<=", "≥": ">=", "×": "x", "′": "'", "″": '"', "│": "|",
};
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function pdfText(input: string | null | undefined): string {
  if (!input) return "";
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.includes(ch) || ch === "\n") out += ch;
    else if (ch in MAP) out += MAP[ch];
  }
  return out.replace(/[ \t]{2,}/g, " ");
}

function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "-";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: amount >= 100 ? 0 : 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

export function generateStoreReportPdf(check: StoreCheckView, personal: PersonalRecord | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: M, size: "A4", bufferPages: true, info: { Title: `Store Check — ${check.name ?? check.domain}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const W = doc.page.width - M * 2;
    const ensure = (space: number) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - space) doc.addPage();
    };
    const text = (s: string | null | undefined, opts: PDFKit.Mixins.TextOptions = {}) => doc.text(pdfText(s), { width: W, ...opts });
    const section = (title: string, subtitle?: string) => {
      ensure(90);
      doc.moveDown(1.1);
      const y = doc.y;
      doc.rect(M, y, 3, 16).fill("#1f6f5c");
      doc.fillColor(C.heading).font("Helvetica-Bold").fontSize(13).text(pdfText(title), M + 10, y + 1, { width: W - 10 });
      if (subtitle) doc.fillColor(C.muted).font("Helvetica").fontSize(8.5).text(pdfText(subtitle), M + 10, doc.y + 1, { width: W - 10 });
      doc.x = M;
      doc.moveDown(0.6);
    };
    const kv = (label: string, value: string, valueColor = C.body) => {
      ensure(24);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.muted).text(`${pdfText(label)}:  `, M, doc.y, { continued: true, width: W });
      doc.font("Helvetica").fillColor(valueColor).text(pdfText(value) || "-");
    };
    const quote = (q: string | null | undefined, src: string | null | undefined, pasted = false) => {
      if (!q) return;
      ensure(36);
      const top = doc.y + 2;
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(C.body);
      const body = `"${pdfText(q.length > 360 ? `${q.slice(0, 360)}…` : q)}"`;
      const h = doc.heightOfString(body, { width: W - 18 });
      doc.rect(M + 4, top, 2, h + (src || pasted ? 12 : 2)).fill("#c7d2cd");
      doc.fillColor(C.body).text(body, M + 14, top, { width: W - 18 });
      if (src) doc.font("Helvetica").fontSize(7.5).fillColor(C.info).text(pdfText(src), M + 14, doc.y + 1, { width: W - 18, link: src, underline: false });
      else if (pasted) doc.font("Helvetica").fontSize(7.5).fillColor(C.info).text("From the program terms you pasted", M + 14, doc.y + 1);
      doc.x = M;
      doc.moveDown(0.5);
    };
    const bullet = (s: string, color = C.body) => {
      ensure(18);
      doc.font("Helvetica").fontSize(9.5).fillColor(color).text(`•  ${pdfText(s)}`, M + 6, doc.y, { width: W - 6, paragraphGap: 2 });
      doc.x = M;
    };
    const field = (label: string, f: EvidenceField<string | number>, suffix = "") => {
      const status = f.status === "verified" ? "Verified" : f.status === "unverified" ? "Not verified" : "Unknown";
      kv(label, f.value == null ? "Unknown" : `${f.value}${suffix}   [${status}]`, f.status === "verified" ? C.body : C.muted);
      if (f.value != null && f.quote) quote(f.quote, f.sourceUrl, f.status === "verified" && !f.sourceUrl);
    };

    const name = check.name ?? check.domain;
    const score = check.score;
    const bottom = score?.bottomLine;

    // ---- Header ----
    doc.rect(0, 0, doc.page.width, 86).fill("#1f6f5c");
    doc.fillColor("#ffffff").font("Helvetica").fontSize(9).text("STORE CHECK REPORT", M, 26, { characterSpacing: 1.5 });
    doc.font("Helvetica-Bold").fontSize(22).text(pdfText(name), M, 40, { width: W });
    doc.y = 100;
    doc.x = M;
    doc.fillColor(C.muted).font("Helvetica").fontSize(9);
    text(
      `${check.domain}  ·  ${getResearchCountry(check.targetCountry)?.name ?? "United States"} prices  ·  Researched ${
        check.lastCheckedAt ? new Date(check.lastCheckedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "-"
      }  ·  Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    );

    // ---- Bottom line box ----
    if (bottom) {
      doc.moveDown(0.8);
      const top = doc.y;
      const color = TONE[bottom.tone] ?? C.muted;
      doc.font("Helvetica-Bold").fontSize(15);
      const titleH = doc.heightOfString(pdfText(bottom.title), { width: W - 36 });
      doc.font("Helvetica").fontSize(10);
      const detailH = doc.heightOfString(pdfText(bottom.detail), { width: W - 36 });
      const boxH = 22 + titleH + detailH + 18;
      doc.roundedRect(M, top, W, boxH, 8).fillAndStroke(C.soft, C.border);
      doc.rect(M, top, 5, boxH).fill(color);
      doc.fillColor(color).font("Helvetica-Bold").fontSize(8).text("BOTTOM LINE", M + 20, top + 12, { characterSpacing: 1.2 });
      doc.fillColor(C.heading).font("Helvetica-Bold").fontSize(15).text(pdfText(bottom.title), M + 20, doc.y + 3, { width: W - 36 });
      doc.fillColor(C.body).font("Helvetica").fontSize(10).text(pdfText(bottom.detail), M + 20, doc.y + 3, { width: W - 36 });
      doc.y = top + boxH + 10;
      doc.x = M;
    }

    // ---- Key facts ----
    if (score) {
      section("At a glance");
      const pg = check.program;
      const network = pg?.network.value ?? pg?.detectedNetworks[0] ?? "Unknown";
      const mine = new Set(MY_TRAFFIC_MODEL.map((m) => m.key));
      const confirmed = (check.policies ?? []).filter((p) => mine.has(p.key) && p.status !== "unknown").length;
      kv("Store trust", `${score.trust}/100 — ${VERDICT[score.verdict] ?? score.verdict}  (risk ${score.risk}/100, ${Math.round(score.confidence * 100)}% confidence)`);
      kv("Your Google Ads", `${FIT[score.modelFit.status] ?? score.modelFit.status} (${confirmed} of ${MY_TRAFFIC_MODEL.length} rules that matter for you found)`, TONE[score.modelFit.status === "ok" ? "good" : score.modelFit.status === "conflict" ? "bad" : "warn"]);
      kv("Commission", `${pg?.commission.value ?? "Unknown"}  via ${network}`);
      kv("Payouts", [pg?.payoutThreshold.value ? `${pg.payoutThreshold.value} minimum` : null, pg?.payoutSchedule.value, pg?.cookieDays.value ? `${pg.cookieDays.value}-day cookie` : null].filter(Boolean).join(" · ") || "Not published");
      if (pg?.applicationUrl) kv("Apply", pg.applicationUrl, C.info);

      if (score.positives.length || score.negatives.length) {
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.good).text("What looks good", M);
        if (!score.positives.length) bullet("Nothing stands out positively yet.", C.muted);
        score.positives.forEach((p) => bullet(p));
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.bad).text("Watch out for", M);
        if (!score.negatives.length) bullet("No red flags found.", C.muted);
        score.negatives.forEach((n) => bullet(n.replace(/^Your ads: /, "")));
      }
    }

    // ---- Personal history ----
    if (personal) {
      section("Your own history with this store", "From your Accounting records — kept separate from the public score.");
      const c = (n: number) => money(n / 100, "USD");
      kv("Ad spend", c(personal.spentCents));
      kv("Commission earned", c(personal.grossEarnedCents));
      kv("Paid to you", c(personal.recoveredCents));
      kv("Pending", c(personal.pendingCents));
      kv("Lost (never paid)", c(personal.lostCents), personal.lostCents > 0 ? C.bad : C.body);
    }

    // ---- Products ----
    const products = check.products;
    if (products?.top.length) {
      section("Best products to promote", "Ranked by popularity evidence (store best-sellers, homepage, reviews, web), then commission and price. Estimates — not guaranteed sales.");
      products.top.forEach((p, i) => {
        ensure(110);
        doc.font("Helvetica-Bold").fontSize(11).fillColor(C.heading).text(`${i + 1}.  ${pdfText(p.name)}`, M, doc.y, { width: W, link: p.url });
        const popularity = [
          p.bestsellerRank ? `#${p.bestsellerRank} in store best-sellers` : null,
          p.featuredRank ? `on homepage (#${p.featuredRank})` : null,
          p.reviewCount ? `${p.reviewCount.toLocaleString()} reviews` : null,
          p.webMentions ? `in ${p.webMentions} web list(s)` : null,
        ].filter(Boolean);
        const est = p.estCommissionMin == null ? "Unknown" : p.estCommissionMax != null && p.estCommissionMax !== p.estCommissionMin ? `${money(p.estCommissionMin, p.currency)}–${money(p.estCommissionMax, p.currency)}` : money(p.estCommissionMin, p.currency);
        doc.font("Helvetica").fontSize(9).fillColor(C.muted);
        text(
          `${money(p.price, p.currency)}${p.compareAtPrice ? ` (was ${money(p.compareAtPrice, p.currency)})` : ""}${p.rating != null ? `  ·  Rating ${p.rating.toFixed(1)}/5` : ""}  ·  You earn per sale: ${est}  ·  Opportunity ${p.score}/100`,
          { indent: 14 }
        );
        if (popularity.length) text(`Popularity: ${popularity.join(", ")}`, { indent: 14 });
        if (p.why) {
          doc.font("Helvetica").fontSize(9.5).fillColor(C.body);
          text(p.why, { indent: 14 });
        }
        p.strengths.slice(0, 3).forEach((s) => bullet(`+ ${s}`, C.good));
        p.risks.slice(0, 3).forEach((s) => bullet(`! ${s}`, C.warn));
        if (p.keywordIdeas.length) {
          doc.font("Helvetica").fontSize(8.5).fillColor(C.muted);
          text(`Keyword ideas: ${p.keywordIdeas.join(" · ")}`, { indent: 14 });
        }
        doc.moveDown(0.7);
      });
    }

    // ---- Google Ads rules ----
    if (check.policies) {
      section("Google Ads rules", "From the store's affiliate terms. A rule shows as allowed / not allowed only when the exact sentence was found.");
      for (const key of POLICY_KEYS) {
        const p = check.policies.find((x) => x.key === key);
        const st = POLICY_STATUS[p?.status ?? "unknown"] ?? POLICY_STATUS.unknown;
        ensure(40);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.heading).text(pdfText(POLICY_LABEL[key] ?? key), M, doc.y, { continued: true, width: W });
        doc.fillColor(TONE[st.tone] ?? C.muted).text(`   ${st.label}`);
        if (p && p.status !== "unknown") {
          if (p.explanation) {
            doc.font("Helvetica").fontSize(9).fillColor(C.muted);
            text(p.explanation);
          }
          quote(p.quote, p.sourceUrl, p.fromPastedTerms);
        } else {
          doc.font("Helvetica").fontSize(9).fillColor(C.muted);
          text("Not mentioned in the terms found — confirm with the affiliate manager in writing before running these ads.");
          doc.moveDown(0.4);
        }
      }
    }

    // ---- Affiliate program ----
    const pg = check.program;
    if (pg) {
      section("Affiliate program", "Verified = matched word-for-word in the source.");
      kv("Program", pg.active === "no" ? "Not active" : pg.found === "yes" ? "Found" : pg.found === "no" ? "Not found" : "Unclear", pg.active === "no" || pg.found === "no" ? C.bad : C.body);
      field("Network / platform", pg.network);
      field("Commission", pg.commission);
      field("Cookie duration", pg.cookieDays, " days");
      field("Payout threshold", pg.payoutThreshold);
      field("Payout schedule", pg.payoutSchedule);
      field("Payment methods", pg.paymentMethods);
      field("Commission approval period", pg.validationPeriod);
      field("Who can join", pg.approvalRequirements);
      if (pg.notes.length) {
        doc.moveDown(0.3);
        pg.notes.forEach((n) => bullet(n, C.muted));
      }
    }

    // ---- Reputation ----
    const rep = check.reputation;
    if (rep) {
      section("Reputation", "Public complaints are allegations, weighted by source credibility and recency.");
      if (rep.customerRating) kv("Customer rating", `${rep.customerRating.value}/${rep.customerRating.scale}${rep.customerRating.count ? ` from ${rep.customerRating.count.toLocaleString()} reviews` : ""}${rep.customerRating.platform ? ` on ${rep.customerRating.platform}` : ""}`);
      if (!rep.items.length) {
        doc.font("Helvetica").fontSize(9.5).fillColor(C.muted);
        text(rep.coverage < 6 ? "Very little public discussion found — this is not the same as “no problems”." : "No affiliate payment or termination reports found.");
      }
      for (const item of rep.items) {
        ensure(40);
        const bad = /unpaid|terminated|scam/.test(item.kind);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(bad ? C.bad : C.heading).text(`${KIND[item.kind] ?? item.kind}`, M, doc.y, { continued: true });
        doc.font("Helvetica").fillColor(C.muted).text(`   ${item.date ? item.date.slice(0, 10) : "date unknown"} · ${item.weight >= 0.5 ? "strong" : item.weight >= 0.2 ? "medium" : "weak"} source`);
        doc.font("Helvetica").fontSize(9.5).fillColor(C.body);
        text(item.summary);
        quote(item.quote, item.url);
      }
    }

    // ---- Identity ----
    const id = check.identity;
    if (id) {
      section("Store identity");
      kv("Domain registered", id.domainCreatedAt ? `${new Date(id.domainCreatedAt).getFullYear()} (${id.domainAgeYears} years)` : "Unknown");
      kv("Online since (archive)", id.waybackFirstSeen ? `${new Date(id.waybackFirstSeen).getFullYear()} (${id.onlineYears} years)` : "Unknown");
      kv("Platform", id.platform === "shopify" ? "Shopify" : "Other / unknown");
      kv("Legal name", id.legalName ?? "Not stated");
      kv("Address", id.contact.address ?? "Not found");
      kv("Email", id.contact.emails.join(", ") || "Not found");
      kv("Phone", id.contact.phones.join(", ") || "Not found");
      kv("Policies", [id.pages.privacy ? "Privacy" : null, id.pages.terms ? "Terms" : null, id.pages.refund ? "Refund / returns" : null].filter(Boolean).join(", ") || "None found");
      kv("Social profiles", id.socials.map((s) => s.platform).join(", ") || "None found");
    }

    // ---- Score breakdown ----
    if (score) {
      section("How the trust score is calculated", "Points are only given for evidence that was found; missing evidence scores 0 and lowers confidence.");
      for (const cat of score.categories) {
        ensure(60);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.heading).text(`${pdfText(cat.label)}  —  ${cat.points}/${cat.max}`, M);
        for (const c of cat.criteria) {
          doc.font("Helvetica").fontSize(8.5).fillColor(c.hasEvidence ? C.body : C.muted);
          text(`${c.points}/${c.max}   ${pdfText(c.label)}${c.note ? ` — ${pdfText(c.note)}` : ""}${c.hasEvidence ? "" : " (no data)"}`, { indent: 12 });
        }
        doc.moveDown(0.4);
      }
    }

    // ---- Sources ----
    if (check.sources.length) {
      section("Sources");
      doc.font("Helvetica").fontSize(8).fillColor(C.info);
      for (const s of check.sources) {
        ensure(14);
        text(s.url, { link: s.url });
      }
    }

    // ---- Footer on every page ----
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(7.5).fillColor(C.muted);
      doc.text(
        `${pdfText(name)} — Store Check  ·  AI-assisted research; verify terms with the affiliate manager before spending  ·  Page ${i - range.start + 1} of ${range.count}`,
        M,
        doc.page.height - 30,
        { width: W, align: "center", lineBreak: false }
      );
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  });
}
