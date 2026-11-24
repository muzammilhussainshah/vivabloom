"use client";

import { useState } from "react";

const SIZES = { sm: "h-10 w-10 rounded-xl text-sm", md: "h-12 w-12 rounded-xl text-base", lg: "h-16 w-16 rounded-2xl text-xl" } as const;

/**
 * A store's logo that never shows a broken image: the logo we found → the
 * site's favicon (via Google's public favicon service) → the first letter.
 */
export function StoreLogo({ src, domain, name, size = "md" }: { src: string | null | undefined; domain: string; name: string; size?: keyof typeof SIZES }) {
  const candidates = [src, `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`].filter((u): u is string => Boolean(u));
  const [index, setIndex] = useState(0);
  const current = candidates[index];
  const box = `${SIZES[size]} flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white shadow-[0_1px_2px_rgba(16,24,20,0.05)]`;

  if (!current) {
    return (
      <span className={`${box} bg-gradient-to-br from-brand-primary/15 to-brand-primary/5 font-bold text-brand-primary`} aria-hidden="true">
        {(name || domain).charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote store logos from arbitrary hosts */}
      <img src={current} alt={`${name} logo`} className="h-full w-full object-contain p-1.5" onError={() => setIndex((i) => i + 1)} loading="lazy" />
    </span>
  );
}
