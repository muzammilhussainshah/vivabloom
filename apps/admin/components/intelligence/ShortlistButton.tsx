"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/components/ui";

const STAR = "M10 2.8l2.1 4.4 4.8.6-3.5 3.3.9 4.8L10 13.6 5.7 16l.9-4.8L3.1 7.8l4.8-.6L10 2.8Z";

/** Star a store onto the shortlist (or take it off). Works before a store has ever been checked. */
export function ShortlistButton({
  name,
  domain,
  shortlisted,
  variant = "icon",
}: {
  name: string;
  domain: string | null;
  shortlisted: boolean;
  variant?: "icon" | "button";
}) {
  const router = useRouter();
  const [on, setOn] = useState(shortlisted);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Follow the server when the list refreshes (e.g. starred from another place).
  const [seen, setSeen] = useState(shortlisted);
  if (seen !== shortlisted) {
    setSeen(shortlisted);
    setOn(shortlisted);
  }

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/shortlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, domain, shortlisted: next }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Failed");
      start(() => router.refresh());
    } catch (err) {
      setOn(!next);
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const icon = (
    <svg viewBox="0 0 20 20" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className={`h-4 w-4 ${on ? "text-amber-500" : ""}`} aria-hidden="true">
      <path d={STAR} />
    </svg>
  );
  const label = on ? "On your shortlist" : "Add to shortlist";

  if (variant === "button") {
    return (
      <button type="button" onClick={toggle} className={buttonStyles.secondary} aria-pressed={on} title={error ?? (on ? "Click to remove from the shortlist" : "Keep this store on your shortlist")}>
        {icon}
        {on ? "Shortlisted" : "Shortlist"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={error ?? label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface ${on ? "text-amber-500" : "text-text-muted hover:text-text"}`}
    >
      {icon}
    </button>
  );
}
