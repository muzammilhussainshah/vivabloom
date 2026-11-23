"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/* 18px line icons, currentColor. */
const I = {
  dashboard: <path d="M3.5 4.5h5v6h-5zM11.5 4.5h5v3h-5zM11.5 10.5h5v5h-5zM3.5 13.5h5v2h-5z" />,
  analytics: <path d="M3.5 16.5h13M6 13v-3M10 13V6.5M14 13V9" />,
  stores: <path d="M3.5 8 5 4h10l1.5 4M3.5 8v8h13V8M3.5 8c0 1.4 1.1 2 2.2 2s2.1-.6 2.1-2c0 1.4 1 2 2.2 2s2.2-.6 2.2-2c0 1.4 1 2 2.1 2s2.2-.6 2.2-2M8 16v-3.5h4V16" />,
  coupons: <path d="M3.5 7a1.5 1.5 0 0 0 0 3v0a1.5 1.5 0 0 1 0 3v1.5h13V13a1.5 1.5 0 0 1 0-3 1.5 1.5 0 0 0 0-3V5.5h-13zM12 6v1.5M12 9.5v1M12 12.5V14" />,
  products: <path d="M10 3 16.5 6.5v7L10 17l-6.5-3.5v-7zM3.5 6.5 10 10l6.5-3.5M10 10v7" />,
  bundles: <path d="M3.5 8.5h13v8h-13zM2.5 5.5h15v3h-15zM10 5.5v11M10 5.5S8.5 2.5 6.5 3.5 8 5.5 10 5.5c2 0 4.5-1 3.5-2S10 5.5 10 5.5" />,
  categories: <path d="M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z" />,
  globe: <path d="M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM3 10h14M10 3c2 2 2.8 4.5 2.8 7S12 15 10 17c-2-2-2.8-4.5-2.8-7S8 5 10 3Z" />,
  keywords: <path d="M4 6.5h12M4 10h8M4 13.5h5M14.5 12l2 2-2 2" />,
  blog: <path d="M5 3.5h7l3 3v10H5zM12 3.5v3h3M7.5 10h5M7.5 13h5" />,
  messages: <path d="M3.5 5h13v8.5h-8L5 16.5v-3H3.5z" />,
  subscribers: <path d="M3.5 5.5h13v9h-13zM3.5 6l6.5 5 6.5-5" />,
  accounting: <path d="M10 3v14M13.5 6H8.3a2.3 2.3 0 0 0 0 4.5h3.4a2.3 2.3 0 0 1 0 4.5H6" />,
  audit: <path d="M10 3.5a6.5 6.5 0 1 1-6.1 4.3M10 6.5V10l2.5 1.5M3.5 4v3.5H7" />,
  settings: <path d="M10 7.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4ZM15.6 11.4l1.3 1-1.5 2.6-1.6-.6a5.6 5.6 0 0 1-1.6.9l-.3 1.7H8.1l-.3-1.7a5.6 5.6 0 0 1-1.6-.9l-1.6.6-1.5-2.6 1.3-1a5.6 5.6 0 0 1 0-1.8l-1.3-1 1.5-2.6 1.6.6a5.6 5.6 0 0 1 1.6-.9l.3-1.7h3l.3 1.7c.6.2 1.1.5 1.6.9l1.6-.6 1.5 2.6-1.3 1a5.6 5.6 0 0 1 0 1.8Z" />,
  ai: <path d="M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M5 5l1.8 1.8M13.2 13.2 15 15M15 5l-1.8 1.8M6.8 13.2 5 15M10 7.5l.9 1.6 1.6.9-1.6.9-.9 1.6-.9-1.6-1.6-.9 1.6-.9z" />,
  external: <path d="M11 4h5v5M16 4l-7 7M14 11.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5" />,
  signOut: <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12.5 13.5 16 10l-3.5-3.5M16 10H8" />,
};

function Icon({ name, className = "h-[18px] w-[18px]" }: { name: keyof typeof I; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`${className} shrink-0`} aria-hidden="true">
      {I[name]}
    </svg>
  );
}

