import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { STORE_CHECK_STEPS, getResearchCountry } from "@monocoupon/validation";
import { PageShell } from "@/components/ui";
import { StoreLogo } from "@/components/intelligence/StoreLogo";
import { CheckForm } from "@/components/intelligence/CheckForm";
import { DiscoverPanel, type DiscoverView } from "@/components/intelligence/DiscoverPanel";
import { Pill, VerdictPill, formatMoney, scoreTone, timeAgo, toneClasses } from "@/components/intelligence/ui";
import { toView } from "@/lib/intelligence/runner";
import { getAllDiscoveredStores, getDiscovery, listDiscoveryHistory } from "@/lib/intelligence/discover";
import type { StoreCheckView } from "@/lib/intelligence/types";
import { CHECK_SORTS as SORTS, isAvoidStore, sortChecks, type CheckSortKey as SortKey } from "@/lib/intelligence/sort";

export const metadata: Metadata = { title: "Store Checker" };
export const dynamic = "force-dynamic";

/** The "Find new stores" tab: saved search history + the selected search (or every store found), all read from the database for free. */
async function loadFindTab(searchId: string | undefined): Promise<{ history: Awaited<ReturnType<typeof listDiscoveryHistory>>; view: DiscoverView | null; totalFound: number }> {
  const [history, all] = await Promise.all([listDiscoveryHistory(), getAllDiscoveredStores()]);
  const selectedId = searchId ?? history[0]?.id;
  if (selectedId === "all") {
    return {
      history,
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
  return { history, view, totalFound: all.length };
}

/** One column template shared by the header and every row, so columns line up exactly. */
const ROW_GRID = "md:grid-cols-[minmax(0,1.5fr)_150px_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_20px]";

export default async function StoreCheckerPage({ searchParams }: { searchParams: Promise<{ tab?: string; search?: string; sort?: string }> }) {
  const { tab: rawTab, search, sort: rawSort } = await searchParams;
  const sort: SortKey = SORTS.some((x) => x.key === rawSort) ? (rawSort as SortKey) : "best";
  const tab = rawTab === "find" ? "find" : rawTab === "avoid" ? "avoid" : "checked";
  await connectToDatabase();
  const [docs, find] = await Promise.all([
    StoreCheck.find({}).sort({ updatedAt: -1 }).limit(300).lean(),
    tab === "find" ? loadFindTab(search) : Promise.resolve(null),
  ]);
  const all = sortChecks(
    docs.map((d) => toView(d as unknown as Record<string, unknown>)),
    sort
  );
  // Risky stores live in their own tab so the main list is only stores worth considering.
  const avoid = all.filter(isAvoidStore);
  const promote = all.filter((c) => !isAvoidStore(c));
  const checks = tab === "avoid" ? avoid : promote;
  const tabBase = tab === "avoid" ? "/intelligence?tab=avoid" : "/intelligence";

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
            ["checked", "Stores to promote", "/intelligence", promote.length],
            ["avoid", "Risky / avoid", "/intelligence?tab=avoid", avoid.length],
            ["find", "Find new stores", "/intelligence?tab=find", null],
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
        <DiscoverPanel history={find?.history ?? []} view={find?.view ?? null} totalFound={find?.totalFound ?? 0} />
      ) : checks.length === 0 && tab === "avoid" ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-text">No risky stores</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">Stores whose terms ban your ads, or that look high risk, will appear here.</p>
        </div>
      ) : checks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-text">{avoid.length ? "No stores to promote yet" : "No stores checked yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
            Paste a store link above, or use{" "}
            <Link href="/intelligence?tab=find" className="font-semibold text-brand-primary hover:underline">
              Find new stores
            </Link>{" "}
            to discover brands with affiliate programs in your market.
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-text-muted">
            {sort === "best"
              ? tab === "avoid"
                ? "Highest-risk stores last."
                : "Best stores to promote first."
              : sort === "trust"
                ? "Sorted by trust score."
                : "Most recently checked first."}
          </p>
          <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-border" role="group" aria-label="Sort stores">
            {SORTS.map((o) => (
              <Link
                key={o.key}
                href={o.key === "best" ? tabBase : `${tabBase}${tabBase.includes("?") ? "&" : "?"}sort=${o.key}`}
                aria-current={sort === o.key ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${sort === o.key ? "bg-text text-white" : "text-text-muted hover:text-text"}`}
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)]">
          <div className={`hidden gap-5 border-b border-border bg-surface/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted md:grid ${ROW_GRID}`}>
            <span>Store</span>
            <span>Trust</span>
            <span>Bottom line</span>
            <span>Commission</span>
            <span>Top product</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {checks.map((c) => (
              <CheckRow key={c.id} c={c} />
            ))}
          </ul>
        </div>
        </div>
      )}
    </PageShell>
  );
}

function CheckRow({ c }: { c: StoreCheckView }) {
  const done = STORE_CHECK_STEPS.filter((s) => c.steps[s].status === "done").length;
  const top = c.products?.top[0];
  const network = c.program?.network.value ?? c.program?.detectedNetworks[0] ?? null;
  const bottom = c.score?.bottomLine;
  return (
    <li>
      <Link href={`/intelligence/${c.id}`} className={`group grid gap-3 px-5 py-4 transition-colors hover:bg-surface/60 md:items-center md:gap-5 ${ROW_GRID}`}>
        <div className="flex min-w-0 items-center gap-3">
          <StoreLogo src={c.identity?.logo} domain={c.domain} name={c.name ?? c.domain} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-text group-hover:text-brand-primary">{c.name ?? c.domain}</p>
            <p className="truncate text-xs text-text-muted">
              {c.domain} · {timeAgo(c.lastCheckedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {c.score ? (
            <>
              <span className={`w-8 text-xl font-bold tabular-nums ${toneClasses[scoreTone(c.score.trust)].text}`}>{c.score.trust}</span>
              <VerdictPill verdict={c.score.verdict} />
            </>
          ) : (
            <Pill tone="muted">{done}/4 steps</Pill>
          )}
        </div>

        <div className="min-w-0">
          {bottom ? (
            <p className={`line-clamp-2 text-sm font-semibold leading-snug ${toneClasses[bottom.tone].text}`} title={bottom.detail}>
              {bottom.title}
            </p>
          ) : (
            <span className="text-sm text-text-muted">Research in progress…</span>
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{c.program?.commission.value ?? <span className="text-text-muted">Unknown</span>}</p>
          <p className="truncate text-xs text-text-muted">{network ?? "Network unknown"}</p>
        </div>

        <div className="min-w-0">
          {top ? (
            <>
              <p className="truncate text-sm text-text">{top.name}</p>
              <p className="text-xs text-text-muted">{formatMoney(top.price, top.currency)}</p>
            </>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </div>

        <span className="hidden text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary md:block" aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
}
