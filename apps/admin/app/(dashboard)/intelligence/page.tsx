import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { STORE_CHECK_STEPS } from "@monocoupon/validation";
import { PageShell, Thumb } from "@/components/ui";
import { CheckForm } from "@/components/intelligence/CheckForm";
import { DiscoverPanel } from "@/components/intelligence/DiscoverPanel";
import { FIT_META, Pill, VerdictPill, formatMoney, scoreTone, timeAgo, toneClasses } from "@/components/intelligence/ui";
import { toView } from "@/lib/intelligence/runner";

export const metadata: Metadata = { title: "Store Checker" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "checked", label: "Checked stores" },
  { key: "find", label: "Find new stores" },
] as const;

export default async function StoreCheckerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "find" ? "find" : "checked";
  await connectToDatabase();
  const docs = tab === "checked" ? await StoreCheck.find({}).sort({ updatedAt: -1 }).limit(100).lean() : [];
  const checks = docs.map((d) => toView(d as unknown as Record<string, unknown>));

  return (
    <PageShell>
      <header className="relative overflow-hidden rounded-3xl border border-border bg-white px-5 py-7 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_12px_32px_-16px_rgba(16,24,20,0.12)] md:px-8 md:py-9">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">AI Intelligence</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-text md:text-[32px] md:leading-tight">Is this store worth promoting?</h1>
            <p className="mt-2 text-sm text-text-muted md:text-base">
              Get a trust verdict, the store&apos;s affiliate terms and Google Ads rules for <em>your</em> setup, and its most promising products —
              every finding backed by a quoted source.
            </p>
          </div>
          <CheckForm />
          <ul className="flex flex-wrap gap-2 text-xs font-medium text-text-muted">
            {["Trust & risk verdict", "Can you run your ads?", "Commission & payout terms", "Payment complaints", "Top 5 products"].map((t) => (
              <li key={t} className="rounded-full border border-border bg-surface px-3 py-1">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-border" aria-label="Store Checker sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "checked" ? "/intelligence" : "/intelligence?tab=find"}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
            {t.key === "checked" && tab === "checked" && checks.length > 0 && (
              <span className="ml-2 rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs tabular-nums">{checks.length}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "find" ? (
        <DiscoverPanel />
      ) : checks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-text">No stores checked yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
            Paste a store link above, or use <Link href="/intelligence?tab=find" className="font-semibold text-brand-primary hover:underline">Find new stores</Link> to
            discover brands with affiliate programs in your market.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {checks.map((c) => {
            const done = STORE_CHECK_STEPS.filter((s) => c.steps[s].status === "done").length;
            const top = c.products?.top[0];
            const fit = c.score?.modelFit.status;
            const commission = c.program?.commission.value;
            return (
              <li key={c.id}>
                <Link
                  href={`/intelligence/${c.id}`}
                  className="group grid gap-4 rounded-2xl border border-border bg-white p-4 transition-all hover:border-brand-primary/30 hover:shadow-md md:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center md:p-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Thumb src={c.identity?.logo} alt={c.name ?? c.domain} fit="contain" fallback={c.name ?? c.domain} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-text group-hover:text-brand-primary">{c.name ?? c.domain}</p>
                      <p className="truncate text-xs text-text-muted">
                        {c.domain} · checked {timeAgo(c.lastCheckedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {c.score ? (
                      <>
                        <span className={`text-2xl font-bold tabular-nums ${toneClasses[scoreTone(c.score.trust)].text}`}>{c.score.trust}</span>
                        <VerdictPill verdict={c.score.verdict} />
                      </>
                    ) : (
                      <Pill tone="muted">{done}/4 steps</Pill>
                    )}
                  </div>

                  <div className="min-w-0 text-sm">
                    <p className="text-xs font-medium text-text-muted">Your ads</p>
                    {fit ? <Pill tone={FIT_META[fit].tone}>{FIT_META[fit].label}</Pill> : <span className="text-text-muted">—</span>}
                  </div>

                  <div className="min-w-0 text-sm">
                    <p className="text-xs font-medium text-text-muted">Program · Top product</p>
                    <p className="truncate text-text">
                      {commission ?? (c.program ? "Commission unknown" : "—")}
                      {c.program?.network.value || c.program?.detectedNetworks[0] ? ` · ${c.program?.network.value ?? c.program?.detectedNetworks[0]}` : ""}
                    </p>
                    <p className="truncate text-xs text-text-muted">{top ? `${top.name} · ${formatMoney(top.price, top.currency)}` : "No products yet"}</p>
                  </div>

                  <span className="hidden text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary md:block" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
