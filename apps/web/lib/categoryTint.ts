export interface CategoryTint {
  from: string;
  to: string;
  /** Text color to overlay on this specific gradient — the gold tint is too light for white text to read well, unlike the two darker tints. */
  ink: string;
}

// 3 real hues (not 4) on purpose: this site's brand-secondary and
// brand-accent are both gold-toned ("Forest & Gold" admin theme), so
// including both here would make 2 of the 4 tints look near-identical.
// brand-accent alone (tuned for text/link contrast) already covers gold.
const PALETTE: CategoryTint[] = [
  { from: "var(--brand-primary)", to: "var(--brand-primary-hover)", ink: "var(--surface)" },
  { from: "var(--brand-accent)", to: "var(--brand-accent-hover)", ink: "var(--text)" },
  { from: "var(--accent-teal)", to: "var(--accent-teal-hover)", ink: "var(--surface)" },
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic per-category color, derived from the slug so it's stable across requests/builds without needing an admin-authored color field. */
export function tintForSlug(slug: string): CategoryTint {
  return PALETTE[hashSlug(slug) % PALETTE.length];
}

export function tintGradient(slug: string): string {
  const { from, to } = tintForSlug(slug);
  return `linear-gradient(155deg, ${from}, ${to})`;
}
