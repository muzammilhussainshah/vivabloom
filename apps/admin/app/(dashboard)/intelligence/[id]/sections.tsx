import type { ReactNode } from "react";
import { POLICY_KEYS } from "@monocoupon/validation";
import type { PersonalRecord } from "@/lib/intelligence/personal";
import { MY_TRAFFIC_MODEL } from "@/lib/intelligence/score";
import type { EvidenceField, ProductItem, ReputationItem, StoreCheckView } from "@/lib/intelligence/types";
import { PasteTerms } from "@/components/intelligence/PasteTerms";
import { TrafficChart } from "@/components/intelligence/TrafficChart";
import { TrafficAutoFetch } from "@/components/intelligence/TrafficAutoFetch";
import {
  Bar,
  Card,
  EvidenceBadge,
  FIT_META,
  POLICY_LABELS,
  POLICY_STATUS_META,
  Pill,
  Quote,
  RISK_META,
  ScoreRing,
  SectionHeader,
  VERDICT_META,
  formatMoney,
  hostAndPath,
  scoreTone,
  timeAgo,
  toneClasses,
  type Tone,
} from "@/components/intelligence/ui";

function Pending({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-8 text-sm text-text-muted md:px-6">
      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-primary" aria-hidden="true" />
      {label}
    </div>
  );
}

function Failed({ error }: { error: string | null }) {
  return <p className="px-5 py-6 text-sm text-red-600 md:px-6">This step failed{error ? `: ${error}` : ""}. Use “Retry this step” above.</p>;
}

const TONE_ICON: Record<Tone, string> = { good: "✓", warn: "!", bad: "✕", muted: "?", info: "i" };

/* ---------------- Bottom line + key facts ---------------- */

