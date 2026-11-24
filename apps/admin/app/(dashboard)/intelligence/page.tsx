import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { STORE_CHECK_STEPS, getResearchCountry } from "@monocoupon/validation";
import { PageShell } from "@/components/ui";
import { StoreList } from "@/components/intelligence/StoreList";
import { CheckForm } from "@/components/intelligence/CheckForm";
import { DiscoverPanel, type DiscoverView } from "@/components/intelligence/DiscoverPanel";
import { timeAgo } from "@/components/intelligence/ui";
import { toView } from "@/lib/intelligence/runner";
import { countPendingEnrichment, getAllDiscoveredStores, getDiscovery, listDiscoveryHistory } from "@/lib/intelligence/discover";
import type { StoreCheckView } from "@/lib/intelligence/types";
import { isAvoidStore, sortChecks } from "@/lib/intelligence/sort";
import { toRow } from "@/lib/intelligence/rows";

export const metadata: Metadata = { title: "Store Checker" };
export const dynamic = "force-dynamic";

/** The "Find new stores" tab: saved search history + the selected search (or every store found), all read from the database for free. */
async function loadFindTab(searchId: string | undefined): Promise<{ history: Awaited<ReturnType<typeof listDiscoveryHistory>>; view: DiscoverView | null; totalFound: number; pending: number }> {
  const [history, all, pending] = await Promise.all([listDiscoveryHistory(), getAllDiscoveredStores(), countPendingEnrichment()]);
  const selectedId = searchId ?? history[0]?.id;
  if (selectedId === "all") {
    return {
      history,
      pending,
      totalFound: all.length,
      view: { id: "all", title: "All found stores", subtitle: `${all.length} stores with affiliate programs from ${history.length} saved searches`, stores: all, hidden: [], legacy: false, params: null },
    };
  }
  const d = selectedId ? await getDiscovery(selectedId) : null;
  const view: DiscoverView | null = d
    ? {
        id: d.id,
        title: `${d.category}${d.keyword ? ` · ${d.keyword}` : ""}`,
        subtitle: `${getResearchCountry(d.country)?.name ?? d.country.toUpperCase()} · saved ${timeAgo(d.createdAt)} · reopens free`,
        stores: d.stores,
        hidden: d.hidden,
        legacy: d.legacy,
        params: { country: d.country, category: d.category, keyword: d.keyword },
      }
    : null;
  return { history, view, totalFound: all.length, pending };
}

export default async function StoreCheckerPage({ searchParams }: { searchParams: Promise<{ tab?: string; search?: string }> }) {
  const { tab: rawTab, search } = await searchParams;
  const tab = rawTab === "find" ? "find" : rawTab === "avoid" ? "avoid" : rawTab === "archived" ? "archived" : "checked";
  await connectToDatabase();
  const [docs, find] = await Promise.all([
    StoreCheck.find({}).sort({ updatedAt: -1 }).limit(300).lean(),
    tab === "find" ? loadFindTab(search) : Promise.resolve(null),
  ]);
  const all = sortChecks(
    docs.map((d) => toView(d as unknown as Record<string, unknown>)),
    "best"
  );
  const rowOf = (c: StoreCheckView) => toRow(c, STORE_CHECK_STEPS.filter((s) => c.steps[s].status === "done").length);
  // Archived stores are hidden from the main lists; risky stores live in their own tab so the main list is only stores worth considering.
  const archived = all.filter((c) => c.archived);
  const live = all.filter((c) => !c.archived);
  const avoid = live.filter(isAvoidStore);
  const promote = live.filter((c) => !isAvoidStore(c));
  const checks = tab === "avoid" ? avoid : tab === "archived" ? archived : promote;

  return (
    <PageShell>
      <header className="rounded-3xl border border-border bg-gradient-to-b from-white to-surface/60 px-5 py-7 shadow-[0_1px_2px_rgba(16,24,20,0.04)] md:px-10 md:py-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" aria-hidden="true" />
              AI Store Checker
            </p>
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-text md:text-4xl">Is this store worth promoting?</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-text-muted md:text-base">
              Trust verdict, affiliate terms, Google Ads rules for your setup and the most popular products — every finding backed by a quoted source.
            </p>
          </div>
          <CheckForm />
        </div>
      </header>

      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border" aria-label="Store Checker sections">
        {(
          [
            ["find", "Find new stores", "/intelligence?tab=find", null],
            ["checked", "Stores to promote", "/intelligence", promote.length],
            ["avoid", "Risky / avoid", "/intelligence?tab=avoid", avoid.length],
            ["archived", "Archived", "/intelligence?tab=archived", archived.length],
          ] as const
        ).map(([key, label, href, count]) => (
          <Link
            key={key}
            href={href}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === key
                ? key === "avoid"
                  ? "border-red-500 text-red-700"
                  : "border-brand-primary text-brand-primary"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {key === "avoid" && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
            {label}
            {count != null && count > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  key === "avoid" ? "bg-red-50 text-red-700" : tab === key ? "bg-brand-primary/10" : "bg-border/60 text-text-muted"
                }`}
              >
                {count}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "find" ? (
        <DiscoverPanel history={find?.history ?? []} view={find?.view ?? null} totalFound={find?.totalFound ?? 0} pendingEnrich={find?.pending ?? 0} />
      ) : checks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-text">
            {tab === "avoid" ? "No risky stores" : tab === "archived" ? "Nothing archived" : avoid.length || archived.length ? "No stores to promote yet" : "No stores checked yet"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
            {tab === "avoid" ? (
              "Stores whose terms ban your ads, or that look high risk, will appear here."
            ) : tab === "archived" ? (
              "Use the archive icon on a store to move it out of your main list. You can restore it any time."
            ) : (
              <>
                Paste a store link above, or use{" "}
                <Link href="/intelligence?tab=find" className="font-semibold text-brand-primary hover:underline">
                  Find new stores
                </Link>{" "}
                to discover brands with affiliate programs in your market.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tab === "avoid" && (
            <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white" aria-hidden="true">
                !
              </span>
              <p className="text-sm text-red-900">
                Don&apos;t spend on ads for these stores: their own affiliate terms ban how you advertise (coupon sites, brand or brand + coupon keywords), or the store
                looks high risk. They&apos;re kept here so you don&apos;t check them again by mistake.
              </p>
            </div>
          )}
          <StoreList key={tab} rows={checks.map(rowOf)} tab={tab} />
        </div>
      )}
    </PageShell>
  );
}
