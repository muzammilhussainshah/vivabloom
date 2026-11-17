import Link from "next/link";

/** "← All articles"-style link back to a listing page, with a real icon and proper spacing. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-muted py-1.5 pl-2.5 pr-3.5 text-sm font-medium text-text-muted transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="transition-transform duration-200 group-hover:-translate-x-0.5"
      >
        <path d="M13 8H3M7 4 3 8l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}
