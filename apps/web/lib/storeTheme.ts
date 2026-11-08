/**
 * Derived CSS variables for the store-page redesign (/stores/[slug] + its PPC
 * variants). Reuses the site's single existing theme (SiteSetting.themeTokens
 * — the same 9 fields the "Theme Colors" admin section already edits) rather
 * than a second, separate theme: changing the site's brand colors changes the
 * store pages too, so there's one theme to configure, not two. Two color
 * roles the store-page design needs that the main theme doesn't have —
 * a success/verified tint and a card background — are auto-derived from the
 * 9 base colors rather than exposed as extra admin fields.
 *
 * The derived-variable math (hover shades, on-accent text colors, translucent
 * overlays) is ported from applyTheme() in design_handoff_store_page's v4 HTML
 * prototypes — same formulas, just server-rendered here instead of applied
 * from client JS (the prototype's in-page theme picker was preview-only;
 * production reads the admin's saved values).
 */
export interface MainThemeBase {
  brandPrimary: string;
  brandSecondary: string;
  brandAccent: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  footerBg: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [1, 3, 5].map((i) => parseInt(clean.slice(i - 1, i + 1), 16)) as [number, number, number];
}

function rgbToHex(rgb: number[]): string {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Per-channel linear interpolation between two hex colors, p in [0, 1]. */
function mix(a: string, b: string, p: number): string {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  return rgbToHex(rgbA.map((v, i) => v + (rgbB[i] - v) * p));
}

function rgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgb(hex).join(",")},${alpha})`;
}

/** Relative luminance (0-1) — used to decide whether a color needs light or dark text on top of it. */
function lum(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Builds every CSS custom property the store-page components read, ready to spread onto a wrapper element's inline style. */
export function buildStoreThemeVars(base: MainThemeBase): Record<string, string> {
  const primary = base.brandPrimary;
  const secondary = base.brandSecondary;
  const accent = base.brandAccent;
  const page = base.surface;
  const muted = base.surfaceMuted;
  const text = base.text;
  const mutedText = base.textMuted;
  const border = base.border;
  const footer = base.footerBg;

  // Verified/success must always read as unambiguously positive-green
  // regardless of the theme's own hue (a red or purple "success" tint would
  // be confusing) — so it's a fixed pastel green, lightly tinted by the
  // theme's primary color for subtle thematic variation rather than looking
  // pasted-on.
  const success = mix("#8FD3AC", primary, 0.15);
  // White in most themes; only warms up for themes with a strongly warm/tan
  // page background (e.g. a Kraft-paper-style theme), matching the design
  // handoff's rule ("white everywhere except warm-paper themes") without
  // needing a per-theme special case.
  const card = lum(page) < 0.3 ? mix(page, "#FFFFFF", 0.06) : mix(page, "#FFFFFF", 0.85);

  const accentLum = lum(accent);
  const onAccent = accentLum > 0.5 ? text : page;
  const accentDark = mix(accent, "#000000", 0.16);

  return {
    "--primary": primary,
    "--secondary": secondary,
    "--accent": accent,
    "--page": page,
    "--muted": muted,
    "--text": text,
    "--muted-text": mutedText,
    "--border": border,
    "--footer": footer,
    "--success": success,
    "--card": card,

    "--accent-hi": mix(accent, "#FFFFFF", 0.15),
    "--accent-lite": mix(accent, "#FFFFFF", 0.34),
    "--accent-dark": accentDark,
    "--accent-ink": accentLum > 0.55 ? mix(accent, "#000000", 0.44) : accent,
    "--accent-on-dark": accentLum < 0.38 ? mix(accent, page, 0.5) : accent,
    "--on-accent": onAccent,
    "--on-accent-dim": rgba(onAccent, 0.62),
    "--on-accent-soft": mix(onAccent, accentDark, 0.3),
    "--accent-stripe": rgba(accent, 0.16),
    "--accent-glow": rgba(accent, 0.26),
    "--on-primary-soft": mix(page, primary, 0.16),
    "--on-primary-dim": mix(page, primary, 0.34),
    "--on-primary-faint": mix(page, primary, 0.52),
    "--text-soft": mix(text, page, 0.22),
    "--border-strong": mix(border, text, 0.2),
    "--sec-bg": rgba(success, 0.13),
    "--sec-br": rgba(success, 0.32),
    "--bar": rgba(footer, 0.96),
    "--scrim": rgba(footer, 0.6),
    "--warn": mix("#C0392B", text, 0.12),
  };
}

/** The 8 named palettes from the design handoff, for the admin's preset-fill buttons on the (single, shared) Theme Colors section. */
export const THEME_PRESETS: { id: string; label: string; values: MainThemeBase }[] = [
  {
    id: "brick",
    label: "Original Brick",
    values: {
      brandPrimary: "#9E2C1F", brandSecondary: "#9E3F1F", brandAccent: "#7F1515", surface: "#FAFAF7", surfaceMuted: "#F1EFE7",
      text: "#16231C", textMuted: "#5B6B62", border: "#C7CFBE", footerBg: "#111827",
    },
  },
  {
    id: "forest",
    label: "Forest & Gold",
    values: {
      brandPrimary: "#14382C", brandSecondary: "#B87A16", brandAccent: "#E8A626", surface: "#F6F3EC", surfaceMuted: "#EDE9DF",
      text: "#11201B", textMuted: "#5E6A63", border: "#E4DFD4", footerBg: "#0D2620",
    },
  },
  {
    id: "midnight",
    label: "Midnight & Lime",
    values: {
      brandPrimary: "#1B1F1A", brandSecondary: "#6F8F3A", brandAccent: "#C6F135", surface: "#F4F5F0", surfaceMuted: "#E9EBE2",
      text: "#14170F", textMuted: "#61665A", border: "#DDE0D4", footerBg: "#101309",
    },
  },
  {
    id: "ink",
    label: "Ink & Coral",
    values: {
      brandPrimary: "#17253F", brandSecondary: "#3E6FA8", brandAccent: "#FF6B4A", surface: "#F7F5F2", surfaceMuted: "#ECE9E4",
      text: "#121C2E", textMuted: "#5D6879", border: "#DFDBD4", footerBg: "#0D1524",
    },
  },
  {
    id: "plum",
    label: "Plum & Butter",
    values: {
      brandPrimary: "#3E1F47", brandSecondary: "#8E5AA0", brandAccent: "#F5C542", surface: "#F8F4F6", surfaceMuted: "#EEE7EF",
      text: "#221026", textMuted: "#6B5B70", border: "#E2D8E4", footerBg: "#1B0C20",
    },
  },
  {
    id: "slate",
    label: "Slate & Electric",
    values: {
      brandPrimary: "#263238", brandSecondary: "#1D4ED8", brandAccent: "#2563EB", surface: "#F5F6F7", surfaceMuted: "#E9ECEE",
      text: "#10181C", textMuted: "#5C6A72", border: "#D8DDE0", footerBg: "#0B1114",
    },
  },
  {
    id: "kraft",
    label: "Kraft & Post Red",
    values: {
      brandPrimary: "#6B4A2B", brandSecondary: "#C9A227", brandAccent: "#C8262C", surface: "#F3E9D7", surfaceMuted: "#E9DCC4",
      text: "#2A1D10", textMuted: "#6E5A42", border: "#D9C7A8", footerBg: "#241809",
    },
  },
  {
    id: "teal",
    label: "Teal & Melon",
    values: {
      brandPrimary: "#0F4C4A", brandSecondary: "#0E7C74", brandAccent: "#FF8552", surface: "#F4F7F5", surfaceMuted: "#E6EEEA",
      text: "#0C2624", textMuted: "#566B67", border: "#D4E2DC", footerBg: "#072F2E",
    },
  },
];