const NAV: { label: string; items: { href: string; label: string; icon: keyof typeof I }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: "dashboard" },
      { href: "/analytics", label: "Analytics", icon: "analytics" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/stores", label: "Stores", icon: "stores" },
      { href: "/coupons", label: "Coupons", icon: "coupons" },
      { href: "/products", label: "Products", icon: "products" },
      { href: "/bundles", label: "Bundles", icon: "bundles" },
      { href: "/categories", label: "Categories", icon: "categories" },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/blog", label: "Blog", icon: "blog" },
      { href: "/ad-keywords", label: "Ad Keywords", icon: "keywords" },
      { href: "/country-customization", label: "Countries", icon: "globe" },
    ],
  },
  {
    label: "Audience",
    items: [
      { href: "/messages", label: "Messages", icon: "messages" },
      { href: "/subscribers", label: "Subscribers", icon: "subscribers" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/accounting", label: "Accounting", icon: "accounting" },
      { href: "/audit-log", label: "Audit Log", icon: "audit" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/ai-settings", label: "AI Models", icon: "ai" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ siteName }: { siteName: string }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-primary text-white shadow-sm shadow-brand-primary/30">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M10 16.5V9M10 9C10 6 8 3.5 4.5 3.5 4.5 7 7 9 10 9ZM10 11.5c0-3 2-5.5 5.5-5.5 0 3.5-2.5 5.5-5.5 5.5Z" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-bold text-text">{siteName}</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">Admin</span>
      </span>
    </Link>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label="Admin">
      {NAV.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-muted/80">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                      active ? "bg-brand-primary/10 font-semibold text-brand-primary" : "font-medium text-text-muted hover:bg-surface hover:text-text"
                    }`}
                  >
                    {active && <span className="absolute -left-3 top-1.5 h-6 w-1 rounded-r-full bg-brand-primary" aria-hidden="true" />}
                    <Icon name={item.icon} className={`h-[18px] w-[18px] ${active ? "text-brand-primary" : "text-text-muted/80 group-hover:text-text"}`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserCard({ userEmail, signOutAction }: { userEmail?: string | null; signOutAction: () => Promise<void> }) {
  const initial = (userEmail ?? "A").charAt(0).toUpperCase();
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-sm font-bold text-white">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">Administrator</p>
          {userEmail && <p className="truncate text-xs text-text-muted">{userEmail}</p>}
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Icon name="signOut" />
          </button>
        </form>
      </div>
    </div>
  );
}

function SiteLink({ siteUrl }: { siteUrl?: string | null }) {
  if (!siteUrl) return null;
  return (
    <a
      href={siteUrl}
      target="_blank"
      rel="noopener"
      className="mx-3 mt-3 flex h-9 items-center justify-between rounded-lg border border-border bg-white px-3 text-sm font-medium text-text-muted transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
    >
      View live site
      <Icon name="external" className="h-4 w-4" />
    </a>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col bg-white">{children}</div>;
}

export function AdminSidebar({
  userEmail,
  siteName = "VivaBloom",
  siteUrl,
  signOutAction,
}: {
  userEmail?: string | null;
  siteName?: string;
  siteUrl?: string | null;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-white/90 px-4 backdrop-blur md:hidden">
        <Brand siteName={siteName} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white"
        >
          {open ? (
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
              <path d="M1 1H17M1 7H17M1 13H17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 shadow-2xl">
            <Panel>
              <div className="flex h-16 items-center border-b border-border px-5">
                <Brand siteName={siteName} />
              </div>
              <SiteLink siteUrl={siteUrl} />
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
              <UserCard userEmail={userEmail} signOutAction={signOutAction} />
            </Panel>
          </div>
        </div>
      )}

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border md:block">
        <Panel>
          <div className="flex h-16 items-center border-b border-border px-5">
            <Brand siteName={siteName} />
          </div>
          <SiteLink siteUrl={siteUrl} />
          <NavLinks pathname={pathname} />
          <UserCard userEmail={userEmail} signOutAction={signOutAction} />
        </Panel>
      </aside>
    </>
  );
}
