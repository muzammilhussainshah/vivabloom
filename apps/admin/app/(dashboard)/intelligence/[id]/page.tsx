import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { STORE_CHECK_STEPS, getResearchCountry } from "@monocoupon/validation";
import { BackButton, buttonStyles } from "@/components/ui";
import { CheckRunner } from "@/components/intelligence/CheckRunner";
import { RecheckButton } from "@/components/intelligence/RecheckButton";
import { PrintReportButton } from "@/components/intelligence/PrintReportButton";
import { StoreLogo } from "@/components/intelligence/StoreLogo";
import { Pill, isOlderThanDays, timeAgo } from "@/components/intelligence/ui";
import { toView } from "@/lib/intelligence/runner";
import { getPersonalRecord } from "@/lib/intelligence/personal";
import { AdsRulesSection, IdentitySection, ProductsSection, ProgramSection, ReputationSection, ScoreSection, SourcesSection, SummarySection, TrafficSection } from "./sections";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  await connectToDatabase();
  const doc = await StoreCheck.findById(id).lean();
  return doc ? toView(doc as unknown as Record<string, unknown>) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const check = await load((await params).id);
  return { title: check ? `${check.name ?? check.domain} · Store Checker` : "Store Checker" };
}

const NAV = [
  ["products", "Products"],
  ["traffic", "Traffic"],
  ["ads", "Google Ads rules"],
  ["program", "Affiliate program"],
  ["reputation", "Reputation"],
  ["store", "Store identity"],
  ["score", "Score"],
  ["sources", "Sources"],
] as const;

export default async function StoreCheckReportPage({ params }: { params: Promise<{ id: string }> }) {
  const check = await load((await params).id);
  if (!check) notFound();
  const personal = await getPersonalRecord(check.domain).catch(() => null);
  const name = check.name ?? check.domain;
  const network = check.program?.network.value ?? check.program?.detectedNetworks[0] ?? check.linkSignals?.networks[0]?.network ?? null;
  const allDone = STORE_CHECK_STEPS.every((s) => check.steps[s].status === "done");

  return (
    <div data-print-report className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 md:px-8 md:py-10">
      <div data-print-hide>
        <BackButton href="/intelligence" label="Store Checker" />
      </div>
      <p data-print-only className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">AI Store Checker · Report</p>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:flex-row">
        <div className="flex min-w-0 items-center gap-4">
          <StoreLogo src={check.identity?.logo} domain={check.domain} name={name} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-text md:text-[28px]">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <a href={check.identity?.homepageUrl ?? `https://${check.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary">
                {check.domain} ↗
              </a>
              {network && <Pill tone="info" dot={false}>{network}</Pill>}
              <span className="whitespace-nowrap">
                {getResearchCountry(check.targetCountry)?.name ?? "United States"} prices · checked {timeAgo(check.lastCheckedAt)}
              </span>
              {allDone && isOlderThanDays(check.lastCheckedAt, 30) ? (
                <Pill tone="warn" dot={false}>Over a month old — re-check for fresh data</Pill>
              ) : allDone ? (
                <span data-print-hide>
                  <Pill tone="muted" dot={false}>Saved report · reopening is free</Pill>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div data-print-hide className="flex shrink-0 flex-wrap items-start gap-2">
          <a href={check.identity?.homepageUrl ?? `https://${check.domain}`} target="_blank" rel="noopener noreferrer" className={buttonStyles.secondary}>
            Visit store ↗
          </a>
          {check.score && <PrintReportButton fileName={`Store Check - ${name}${check.lastCheckedAt ? ` - ${check.lastCheckedAt.slice(0, 10)}` : ""}`} />}
          {allDone && <RecheckButton domain={check.domain} country={check.targetCountry} />}
        </div>
      </header>

      {/* Keyed by id only: it must stay mounted while router.refresh() streams in each step's results (a re-check does a full navigation). */}
      <div data-print-hide>
        <CheckRunner key={check.id} checkId={check.id} steps={check.steps} />
      </div>

      <SummarySection check={check} personal={personal} />

      <nav data-print-hide className="sticky top-14 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border bg-white/90 p-1 backdrop-blur md:top-2" aria-label="Report sections">
        {NAV.map(([href, label]) => (
          <a key={href} href={`#${href}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text">
            {label}
          </a>
        ))}
      </nav>

      <ProductsSection check={check} />
      <TrafficSection check={check} />
      <AdsRulesSection check={check} />
      <ProgramSection check={check} />
      <ReputationSection check={check} />
      <IdentitySection check={check} />
      <ScoreSection check={check} />
      <SourcesSection check={check} />
    </div>
  );
}
