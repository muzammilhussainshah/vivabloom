"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/stores", label: "Stores" },
  { href: "/coupons", label: "Coupons" },
  { href: "/products", label: "Products" },
  { href: "/bundles", label: "Bundles" },
  { href: "/categories", label: "Categories" },
  { href: "/country-customization", label: "Country Customization" },
  { href: "/ad-keywords", label: "Ad Keywords" },
  { href: "/blog", label: "Blog" },
  { href: "/messages", label: "Messages" },
  { href: "/subscribers", label: "Subscribers" },
  { href: "/analytics", label: "Analytics" },
  { href: "/accounting", label: "Accounting" },
  { href: "/audit-log", label: "Audit Log" },
  { href: "/settings", label: "Settings" },
  { href: "/ai-settings", label: "AI Models" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <span className="text-lg font-bold">
      <span style={{ color: "var(--brand-primary)" }}>Viva</span>Bloom Admin
    </span>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            isActive(pathname, link.href)
              ? "bg-brand-primary text-white shadow-sm shadow-brand-primary/30"
              : "text-text-muted hover:bg-surface-muted hover:text-brand-primary"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function SignOutBlock({
  userEmail,
  signOutAction,
}: {
  userEmail?: string | null;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="border-t border-border p-3">
      {userEmail && <p className="mb-2 truncate text-xs text-text-muted">{userEmail}</p>}
      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full rounded-base border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export function AdminSidebar({
  userEmail,
  signOutAction,
}: {
  userEmail?: string | null;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="flex h-9 w-9 items-center justify-center rounded-base border border-border"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M1 1L17 17M17 1L1 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
              <path d="M0 1H18M0 7H18M0 13H18" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-surface shadow-lg">
            <div className="flex h-14 items-center border-b border-border px-4">
              <Brand />
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <SignOutBlock userEmail={userEmail} signOutAction={signOutAction} />
          </div>
        </div>
      )}

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-16 items-center border-b border-border px-4">
          <Brand />
        </div>
        <NavLinks pathname={pathname} />
        <SignOutBlock userEmail={userEmail} signOutAction={signOutAction} />
      </aside>
    </>
  );
}
