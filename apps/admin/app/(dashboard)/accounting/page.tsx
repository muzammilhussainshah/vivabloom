import Link from "next/link";
import type { Metadata } from "next";
import { DashboardTab } from "./DashboardTab";
import { DailySummaryTab } from "./DailySummaryTab";
import { TodayReportTab } from "./TodayReportTab";
import { LifetimeReportTab } from "./LifetimeReportTab";
import { EntriesTab } from "./EntriesTab";
import { PaymentsTab } from "./PaymentsTab";
import { PaymentTermsTab } from "./PaymentTermsTab";

export const metadata: Metadata = { title: "Accounting" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "dashboard", label: "Dashboard", href: "/accounting" },
  { key: "day", label: "Daily Summary", href: "/accounting?tab=day" },
  { key: "today-report", label: "Monthly Store Report", href: "/accounting?tab=today-report" },
  { key: "lifetime-report", label: "Lifetime Stores Report", href: "/accounting?tab=lifetime-report" },
  { key: "entries", label: "Daily Entries", href: "/accounting?tab=entries" },
  { key: "payments", label: "Payments", href: "/accounting?tab=payments" },
  { key: "payment-terms", label: "Payment Terms", href: "/accounting?tab=payment-terms" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** In-page tab strip — same visual convention as the Analytics page's TabNav. Tab state lives entirely in the `tab` query param, so switching tabs is just a normal navigation (no client component needed to render this). */
function AccountingTabNav({ active }: { active: TabKey }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            active === t.key ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

interface AccountingSearchParams {
  tab?: string;
  month?: string;
  date?: string;
  trMonth?: string;
  trFrom?: string;
  trTo?: string;
  ltFrom?: string;
  ltTo?: string;
  enStore?: string;
  enFrom?: string;
  enTo?: string;
  editEntry?: string;
  error?: string;
  editTerm?: string;
}

export default async function AccountingPage({ searchParams }: { searchParams: Promise<AccountingSearchParams> }) {
  const params = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "dashboard";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Accounting</h1>

      <AccountingTabNav active={tab} />

      {tab === "dashboard" && <DashboardTab searchParams={params} />}
      {tab === "day" && <DailySummaryTab searchParams={params} />}
      {tab === "today-report" && <TodayReportTab searchParams={params} />}
      {tab === "lifetime-report" && <LifetimeReportTab searchParams={params} />}
      {tab === "entries" && <EntriesTab searchParams={params} />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "payment-terms" && <PaymentTermsTab searchParams={params} />}
    </div>
  );
}
