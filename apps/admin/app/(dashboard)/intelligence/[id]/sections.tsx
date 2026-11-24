import type { ReactNode } from "react";
import { POLICY_KEYS } from "@monocoupon/validation";
import type { PersonalRecord } from "@/lib/intelligence/personal";
import { MY_TRAFFIC_MODEL } from "@/lib/intelligence/score";
import type { EvidenceField, ProductItem, ReputationItem, StoreCheckView } from "@/lib/intelligence/types";
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

/* ---------------- Verdict ---------------- */

export function VerdictSection({ check, personal }: { check: StoreCheckView; personal: PersonalRecord | null }) {
  const score = check.score;
  if (!score) return null;
  const meta = VERDICT_META[score.verdict];
  const fit = FIT_META[score.modelFit.status];
  const risk = RISK_META[score.riskLevel];
  const tone = toneClasses[meta.tone];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Card className={`overflow-hidden border-2 ${tone.soft}`}>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center md:p-6">
          <ScoreRing value={score.trust} tone={meta.tone} label="Trust" />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${tone.text}`}>Verdict</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text">{meta.label}</h2>
            <p className="mt-1 text-sm text-text-muted">{meta.hint}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone={risk.tone}>
                {risk.label} · {score.risk}/100
              </Pill>
              <Pill tone={score.confidence >= 0.7 ? "good" : score.confidence >= 0.4 ? "warn" : "muted"} dot={false}>
                Confidence {Math.round(score.confidence * 100)}%
              </Pill>
            </div>
          </div>
        </div>
      </Card>

      <Card className={`border-2 ${toneClasses[fit.tone].soft}`}>
        <div className="p-5 md:p-6">
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${toneClasses[fit.tone].text}`}>Your Google Ads</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-text">{fit.label}</h2>
          <p className="mt-1 text-xs text-text-muted">Checked against how you advertise: coupon site · Google Search · brand + coupon keywords.</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {score.modelFit.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-text">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneClasses[fit.tone].dot}`} aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
          <a href="#ads" className="mt-3 inline-block text-xs font-semibold text-brand-primary hover:underline">
            See the exact rules and quotes ↓
          </a>
        </div>
      </Card>

      {personal && <PersonalBanner record={personal} />}

      <Card className="lg:col-span-2">
        <div className="grid gap-0 md:grid-cols-2">
          <ReasonList title="What looks good" items={score.positives} tone="good" empty="Nothing stands out positively yet." />
          <ReasonList title="Watch out for" items={score.negatives} tone="bad" empty="No red flags found." className="border-t border-border md:border-l md:border-t-0" />
        </div>
      </Card>
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
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-snug text-text">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${tone === "good" ? "bg-emerald-500" : "bg-red-500"}`}
                aria-hidden="true"
              >
                {tone === "good" ? "✓" : "!"}
              </span>
              {item}
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
    <Card className={`lg:col-span-2 border-2 ${bad ? toneClasses.bad.soft : toneClasses.info.soft}`}>
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
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

export function ProductsSection({ check }: { check: StoreCheckView }) {
  const step = check.steps.products;
  const products = check.products;
  return (
    <Card id="products">
      <SectionHeader
        title="Most promising products"
        description="Ranked from the store's own catalogue: commission, ratings, best-seller list and price. Estimates — not guaranteed sales."
        aside={products && products.totalFound > 0 ? <Pill tone="muted" dot={false}>{products.totalFound} products scanned</Pill> : undefined}
      />
      {!products ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Reading the catalogue…" />
      ) : products.top.length === 0 ? (
        <p className="px-5 py-8 text-sm text-text-muted md:px-6">{products.note ?? "No products found."}</p>
      ) : (
        <>
          {products.note && <p className="border-b border-border bg-amber-50 px-5 py-2.5 text-xs text-amber-800 md:px-6">{products.note}</p>}
          <ol className="divide-y divide-border">
            {products.top.map((p, i) => (
              <ProductRow key={p.id} product={p} rank={i + 1} commissionKnown={check.program?.commission.status === "verified"} />
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

function ProductRow({ product: p, rank, commissionKnown }: { product: ProductItem; rank: number; commissionKnown: boolean }) {
  const tone = scoreTone(p.score);
  const est =
    p.estCommissionMin == null
      ? null
      : p.estCommissionMax != null && p.estCommissionMax !== p.estCommissionMin
        ? `${formatMoney(p.estCommissionMin, p.currency)}–${formatMoney(p.estCommissionMax, p.currency)}`
        : formatMoney(p.estCommissionMin, p.currency);
  return (
    <li className="grid gap-4 p-5 md:grid-cols-[auto_minmax(0,1fr)_220px] md:p-6">
      <div className="flex items-start gap-3 md:block">
        <div className="relative">
          <span className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-text text-xs font-bold text-white shadow">#{rank}</span>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote store images; next/image would need every host allow-listed
            <img src={p.image} alt={p.name} loading="lazy" className="h-28 w-28 rounded-xl border border-border bg-white object-contain p-1 md:h-32 md:w-32" />
          ) : (
            <div className="h-28 w-28 rounded-xl border border-border bg-surface md:h-32 md:w-32" />
          )}
        </div>
      </div>

      <div className="min-w-0">
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold leading-snug text-text hover:text-brand-primary">
          {p.name} ↗
        </a>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-text">{formatMoney(p.price, p.currency)}</span>
          {p.compareAtPrice && <span className="text-text-muted line-through">{formatMoney(p.compareAtPrice, p.currency)}</span>}
          {p.rating != null ? (
            <span className="text-text">
              <span className="text-amber-500">★</span> {p.rating.toFixed(1)}
              {p.reviewCount != null && <span className="text-text-muted"> ({p.reviewCount.toLocaleString()} reviews)</span>}
            </span>
          ) : (
            <span className="text-xs text-text-muted">No rating data</span>
          )}
          {p.bestsellerRank != null && <Pill tone="info" dot={false}>Best-seller #{p.bestsellerRank}</Pill>}
        </div>
        {p.why && <p className="mt-2.5 text-sm leading-relaxed text-text">{p.why}</p>}
        {(p.strengths.length > 0 || p.risks.length > 0) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {p.strengths.length > 0 && (
              <ul className="flex flex-col gap-1">
                {p.strengths.map((s) => (
                  <li key={s} className="flex gap-2 text-xs text-text">
                    <span className="text-emerald-600" aria-hidden="true">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {p.risks.length > 0 && (
              <ul className="flex flex-col gap-1">
                {p.risks.map((s) => (
                  <li key={s} className="flex gap-2 text-xs text-text">
                    <span className="text-amber-600" aria-hidden="true">!</span>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {p.adAngle && (
          <p className="mt-3 text-xs text-text-muted">
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
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {p.keywordIdeas.map((k) => (
              <span key={k} className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-text">
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="text-xs font-medium text-text-muted">Est. commission / sale</p>
          <p className="text-xl font-bold tabular-nums text-text">{est ?? "Unknown"}</p>
          {!commissionKnown && <p className="text-[11px] text-text-muted">Commission rate not verified</p>}
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-text-muted">Opportunity score</p>
            <p className={`text-sm font-bold tabular-nums ${toneClasses[tone].text}`}>{p.score}</p>
          </div>
          <Bar value={p.score} tone={tone} className="mt-1" />
          <p className="mt-1 text-[11px] text-text-muted">Based on {Math.round(p.confidence * 100)}% of the signals</p>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-brand-primary">How it&apos;s scored</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {p.components.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2">
                <span className="text-text-muted">{c.label}</span>
                <span className="tabular-nums text-text">{c.value == null ? "no data" : `${Math.round(c.value * 100)}`}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </li>
  );
}

/* ---------------- Google Ads rules ---------------- */

export function AdsRulesSection({ check }: { check: StoreCheckView }) {
  const step = check.steps.program;
  const policies = check.policies;
  const mine = new Set(MY_TRAFFIC_MODEL.map((m) => m.key));
  return (
    <Card id="ads">
      <SectionHeader
        title="Google Ads rules"
        description="From the store's affiliate terms. A rule is only shown as allowed or not allowed when we found the exact sentence — otherwise it's “Not found”."
      />
      {!policies ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Reading the affiliate terms…" />
      ) : (
        <ul className="divide-y divide-border">
          {POLICY_KEYS.map((key) => {
            const p = policies.find((x) => x.key === key);
            const status = p?.status ?? "unknown";
            const meta = POLICY_STATUS_META[status];
            return (
              <li key={key} className="grid gap-2 px-5 py-4 md:grid-cols-[260px_150px_minmax(0,1fr)] md:items-start md:px-6">
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
                  {p?.status !== "unknown" ? (
                    <>
                      {p?.explanation && <p className="text-text-muted">{p.explanation}</p>}
                      <Quote text={p?.quote ?? null} url={p?.sourceUrl ?? null} />
                    </>
                  ) : p?.unverifiedClaim ? (
                    <p className="text-xs text-amber-700">
                      The AI read this as “{POLICY_STATUS_META[p.unverifiedClaim].label}” but the quote couldn&apos;t be matched in the source, so it isn&apos;t trusted. Ask
                      the affiliate manager.
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted">Not mentioned in the terms we found. Ask the affiliate manager in writing before running ads.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Affiliate program ---------------- */

function FieldRow<T>({ label, field, render }: { label: string; field: EvidenceField<T>; render?: (v: T) => ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-start md:px-6">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-text">
        {field.value == null ? <span className="font-normal text-text-muted">Unknown</span> : render ? render(field.value) : String(field.value)}
        {field.status !== "unknown" && field.quote && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs font-semibold text-brand-primary">Show source</summary>
            <Quote text={field.quote} url={field.sourceUrl} />
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

const KIND_META: Record<string, { label: string; tone: "good" | "warn" | "bad" | "muted" | "info" }> = {
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
        <div className="grid md:grid-cols-2">
          <ReputationList title="From affiliates" items={affiliate} empty={rep.coverage < 6 ? "Very little public discussion found — this is not the same as “no problems”." : "No affiliate payment or termination reports found."} />
          <ReputationList title="From customers" items={customer} empty="No notable customer feedback found." className="border-t border-border md:border-l md:border-t-0" />
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
      <SectionHeader title="Store identity" description="Who runs the store, how long it has existed and whether the basics a real business has are in place." />
      {!id ? (
        step.status === "failed" ? <Failed error={step.error} /> : <Pending label="Visiting the store…" />
      ) : (
        <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["Domain registered", id.domainCreatedAt ? `${new Date(id.domainCreatedAt).getFullYear()} · ${id.domainAgeYears} yrs` : "Unknown"],
              ["Online since (archive)", id.waybackFirstSeen ? `${new Date(id.waybackFirstSeen).getFullYear()} · ${id.onlineYears} yrs` : "Unknown"],
              ["Registrar", id.registrar ?? "Unknown"],
              ["Platform", id.platform === "shopify" ? "Shopify" : "Unknown"],
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
      <div className="grid gap-px bg-border md:grid-cols-2">
        {score.categories.map((cat) => (
          <div key={cat.key} className="bg-white p-5 md:p-6">
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
      <ul className="grid gap-x-6 gap-y-2 px-5 py-4 text-sm md:grid-cols-2 md:px-6">
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
