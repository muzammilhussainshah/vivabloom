/**
 * Validation and accessibility guard for AI-generated colour themes.
 *
 * The model proposes 9 colours; this file makes sure what gets applied is
 * usable: every value is a real hex colour, the page background is light,
 * and every text pairing meets WCAG AA (4.5:1). Colours that fail are nudged
 * darker or lighter until they pass, so a generated theme is never unreadable.
 */

export const THEME_KEYS = [
  "brandPrimary",
  "brandSecondary",
  "brandAccent",
  "surface",
  "surfaceMuted",
  "text",
  "textMuted",
  "border",
  "footerBg",
] as const;

export type ThemeValues = Record<(typeof THEME_KEYS)[number], string>;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const WHITE = "#ffffff";
const BLACK = "#000000";

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Moves a colour toward black (amount > 0) or white (amount < 0). */
function shade(hex: string, amount: number): string {
  const target = amount > 0 ? 0 : 255;
  const t = Math.abs(amount);
  return toHex(toRgb(hex).map((v) => v + (target - v) * t) as [number, number, number]);
}

/** Returns `hex` darkened (or lightened, if `towardLight`) in small steps until it reaches `min` contrast against `against`. */
function adjustUntil(hex: string, against: string, min: number, towardLight = false): string {
  let out = hex;
  for (let step = 0; step < 40 && contrast(out, against) < min; step++) {
    out = shade(out, towardLight ? -0.04 : 0.04);
  }
  return out;
}

/** Parses the model's reply. Accepts a bare JSON object or one wrapped in prose/code fences. */
export function parseThemeReply(raw: string): { name: string; values: ThemeValues } {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI reply did not contain a theme.");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("The AI reply was not valid JSON. Try again.");
  }
  const values = {} as ThemeValues;
  for (const key of THEME_KEYS) {
    const v = data[key];
    if (typeof v !== "string" || !HEX_RE.test(v.trim())) {
      throw new Error(`The AI theme is missing a valid colour for "${key}". Try again.`);
    }
    values[key] = v.trim().toLowerCase();
  }
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 40) : "AI theme";
  return { name, values };
}

/**
 * Makes a theme readable. The page is always light, so the surfaces are
 * lightened if the model made them dark, the text is darkened to 4.5:1 on
 * them, and buttons/accents are adjusted so white labels and accent text
 * stay legible. Returns the fixed palette.
 */
export function enforceReadability(input: ThemeValues): ThemeValues {
  const t = { ...input };

  // Light page surfaces: a dark surface would invert the whole design.
  if (luminance(t.surface) < 0.85) t.surface = shade(t.surface, -0.85);
  if (luminance(t.surfaceMuted) < 0.75) t.surfaceMuted = shade(t.surfaceMuted, -0.75);
  if (t.surfaceMuted === t.surface) t.surfaceMuted = shade(t.surface, 0.06);

  t.text = adjustUntil(t.text, t.surface, 7);
  t.textMuted = adjustUntil(t.textMuted, t.surface, 4.5);
  t.textMuted = adjustUntil(t.textMuted, t.surfaceMuted, 4.5);
  t.brandAccent = adjustUntil(t.brandAccent, t.surface, 4.5);
  t.brandAccent = adjustUntil(t.brandAccent, t.surfaceMuted, 4.5);

  // Buttons carry white labels.
  t.brandPrimary = adjustUntil(t.brandPrimary, WHITE, 4.5);
  t.brandSecondary = adjustUntil(t.brandSecondary, WHITE, 4.5);

  // Borders only need to be visible, not text-grade.
  if (contrast(t.border, t.surface) < 1.2) t.border = shade(t.surface, 0.14);

  // The footer carries light text.
  t.footerBg = adjustUntil(t.footerBg, WHITE, 7);
  if (luminance(t.footerBg) > 0.2) t.footerBg = shade(t.footerBg, 0.6);

  // Nothing should ever be pure black text on pure black.
  if (t.text === BLACK && t.surface === BLACK) t.text = "#111111";
  return t;
}
