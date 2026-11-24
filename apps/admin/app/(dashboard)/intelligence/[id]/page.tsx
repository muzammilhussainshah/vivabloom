import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { STORE_CHECK_STEPS, getResearchCountry } from "@monocoupon/validation";
import { BackButton, Thumb, buttonStyles } from "@/components/ui";
import { CheckRunner } from "@/components/intelligence/CheckRunner";
import { RecheckButton } from "@/components/intelligence/RecheckButton";
import { Pill, timeAgo } from "@/components/intelligence/ui";
import { toView } from "@/lib/intelligence/runner";
import { getPersonalRecord } from "@/lib/intelligence/personal";
import { AdsRulesSection, IdentitySection, ProductsSection, ProgramSection, ReputationSection, ScoreSection, SourcesSection, VerdictSection } from "./sections";

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 md:px-8 md:py-10">
      <BackButton href="/intelligence" label="Store Checker" />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Thumb src={check.identity?.logo} alt={name} size="lg" fit="contain" fallback={name} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-text md:text-[28px]">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <a href={check.identity?.homepageUrl ?? `https://${check.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary">
                {check.domain} ↗
              </a>
              {network && <Pill tone="info" dot={false}>{network}</Pill>}
              {check.linkSignals?.fromGoogleAds && <Pill tone="muted" dot={false}>Pasted link came from a Google Ad</Pill>}
              <span>
                · {getResearchCountry(check.targetCountry)?.name ?? "United States"} · checked {timeAgo(check.lastCheckedAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <a href={check.identity?.homepageUrl ?? `https://${check.domain}`} target="_blank" rel="noopener noreferrer" className={buttonStyles.secondary}>
            Visit store ↗
          </a>
          {allDone && <RecheckButton domain={check.domain} country={check.targetCountry} />}
        </div>
      </header>

      {/* Keyed by id only: it must stay mounted while router.refresh() streams in each step's results (a re-check does a full navigation). */}
      <CheckRunner key={check.id} checkId={check.id} steps={check.steps} />

      <VerdictSection check={check} personal={personal} />

      <nav className="sticky top-14 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border bg-white/90 p-1 backdrop-blur md:top-2" aria-label="Report sections">
        {NAV.map(([href, label]) => (
          <a key={href} href={`#${href}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text">
            {label}
          </a>
        ))}
      </nav>

      <ProductsSection check={check} />
      <AdsRulesSection check={check} />
      <ProgramSection check={check} />
      <ReputationSection check={check} />
      <IdentitySection check={check} />
      <ScoreSection check={check} />
      <SourcesSection check={check} />
    </div>
  );
}