export function SummarySection({ check, personal }: { check: StoreCheckView; personal: PersonalRecord | null }) {
  const score = check.score;
  if (!score) return null;
  const bottom = score.bottomLine ?? { tone: VERDICT_META[score.verdict].tone, title: VERDICT_META[score.verdict].label, detail: VERDICT_META[score.verdict].hint };
  const tone = toneClasses[bottom.tone as Tone];
  const verdict = VERDICT_META[score.verdict];
  const fit = FIT_META[score.modelFit.status];
  const risk = RISK_META[score.riskLevel];
  const pg = check.program;
  const mine = new Set(MY_TRAFFIC_MODEL.map((m) => m.key));
  const confirmed = (check.policies ?? []).filter((p) => mine.has(p.key) && p.status !== "unknown").length;
  const network = pg?.network.value ?? pg?.detectedNetworks[0] ?? null;
  const payout = [pg?.payoutThreshold.value ? `${pg.payoutThreshold.value} minimum` : null, pg?.payoutSchedule.value].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <Card className={`overflow-hidden border-2 print:break-inside-avoid ${tone.soft}`}>
        <div className="flex gap-4 p-5 md:gap-5 md:p-7">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm md:h-14 md:w-14 md:text-2xl"
            style={{ background: tone.ring }}
            aria-hidden="true"
          >
            {TONE_ICON[bottom.tone as Tone]}
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${tone.text}`}>Bottom line</p>
            <h2 className="mt-1 text-xl font-semibold leading-snug tracking-tight text-text md:text-[26px]">{bottom.title}</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-text md:text-[15px]">{bottom.detail}</p>
          </div>
        </div>

        <div className="grid border-t border-black/5 bg-white/70 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          <Fact label="Store trust">
            <div className="flex items-center gap-3">
              <ScoreRing value={score.trust} tone={verdict.tone} size={56} />
              <div className="min-w-0">
                <p className="font-semibold text-text">{verdict.label}</p>
                <p className={`text-xs ${toneClasses[risk.tone].text}`}>
                  {risk.label} · {Math.round(score.confidence * 100)}% confidence
                </p>
              </div>
            </div>
          </Fact>
          <Fact label="Your Google Ads">
            <Pill tone={fit.tone}>{fit.label}</Pill>
            <p className="mt-1.5 text-xs text-text-muted">
              {confirmed} of {MY_TRAFFIC_MODEL.length} rules that matter for you found ·{" "}
              <a href="#ads" className="font-semibold text-brand-primary hover:underline">
                see rules
              </a>
            </p>
          </Fact>
          <Fact label="Commission">
            <p className="text-lg font-bold leading-tight text-text">{pg?.commission.value ?? <span className="text-base font-medium text-text-muted">Unknown</span>}</p>
            <p className="mt-0.5 truncate text-xs text-text-muted">{network ? `via ${network}` : "Network unknown"}</p>
          </Fact>
          <Fact label="Payouts">
            <p className="text-sm font-semibold leading-snug text-text">{payout || <span className="font-medium text-text-muted">Not published</span>}</p>
            <p className="mt-0.5 text-xs text-text-muted">{pg?.cookieDays.value ? `${pg.cookieDays.value}-day cookie` : "Cookie length unknown"}</p>
          </Fact>
        </div>
      </Card>

      {personal && <PersonalBanner record={personal} />}

      <Card className="print:break-inside-avoid">
        <div className="grid md:grid-cols-2 print:grid-cols-2">
          <ReasonList title="What looks good" items={score.positives} tone="good" empty="Nothing stands out positively yet." />
          <ReasonList title="Watch out for" items={score.negatives} tone="bad" empty="No red flags found." className="border-t border-border md:border-l md:border-t-0 print:border-l print:border-t-0" />
        </div>
      </Card>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-black/5 p-4 sm:border-r sm:[&:nth-child(2n)]:border-r-0 md:p-5 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0 print:border-r print:[&:nth-child(2n)]:border-r print:last:border-r-0">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      {children}
    </div>
  );
}

function ReasonList({ title, items, tone, empty, className = "" }: { title: string; items: string[]; tone: "good" | "bad"; empty: string; className?: string }) {
  return (
    <div className={`p-5 md:p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-snug text-text">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${tone === "good" ? "bg-emerald-500" : "bg-red-500"}`}
                aria-hidden="true"
              >
                {tone === "good" ? "✓" : "!"}
              </span>
              {item.replace(/^Your ads: /, "")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonalBanner({ record }: { record: PersonalRecord }) {
  const cents = (n: number) => formatMoney(n / 100, "USD");
  const bad = record.lostCents > 0;
  return (
    <Card className={`border-2 print:break-inside-avoid ${bad ? toneClasses.bad.soft : toneClasses.info.soft}`}>
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6 print:flex-row print:items-center print:justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${bad ? toneClasses.bad.text : toneClasses.info.text}`}>Your own history with this store</p>
          <p className="mt-1 text-sm text-text">
            {bad
              ? `You recorded ${cents(record.lostCents)} as lost (never paid). Treat this as a serious warning, separate from the public score.`
              : `From your Accounting records for “${record.storeName}”. Kept separate from the public score.`}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
          {[
            ["Ad spend", cents(record.spentCents)],
            ["Earned", cents(record.grossEarnedCents)],
            ["Paid to you", cents(record.recoveredCents)],
            ["Pending", cents(record.pendingCents)],
            ["Lost", cents(record.lostCents)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className={`font-semibold tabular-nums ${label === "Lost" && bad ? "text-red-600" : "text-text"}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

/* ---------------- Products ---------------- */

function popularityChips(p: ProductItem): { label: string; tone: Tone; title: string }[] {
  const chips: { label: string; tone: Tone; title: string }[] = [];
  if (p.bestsellerRank) chips.push({ label: `#${p.bestsellerRank} best-seller`, tone: "good", title: "Position in the store's own Best Sellers list" });
  if (p.featuredRank) chips.push({ label: p.featuredRank <= 8 ? "Featured on homepage" : "On homepage", tone: "info", title: `Product #${p.featuredRank} shown on the store's homepage` });
  if (p.reviewCount) chips.push({ label: `${p.reviewCount.toLocaleString()} reviews`, tone: "info", title: "Number of customer reviews on the product page" });
  if (p.webMentions) chips.push({ label: `In ${p.webMentions} web list${p.webMentions > 1 ? "s" : ""}`, tone: "info", title: "Named in search results for this brand's best-selling products" });
  return chips;
}

function estCommission(p: ProductItem): string | null {
  if (p.estCommissionMin == null) return null;
  return p.estCommissionMax != null && p.estCommissionMax !== p.estCommissionMin
    ? `${formatMoney(p.estCommissionMin, p.currency)}–${formatMoney(p.estCommissionMax, p.currency)}`
    : formatMoney(p.estCommissionMin, p.currency);
}

export function ProductsSection({ check }: { check: StoreCheckView }) {
  const step = check.steps.products;
  const products = check.products;
  const signals = products?.signals;
  const [top, ...rest] = products?.top ?? [];
  return (
    <Card id="products">
      {/* Heading and the #1 pick move to the next page together when printing, so no heading is left alone. */}
      <div className="print:break-inside-avoid">
      <SectionHeader
        title="Best products to promote"
        description="Ranked by real popularity evidence first (the store's best-sellers, homepage, reviews, web), then commission and price. Estimates — not guaranteed sales."
        aside={
          signals ? (
            <div className="flex flex-wrap justify-end gap-1.5 text-[11px]">
              <Pill tone={signals.bestsellerList ? "good" : "muted"} dot={false}>
                {signals.bestsellerList ? "✓" : "✕"} Best-sellers list
              </Pill>
              <Pill tone={signals.homepageFeatured ? "good" : "muted"} dot={false}>
                {signals.homepageFeatured ? "✓" : "✕"} Homepage
              </Pill>
              <Pill tone={signals.webResults ? "good" : "muted"} dot={false}>
                {signals.webResults ? "✓" : "✕"} Web
              </Pill>
            </div>
          ) : products && products.totalFound > 0 ? (
            <Pill tone="muted" dot={false}>
              {products.totalFound} products scanned
            </Pill>
          ) : undefined
        }
      />
      {top && (
        <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 md:pt-6">
          {products?.note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{products.note}</p>}
          <TopPick product={top} commissionKnown={check.program?.commission.status === "verified"} />
        </div>
      )}
      </div>
      {!products ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Finding the most popular products…" />
      ) : !top ? (
        <p className="px-5 py-8 text-sm text-text-muted md:px-6">{products.note ?? "No products found."}</p>
      ) : (
        <div className="flex flex-col gap-4 p-4 md:p-6">
          {rest.length > 0 && (
            <ol className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
              {rest.map((p, i) => (
                <ProductCard key={p.id} product={p} rank={i + 2} />
              ))}
            </ol>
          )}
          <p className="text-xs text-text-muted">{products.totalFound} products scanned from the store&apos;s catalogue · variants of the same product are grouped.</p>
        </div>
      )}
    </Card>
  );
}

function ProductImage({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote store images; next/image would need every host allow-listed
    <img src={src} alt={alt} loading="lazy" className={`${className} rounded-xl border border-border bg-white object-contain p-1.5`} />
  ) : (
    <div className={`${className} rounded-xl border border-border bg-surface`} />
  );
}

function PriceLine({ p }: { p: ProductItem }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-base font-bold text-text">{formatMoney(p.price, p.currency)}</span>
      {p.compareAtPrice && <span className="text-sm text-text-muted line-through">{formatMoney(p.compareAtPrice, p.currency)}</span>}
      {p.rating != null && (
        <span className="text-sm text-text">
          <span className="text-amber-500">★</span> {p.rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function Chips({ p }: { p: ProductItem }) {
  const chips = popularityChips(p);
  if (!chips.length) return <span className="text-xs text-text-muted">No popularity data found</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c.label} title={c.title}>
          <Pill tone={c.tone} dot={false}>
            {c.label}
          </Pill>
        </span>
      ))}
    </div>
  );
}

function ProductDetails({ p }: { p: ProductItem }) {
  const hasMore = p.strengths.length || p.risks.length || p.adAngle || p.keywordIdeas.length;
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer list-none text-xs font-semibold text-brand-primary">
        <span className="group-open:hidden">{hasMore ? "Strengths, risks & keyword ideas ↓" : "How it's scored ↓"}</span>
        <span className="hidden group-open:inline">Hide details ↑</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {(p.strengths.length > 0 || p.risks.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ul className="flex flex-col gap-1">
              {p.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-xs text-text">
                  <span className="text-emerald-600" aria-hidden="true">✓</span>
                  {s}
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-1">
              {p.risks.map((s) => (
                <li key={s} className="flex gap-2 text-xs text-text">
                  <span className="text-amber-600" aria-hidden="true">!</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.adAngle && (
          <p className="text-xs text-text-muted">
            <span className="font-semibold text-text">Ad angle:</span> {p.adAngle}
            {p.audience && (
              <>
                {" "}
                <span className="font-semibold text-text">Audience:</span> {p.audience}
              </>
            )}
          </p>
        )}
        {p.keywordIdeas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.keywordIdeas.map((k) => (
              <span key={k} className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-text">
                {k}
              </span>
            ))}
          </div>
        )}
        <ul className="flex flex-col gap-1 rounded-lg bg-surface p-3">
          {p.components.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-text-muted">{c.label}</span>
              <span className="tabular-nums text-text">{c.value == null ? "no data" : Math.round(c.value * 100)}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function ScoreBlock({ p, compact = false }: { p: ProductItem; compact?: boolean }) {
  const tone = scoreTone(p.score);
  const est = estCommission(p);
  return (
    <div className={`grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 ${compact ? "" : "md:p-4"}`}>
      <div>
        <p className="text-[11px] font-medium text-text-muted">You earn per sale</p>
        <p className={`font-bold tabular-nums text-text ${compact ? "text-base" : "text-xl"}`}>{est ?? "Unknown"}</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-medium text-text-muted">Opportunity</p>
          <p className={`text-sm font-bold tabular-nums ${toneClasses[tone].text}`}>{p.score}</p>
        </div>
        <Bar value={p.score} tone={tone} className="mt-1.5" />
        <p className="mt-1 text-[10px] text-text-muted">{Math.round(p.confidence * 100)}% of signals</p>
      </div>
    </div>
  );
}

function TopPick({ product: p, commissionKnown }: { product: ProductItem; commissionKnown: boolean }) {
  return (
    <div className="relative grid gap-5 rounded-2xl border-2 border-brand-primary/25 bg-gradient-to-br from-brand-primary/[0.05] to-white p-4 md:grid-cols-[180px_minmax(0,1fr)_260px] md:p-5 print:break-inside-avoid print:grid-cols-[140px_minmax(0,1fr)_200px]">
      <span className="absolute -top-3 left-4 rounded-full bg-brand-primary px-3 py-1 text-xs font-bold text-white shadow-sm">#1 Top pick</span>
      <ProductImage src={p.image} alt={p.name} className="mx-auto h-40 w-40 md:h-44 md:w-44 print:h-32 print:w-32" />
      <div className="flex min-w-0 flex-col gap-2.5">
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold leading-snug text-text hover:text-brand-primary">
          {p.name} <span className="text-text-muted">↗</span>
        </a>
        <PriceLine p={p} />
        <Chips p={p} />
        {p.why && <p className="text-sm leading-relaxed text-text">{p.why}</p>}
        <ProductDetails p={p} />
      </div>
      <div className="flex flex-col gap-2">
        <ScoreBlock p={p} />
        {!commissionKnown && <p className="text-[11px] text-text-muted">Commission rate not verified, so earnings are unknown.</p>}
      </div>
    </div>
  );
}

function ProductCard({ product: p, rank }: { product: ProductItem; rank: number }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-md print:break-inside-avoid">
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <span className="absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-text text-[11px] font-bold text-white">{rank}</span>
          <ProductImage src={p.image} alt={p.name} className="h-24 w-24" />
        </div>
        <div className="min-w-0 flex-1">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-semibold leading-snug text-text hover:text-brand-primary">
            {p.name}
          </a>
          <div className="mt-1">
            <PriceLine p={p} />
          </div>
          <div className="mt-2">
            <Chips p={p} />
          </div>
        </div>
      </div>
      {p.why && <p className="line-clamp-3 text-sm leading-relaxed text-text">{p.why}</p>}
      <ScoreBlock p={p} compact />
      <ProductDetails p={p} />
    </li>
  );
}

/* ---------------- Google Ads rules ---------------- */

export function AdsRulesSection({ check }: { check: StoreCheckView }) {
  const step = check.steps.program;
  const policies = check.policies;
  const mine = new Set(MY_TRAFFIC_MODEL.map((m) => m.key));
  const missingMine = (policies ?? []).filter((p) => mine.has(p.key) && p.status === "unknown").length;
  return (
    <Card id="ads">
      <SectionHeader
        title="Google Ads rules"
        description="From the store's affiliate terms. A rule only shows as allowed or not allowed when we found the exact sentence — otherwise “Not found”."
      />
      {!policies ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Reading the affiliate terms…" />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {[...POLICY_KEYS]
              .sort((a, b) => Number(mine.has(b)) - Number(mine.has(a)))
              .map((key) => {
                const p = policies.find((x) => x.key === key);
                const status = p?.status ?? "unknown";
                const meta = POLICY_STATUS_META[status];
                return (
                  <li key={key} className="grid gap-2 px-5 py-4 md:grid-cols-[250px_140px_minmax(0,1fr)] md:items-start md:px-6 print:grid-cols-[190px_120px_minmax(0,1fr)] print:items-start">
                    <div>
                      <p className="text-sm font-semibold text-text">{POLICY_LABELS[key].label}</p>
                      <p className="text-xs text-text-muted">
                        {POLICY_LABELS[key].hint}
                        {mine.has(key) && <span className="ml-1 font-semibold text-brand-primary">· matters for you</span>}
                      </p>
                    </div>
                    <div>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                    <div className="min-w-0 text-sm text-text">
                      {p && p.status !== "unknown" ? (
                        <>
                          {p.explanation && <p className="text-text-muted">{p.explanation}</p>}
                          <Quote text={p.quote} url={p.sourceUrl} pasted={p.fromPastedTerms} />
                        </>
                      ) : p?.unverifiedClaim ? (
                        <p className="text-xs text-amber-700">
                          The AI read this as “{POLICY_STATUS_META[p.unverifiedClaim].label}”, but the quote couldn&apos;t be matched in the source, so it isn&apos;t trusted.
                        </p>
                      ) : (
                        <p className="text-xs text-text-muted">Not mentioned in the terms we found. Ask the affiliate manager in writing before running these ads.</p>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
          <div data-print-hide className={`border-t border-border px-5 py-4 md:px-6 ${missingMine > 0 ? "bg-amber-50/60" : ""}`}>
            {missingMine > 0 && (
              <p className="mb-2 text-xs text-amber-800">
                {missingMine} rule{missingMine > 1 ? "s" : ""} that matter for your ads {missingMine > 1 ? "aren't" : "isn't"} public. Network terms usually sit behind a login — paste them
                here to fill the gaps.
              </p>
            )}
            <PasteTerms checkId={check.id} alreadyPasted={check.pastedTermsAt} defaultOpen={false} />
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------- Affiliate program ---------------- */

function FieldRow<T>({ label, field, render }: { label: string; field: EvidenceField<T>; render?: (v: T) => ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-start md:px-6 print:grid-cols-[170px_minmax(0,1fr)_auto]">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-text">
        {field.value == null ? <span className="font-normal text-text-muted">Unknown</span> : render ? render(field.value) : String(field.value)}
        {field.status !== "unknown" && field.quote && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs font-semibold text-brand-primary">Show source</summary>
            <Quote text={field.quote} url={field.sourceUrl} pasted={field.status === "verified" && !field.sourceUrl} />
          </details>
        )}
      </dd>
      <div className="sm:text-right">
        <EvidenceBadge status={field.status} />
      </div>
    </div>
  );
}

export function ProgramSection({ check }: { check: StoreCheckView }) {
  const step = check.steps.program;
  const pg = check.program;
  const statusPill = !pg ? null : pg.active === "no" ? (
    <Pill tone="bad">Not active</Pill>
  ) : pg.found === "yes" ? (
    <Pill tone="good">Program found</Pill>
  ) : pg.found === "no" ? (
    <Pill tone="bad">No program found</Pill>
  ) : (
    <Pill tone="warn">Unclear</Pill>
  );
  return (
    <Card id="program">
      <SectionHeader title="Affiliate program" description="Terms as published by the store or its network. Verified = matched word-for-word in the source." aside={statusPill} />
      {!pg ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Looking for the affiliate program…" />
      ) : (
        <>
          <dl className="divide-y divide-border">
            <FieldRow
              label="Network / platform"
              field={pg.network.value == null && pg.detectedNetworks[0] ? { value: pg.detectedNetworks[0], status: "unverified", quote: null, sourceUrl: null } : pg.network}
            />
            <FieldRow label="Commission" field={pg.commission} />
            <FieldRow label="Cookie duration" field={pg.cookieDays} render={(d) => `${d} days`} />
            <FieldRow label="Payout threshold" field={pg.payoutThreshold} />
            <FieldRow label="Payout schedule" field={pg.payoutSchedule} />
            <FieldRow label="Payment methods" field={pg.paymentMethods} />
            <FieldRow label="Commission approval period" field={pg.validationPeriod} />
            <FieldRow label="Who can join" field={pg.approvalRequirements} />
          </dl>
          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="text-xs text-text-muted">
              {pg.detectedNetworks.length > 0 && <p>Detected from links: {pg.detectedNetworks.join(", ")}</p>}
              {pg.notes.length > 0 && (
                <ul className="mt-1 list-inside list-disc">
                  {pg.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
            {pg.applicationUrl && (
              <a
                href={pg.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover"
              >
                Apply to the program ↗
              </a>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------- Reputation ---------------- */

const KIND_META: Record<string, { label: string; tone: Tone }> = {
  affiliate_unpaid: { label: "Unpaid commission", tone: "bad" },
  affiliate_terminated: { label: "Account terminated", tone: "bad" },
  affiliate_reversal: { label: "Commission reversed", tone: "warn" },
  affiliate_delay: { label: "Late payment", tone: "warn" },
  affiliate_positive: { label: "Affiliate got paid", tone: "good" },
  customer_complaint: { label: "Customer complaint", tone: "muted" },
  customer_positive: { label: "Customer praise", tone: "good" },
  scam_warning: { label: "Scam warning", tone: "bad" },
};

export function ReputationSection({ check }: { check: StoreCheckView }) {
  const step = check.steps.reputation;
  const rep = check.reputation;
  const affiliate = rep?.items.filter((i) => i.kind.startsWith("affiliate_")) ?? [];
  const customer = rep?.items.filter((i) => !i.kind.startsWith("affiliate_")) ?? [];
  return (
    <Card id="reputation">
      <SectionHeader
        title="Reputation"
        description="What affiliates and customers say publicly. Complaints are allegations, weighted by how credible and recent the source is."
        aside={
          rep?.customerRating ? (
            <a href={rep.customerRating.url ?? undefined} target="_blank" rel="noopener noreferrer" className="text-right">
              <p className="text-lg font-bold tabular-nums text-text">
                <span className="text-amber-500">★</span> {rep.customerRating.value}/{rep.customerRating.scale}
              </p>
              <p className="text-xs text-text-muted">
                {rep.customerRating.count ? `${rep.customerRating.count.toLocaleString()} reviews` : "customer rating"}
                {rep.customerRating.platform ? ` · ${rep.customerRating.platform}` : ""}
              </p>
            </a>
          ) : undefined
        }
      />
      {!rep ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Searching for payment reports and reviews…" />
      ) : (
        <div className="grid md:grid-cols-2 print:grid-cols-2">
          <ReputationList
            title="From affiliates"
            items={affiliate}
            empty={rep.coverage < 6 ? "Very little public discussion found — this is not the same as “no problems”." : "No affiliate payment or termination reports found."}
          />
          <ReputationList title="From customers" items={customer} empty="No notable customer feedback found." className="border-t border-border md:border-l md:border-t-0 print:border-l print:border-t-0" />
        </div>
      )}
    </Card>
  );
}

function ReputationList({ title, items, empty, className = "" }: { title: string; items: ReputationItem[]; empty: string; className?: string }) {
  return (
    <div className={`p-5 md:p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {items.map((i) => (
            <li key={`${i.url}-${i.kind}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={KIND_META[i.kind]?.tone ?? "muted"}>{KIND_META[i.kind]?.label ?? i.kind}</Pill>
                <span className="text-xs text-text-muted">
                  {i.date ? i.date.slice(0, 10) : "date unknown"} · {i.weight >= 0.5 ? "strong" : i.weight >= 0.2 ? "medium" : "weak"} source
                </span>
              </div>
              <p className="mt-1.5 text-sm text-text">{i.summary}</p>
              <Quote text={i.quote} url={i.url} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Identity ---------------- */

export function IdentitySection({ check }: { check: StoreCheckView }) {
  const step = check.steps.identity;
  const id = check.identity;
  const link = (url: string | null, label: string) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-primary hover:underline">
        {label} ↗
      </a>
    ) : (
      <span className="text-text-muted">Not found</span>
    );
  return (
    <Card id="store">
      <SectionHeader title="Store identity" description="Who runs the store, how long it has existed, and whether the basics of a real business are in place." />
      {!id ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Visiting the store…" />
      ) : (
        <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
          {(
            [
              ["Domain registered", id.domainCreatedAt ? `${new Date(id.domainCreatedAt).getFullYear()} · ${id.domainAgeYears} yrs` : "Unknown"],
              ["Online since (archive)", id.waybackFirstSeen ? `${new Date(id.waybackFirstSeen).getFullYear()} · ${id.onlineYears} yrs` : "Unknown"],
              ["Registrar", id.registrar ?? "Unknown"],
              ["Platform", id.platform === "shopify" ? "Shopify" : "Other / unknown"],
              ["Legal name", id.legalName ?? "Not stated"],
              ["Address", id.contact.address ?? "Not found"],
              ["Email", id.contact.emails.join(", ") || "Not found"],
              ["Phone", id.contact.phones.join(", ") || "Not found"],
              ["Social profiles", id.socials.length ? id.socials.map((s) => s.platform).join(", ") : "None found"],
              ["Privacy policy", link(id.pages.privacy, "View")],
              ["Refund / returns", link(id.pages.refund, "View")],
              ["Terms of service", link(id.pages.terms, "View")],
            ] as [string, ReactNode][]
          ).map(([label, value]) => (
            <div key={label} className="bg-white px-5 py-3.5 md:px-6">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="mt-0.5 break-words text-sm text-text">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {id && id.fetchedVia !== "direct" && (
        <p className="border-t border-border px-5 py-3 text-xs text-amber-700 md:px-6">
          {id.fetchedVia === "extract" ? "The site blocks automated visits, so this was read through a web-extract service — some details may be missing." : "The website could not be reached."}
        </p>
      )}
    </Card>
  );
}

/* ---------------- Score breakdown & sources ---------------- */

export function ScoreSection({ check }: { check: StoreCheckView }) {
  const score = check.score;
  if (!score) return null;
  return (
    <Card id="score">
      <SectionHeader title="How the trust score is calculated" description="Points are only given for evidence that was found. Missing evidence scores 0 and lowers the confidence." />
      <div className="grid gap-px bg-border md:grid-cols-2 print:grid-cols-2">
        {score.categories.map((cat) => (
          <div key={cat.key} className="bg-white p-5 md:p-6 print:break-inside-avoid">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-text">{cat.label}</h3>
              <span className="text-sm font-bold tabular-nums text-text">
                {cat.points}
                <span className="font-normal text-text-muted">/{cat.max}</span>
              </span>
            </div>
            <Bar value={(cat.points / cat.max) * 100} tone={scoreTone((cat.points / cat.max) * 100)} className="mt-2" />
            <ul className="mt-3 flex flex-col gap-1.5">
              {cat.criteria.map((c) => (
                <li key={c.label} className="flex items-start justify-between gap-3 text-xs">
                  <span className={c.hasEvidence ? "text-text" : "text-text-muted"}>
                    {c.label}
                    {c.note && <span className="text-text-muted"> — {c.note}</span>}
                    {!c.hasEvidence && <span className="text-text-muted"> (no data)</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-text-muted">
                    {c.points}/{c.max}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

const SOURCE_KIND: Record<string, string> = {
  store_site: "Store website",
  affiliate_page: "Affiliate page",
  network: "Affiliate network",
  search_result: "Web",
  review: "Reviews",
  registry: "Registry",
  archive: "Archive",
};

export function SourcesSection({ check }: { check: StoreCheckView }) {
  if (check.sources.length === 0) return null;
  return (
    <Card id="sources">
      <SectionHeader
        title="Sources"
        description={`Everything this report relies on. Used ${check.usage.tavilyCredits} web-search credits · checked ${timeAgo(check.lastCheckedAt)}.`}
      />
      <ul className="grid gap-x-6 gap-y-2 px-5 py-4 text-sm md:grid-cols-2 md:px-6 print:grid-cols-2">
        {check.sources.map((s) => (
          <li key={s.url} className="flex min-w-0 items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-text-muted">{SOURCE_KIND[s.kind] ?? s.kind}</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate text-text hover:text-brand-primary" title={s.title}>
              {hostAndPath(s.url)}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Traffic & popularity ---------------- */

const TIER_META: Record<string, { label: string; tone: Tone; hint: string }> = {
  very_high: { label: "Very high", tone: "good", hint: "Top 10,000 websites worldwide" },
  high: { label: "High", tone: "good", hint: "Top 100,000 websites worldwide" },
  medium: { label: "Medium", tone: "info", hint: "Top 500,000 websites worldwide" },
  low: { label: "Low", tone: "warn", hint: "Top 1 million, but towards the bottom" },
  unranked: { label: "Small site", tone: "muted", hint: "Not in the top 1 million websites" },
};

export function TrafficSection({ check }: { check: StoreCheckView }) {
  const id = check.identity;
  const t = id?.traffic;
  const done = check.steps.identity.status === "done";
  return (
    <Card id="traffic">
      <SectionHeader
        title="Traffic & popularity"
        description="How popular the website is worldwide, from the free Tranco ranking (top 1 million sites). A lower rank number is more popular."
        aside={t?.listed ? <Pill tone={TIER_META[t.tier]!.tone}>{TIER_META[t.tier]!.label} popularity</Pill> : undefined}
      />
      {!id ? (
        <Pending label="Waiting for the store check…" />
      ) : !t ? (
        done ? <TrafficAutoFetch checkId={check.id} /> : <Pending label="Loading popularity history…" />
      ) : !t.listed ? (
        <div className="px-5 py-8 text-sm md:px-6">
          <p className="font-semibold text-text">Not in the top 1 million websites</p>
          <p className="mt-1 text-text-muted">This is a small or new site — fewer than roughly 30,000 visitors a month is typical at this level. Exact visit counts need a paid data source.</p>
        </div>
      ) : (
        <>
          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Popularity rank", `#${(t.rank ?? 0).toLocaleString()}`, "of about 1,000,000 sites"],
                [
                  "30-day trend",
                  t.changePct == null ? "—" : `${t.changePct > 0 ? "▲" : t.changePct < 0 ? "▼" : ""} ${Math.abs(t.changePct)}%`,
                  t.changePct == null ? "" : t.changePct > 0 ? "more popular than 30 days ago" : t.changePct < 0 ? "less popular than 30 days ago" : "unchanged",
                ],
                ["Best in 30 days", `#${(t.best ?? 0).toLocaleString()}`, "highest position"],
                ["Worst in 30 days", `#${(t.worst ?? 0).toLocaleString()}`, "lowest position"],
              ] as [string, string, string][]
            ).map(([label, value, sub], i) => (
              <div key={label} className="bg-white px-5 py-4 md:px-6">
                <dt className="text-xs text-text-muted">{label}</dt>
                <dd className={`mt-1 text-2xl font-bold tabular-nums ${i === 1 && t.changePct != null ? (t.changePct > 0 ? "text-emerald-600" : t.changePct < 0 ? "text-red-600" : "text-text") : "text-text"}`}>{value}</dd>
                <p className="mt-0.5 text-xs text-text-muted">{sub}</p>
              </div>
            ))}
          </dl>
          <div className="border-t border-border px-4 py-5 md:px-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-text">Popularity over the last 30 days</p>
              <p className="text-xs text-text-muted">Line up = more popular · {TIER_META[t.tier]!.hint}</p>
            </div>
            <TrafficChart history={t.history} />
          </div>
          <p className="border-t border-border bg-surface/60 px-5 py-3 text-xs text-text-muted md:px-6">
            This is a popularity <strong className="text-text">ranking</strong>, not a visit count. Exact monthly visits and country-wise traffic need a paid source (for example
            Similarweb), which isn&apos;t connected.
          </p>
        </>
      )}
    </Card>
  );
}
