"use client";

import { useSiteName } from "./SiteNameProvider";
import { splitWordmark } from "@/lib/brand";

/**
 * The VivaBloom brand mark: a layered five-petal bloom (lotus) rising from a
 * small terracotta "ground" arc — wellness + growth, matching the name.
 *
 * Colors are CSS var references so callers on different color-token systems
 * (the main site's --brand-primary/--surface vs the store-page redesign's
 * --accent/--page — same underlying admin-configured colors, different
 * variable names per scope) can each pass the right ones and land on the
 * identical resolved color without duplicating tokens.
 *
 * - markColor: petal fill.
 * - glyphColor: the background the mark sits on. Petals get a thin outline in
 *   this color so overlapping petals read as separate layers on any surface.
 * - accentColor: the ground arc under the bloom.
 */
const BASE_X = 16;
const BASE_Y = 21.5;
const PETAL = "M16 4.5C19.7 8.7 20.5 14.6 16 21.5C11.5 14.6 12.3 8.7 16 4.5Z";

export function LogoMark({
  size = 30,
  markColor = "var(--brand-primary)",
  glyphColor = "var(--surface)",
  accentColor = "var(--brand-accent)",
}: {
  size?: number;
  markColor?: string;
  glyphColor?: string;
  accentColor?: string;
}) {
  const petal = (transform: string, opacity: number) => (
    <path
      d={PETAL}
      transform={transform}
      fill={markColor}
      fillOpacity={opacity}
      stroke={glyphColor}
      strokeWidth={1.1}
      strokeLinejoin="round"
    />
  );
  const outer = (angle: number) =>
    `rotate(${angle} ${BASE_X} ${BASE_Y}) translate(${BASE_X} ${BASE_Y}) scale(0.7) translate(${-BASE_X} ${-BASE_Y})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {petal(outer(-74), 0.45)}
      {petal(outer(74), 0.45)}
      {petal(`rotate(-38 ${BASE_X} ${BASE_Y})`, 0.72)}
      {petal(`rotate(38 ${BASE_X} ${BASE_Y})`, 0.72)}
      {petal("", 1)}
      <path d="M9.5 24.6Q16 27.4 22.5 24.6" stroke={accentColor} strokeWidth={1.9} strokeLinecap="round" />
    </svg>
  );
}

/**
 * Mark + two-tone serif wordmark ("Viva" in wordmarkColor, "Bloom" in
 * bloomColor). Defaults match the main site's header; the footer and store
 * pages pass their own colors to suit their backgrounds.
 */
export function Logo({
  className,
  markColor = "var(--brand-primary)",
  glyphColor = "var(--surface-muted)",
  accentColor = "var(--brand-accent)",
  wordmarkColor = "var(--text)",
  bloomColor = "var(--brand-primary)",
}: {
  className?: string;
  markColor?: string;
  glyphColor?: string;
  accentColor?: string;
  wordmarkColor?: string;
  bloomColor?: string;
}) {
  const [first, second] = splitWordmark(useSiteName());
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={34} markColor={markColor} glyphColor={glyphColor} accentColor={accentColor} />
      <span className="font-serif text-[22px] font-semibold leading-none tracking-tight">
        <span style={{ color: wordmarkColor }}>{first}</span>
        {second && <span style={{ color: bloomColor }}>{second}</span>}
      </span>
    </span>
  );
}
