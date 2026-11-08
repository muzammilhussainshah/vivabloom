"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Logo } from "./Logo";
import type { CategoryRef } from "@/lib/data";

/** The blog-first homepage — named for what's actually there (Editor's Pick, Most Read, category spotlights), not a generic "Home". */
const INSIGHTS_LINK = { href: "/", label: "Insights" };
const DEALS_LINK = { href: "/deals", label: "Deals & Discounts" };

const REST_LINKS = [
  { href: "/stores", label: "Stores" },
  { href: "/products", label: "Products" },
];

/** Exact match for the homepage (every other route also starts with "/"); prefix match for everything else. */
function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className}>
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SearchSuggestion {
  _id: string;
  title: string;
  slug: string;
  category?: { name: string; slug: string } | null;
}

function SearchBar({ onSubmitted, className }: { onSubmitted?: () => void; className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const query = value.trim();

  // Fetches matching posts. The AbortController cancels an in-flight request
  // when a newer keystroke arrives, so responses can't land out of order.
  async function fetchSuggestions(q: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/posts?q=${encodeURIComponent(q)}&limit=6`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as { posts: SearchSuggestion[] };
      setSuggestions(data.posts ?? []);
      setActive(-1);
      setOpen(true);
    } catch {
      // ignore aborts / transient errors — the dropdown just won't update
    } finally {
      setLoading(false);
    }
  }

  // Debounce fetches from the change handler (not an effect) so typing stays snappy.
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = next.trim();
    if (q.length < 2) {
      abortRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 200);
  }

  // Cancel any pending debounce/request on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Close when clicking outside the search box.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function submitSearch() {
    router.push(query ? `/blog?q=${encodeURIComponent(query)}` : "/blog");
    close();
    onSubmitted?.();
  }

  function goToPost(slug: string) {
    router.push(`/blog/${slug}`);
    close();
    onSubmitted?.();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (active >= 0 && active < suggestions.length) goToPost(suggestions[active].slug);
    else submitSearch();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      close();
    }
  }

  const showDropdown = open && query.length >= 2 && (loading || suggestions.length > 0);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <form onSubmit={handleSubmit} className="relative" role="search">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          name="q"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder="Search blogs..."
          aria-label="Search blogs"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          className="w-full rounded-full border border-border bg-surface-muted py-2 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15 focus:outline-none"
        />
      </form>

      {showDropdown && (
        <div
          id="search-suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-surface-muted text-text"
        >
          {suggestions.length === 0 && loading ? (
            <p className="px-4 py-3 text-sm text-text-muted">Searching…</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
              {suggestions.map((s, i) => (
                <li key={s._id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => goToPost(s.slug)}
                    className={`flex w-full flex-col items-start px-4 py-2 text-left transition-colors ${
                      i === active ? "bg-surface" : "hover:bg-surface"
                    }`}
                  >
                    <span className="line-clamp-1 text-sm font-medium">{s.title}</span>
                    {s.category?.name && (
                      <span className="text-xs text-text-muted">in {s.category.name}</span>
                    )}
                  </button>
                </li>
              ))}
              <li className="border-t border-border">
                <button
                  type="button"
                  onClick={submitSearch}
                  className="flex w-full items-center gap-1 px-4 py-2 text-left text-sm font-medium text-brand-primary hover:bg-surface"
                >
                  Search for “{query}”
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Desktop "Categories" nav item — a hover/click dropdown listing every active category. */
function CategoriesDropdown({ categories, active = false }: { categories: CategoryRef[]; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
          active ? "bg-brand-primary text-white " : "text-text-muted hover:bg-brand-primary/10 hover:text-brand-primary"
        }`}
      >
        Categories
        <ChevronIcon className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 w-56 overflow-hidden rounded-2xl border border-border bg-surface-muted text-text">
          {categories.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No categories yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {categories.map((c) => (
                <li key={c._id}>
                  <Link
                    href={`/category/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-surface"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/categories"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2 text-sm font-medium text-brand-primary hover:bg-surface"
          >
            View All Categories →
          </Link>
        </div>
      )}
    </div>
  );
}

/** Mobile "Categories" nav item — expands inline into the category list instead of navigating away. */
function CategoriesAccordion({
  categories,
  onNavigate,
  active = false,
}: {
  categories: CategoryRef[];
  onNavigate: () => void;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-text hover:bg-brand-primary/10"
      >
        <span className={active ? "underline decoration-brand-primary decoration-2 underline-offset-4" : ""}>
          Categories
        </span>
        <ChevronIcon className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-2 flex flex-col gap-1 border-l-2 border-brand-primary/30 pl-2">
          {categories.map((c) => (
            <Link
              key={c._id}
              href={`/category/${c.slug}`}
              onClick={onNavigate}
              className="rounded-xl px-2 py-1.5 text-sm text-text-muted hover:bg-brand-primary/10 hover:text-brand-primary"
            >
              {c.name}
            </Link>
          ))}
          <Link
            href="/categories"
            onClick={onNavigate}
            className="rounded-xl px-2 py-1.5 text-sm font-medium text-brand-primary hover:bg-brand-primary/10"
          >
            View All Categories →
          </Link>
        </div>
      )}
    </div>
  );
}

export function Header({ categories = [] }: { categories?: CategoryRef[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const categoriesActive = isActivePath(pathname, "/category") || isActivePath(pathname, "/categories");

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface-muted">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link href="/" onClick={() => setMenuOpen(false)} className="shrink-0">
          <Logo markColor="var(--brand-primary)" glyphColor="#fff" wordmarkColor="var(--brand-primary)" />
        </Link>

        <SearchBar className="hidden max-w-sm flex-1 md:block" />

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Link
            href={INSIGHTS_LINK.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              isActivePath(pathname, INSIGHTS_LINK.href)
                ? "bg-brand-primary text-white "
                : "text-text-muted hover:bg-brand-primary/10 hover:text-brand-primary"
            }`}
          >
            {INSIGHTS_LINK.label}
          </Link>
          <CategoriesDropdown categories={categories} active={categoriesActive} />
          <Link
            href={DEALS_LINK.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-brand-accent transition-colors hover:bg-brand-primary/10 ${
              isActivePath(pathname, DEALS_LINK.href) ? "bg-brand-primary/10" : ""
            }`}
          >
            {DEALS_LINK.label}
          </Link>
          {REST_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                isActivePath(pathname, link.href)
                  ? "bg-brand-primary text-white "
                  : "text-text-muted hover:bg-brand-primary/10 hover:text-brand-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-muted text-brand-primary md:hidden"
        >
          <span className="sr-only">Toggle menu</span>
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M1 1L17 17M17 1L1 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
              <path d="M0 1H18M0 7H18M0 13H18" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-border px-5 py-3 md:hidden">
          <SearchBar onSubmitted={() => setMenuOpen(false)} />
          <nav className="flex flex-col gap-1">
            <Link
              href={INSIGHTS_LINK.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-text hover:bg-brand-primary/10"
            >
              <span
                className={isActivePath(pathname, INSIGHTS_LINK.href) ? "underline decoration-brand-primary decoration-2 underline-offset-4" : ""}
              >
                {INSIGHTS_LINK.label}
              </span>
            </Link>
            <CategoriesAccordion categories={categories} onNavigate={() => setMenuOpen(false)} active={categoriesActive} />
            <Link
              href={DEALS_LINK.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-accent hover:bg-brand-primary/10"
            >
              <span
                className={isActivePath(pathname, DEALS_LINK.href) ? "underline decoration-2 underline-offset-4" : ""}
              >
                {DEALS_LINK.label}
              </span>
            </Link>
            {REST_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-text hover:bg-brand-primary/10 hover:text-brand-primary"
              >
                <span
                  className={isActivePath(pathname, link.href) ? "underline decoration-brand-primary decoration-2 underline-offset-4" : ""}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
