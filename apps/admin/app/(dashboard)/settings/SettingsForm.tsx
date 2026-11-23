"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "./actions";
import { updateSiteSettings } from "./actions";
import { AIGenerateImageButton } from "@/components/AIGenerateImageButton";
import { heroImagePrompt } from "@/lib/ai/prompts";

type ThemePreset = { id: string; label: string; values: Record<keyof typeof DEFAULT_THEME, string> };

// The 8 named palettes from the store-page redesign handoff — one-click
// presets for the Theme Colors section below. This single theme now drives
// both the main site AND the /stores/[slug] redesign (which derives its 2
// extra color roles — a success tint, a card background — from these same
// 9 fields; see apps/web/lib/storeTheme.ts), so there's one preset list, not
// two. Kept in sync with that file's THEME_PRESETS (duplicated here rather
// than imported since the admin app doesn't depend on the web app).
const THEME_PRESETS = [
  { id: "brick", label: "Original Brick", values: { brandPrimary: "#9E2C1F", brandSecondary: "#9E3F1F", brandAccent: "#7F1515", surface: "#FAFAF7", surfaceMuted: "#F1EFE7", text: "#16231C", textMuted: "#5B6B62", border: "#C7CFBE", footerBg: "#111827" } },
  { id: "forest", label: "Forest & Gold", values: { brandPrimary: "#14382C", brandSecondary: "#B87A16", brandAccent: "#E8A626", surface: "#F6F3EC", surfaceMuted: "#EDE9DF", text: "#11201B", textMuted: "#5E6A63", border: "#E4DFD4", footerBg: "#0D2620" } },
  { id: "midnight", label: "Midnight & Lime", values: { brandPrimary: "#1B1F1A", brandSecondary: "#6F8F3A", brandAccent: "#C6F135", surface: "#F4F5F0", surfaceMuted: "#E9EBE2", text: "#14170F", textMuted: "#61665A", border: "#DDE0D4", footerBg: "#101309" } },
  { id: "ink", label: "Ink & Coral", values: { brandPrimary: "#17253F", brandSecondary: "#3E6FA8", brandAccent: "#FF6B4A", surface: "#F7F5F2", surfaceMuted: "#ECE9E4", text: "#121C2E", textMuted: "#5D6879", border: "#DFDBD4", footerBg: "#0D1524" } },
  { id: "plum", label: "Plum & Butter", values: { brandPrimary: "#3E1F47", brandSecondary: "#8E5AA0", brandAccent: "#F5C542", surface: "#F8F4F6", surfaceMuted: "#EEE7EF", text: "#221026", textMuted: "#6B5B70", border: "#E2D8E4", footerBg: "#1B0C20" } },
  { id: "slate", label: "Slate & Electric", values: { brandPrimary: "#263238", brandSecondary: "#1D4ED8", brandAccent: "#2563EB", surface: "#F5F6F7", surfaceMuted: "#E9ECEE", text: "#10181C", textMuted: "#5C6A72", border: "#D8DDE0", footerBg: "#0B1114" } },
  { id: "kraft", label: "Kraft & Post Red", values: { brandPrimary: "#6B4A2B", brandSecondary: "#C9A227", brandAccent: "#C8262C", surface: "#F3E9D7", surfaceMuted: "#E9DCC4", text: "#2A1D10", textMuted: "#6E5A42", border: "#D9C7A8", footerBg: "#241809" } },
  { id: "teal", label: "Teal & Melon", values: { brandPrimary: "#0F4C4A", brandSecondary: "#0E7C74", brandAccent: "#FF8552", surface: "#F4F7F5", surfaceMuted: "#E6EEEA", text: "#0C2624", textMuted: "#566B67", border: "#D4E2DC", footerBg: "#072F2E" } },
  { id: "sage", label: "Sage & Rust", values: { brandPrimary: "#2F4F3E", brandSecondary: "#5E7F4F", brandAccent: "#A4552B", surface: "#F7F6F1", surfaceMuted: "#ECEDE4", text: "#1A241E", textMuted: "#5F6B63", border: "#D5D9CC", footerBg: "#17241D" } },
  { id: "ocean", label: "Ocean & Sand", values: { brandPrimary: "#0B3B5C", brandSecondary: "#1F6F8B", brandAccent: "#C2561C", surface: "#F4F8FA", surfaceMuted: "#E6EEF3", text: "#0E2233", textMuted: "#55697A", border: "#CFDCE5", footerBg: "#0A2433" } },
  { id: "rose", label: "Rose & Charcoal", values: { brandPrimary: "#4A1D2E", brandSecondary: "#9C3D5E", brandAccent: "#B0245A", surface: "#FBF6F5", surfaceMuted: "#F3EAE8", text: "#2A1620", textMuted: "#7A5F69", border: "#E7D7D8", footerBg: "#2A101A" } },
  { id: "olive", label: "Olive & Saffron", values: { brandPrimary: "#3D4A1E", brandSecondary: "#6B7A2F", brandAccent: "#8A5A0B", surface: "#F8F6EE", surfaceMuted: "#EEEBDD", text: "#1F2612", textMuted: "#666B4E", border: "#DCD8C0", footerBg: "#20280F" } },
  { id: "berry", label: "Berry & Blush", values: { brandPrimary: "#5B0F3A", brandSecondary: "#8E1F5C", brandAccent: "#C01F5C", surface: "#FFF8FA", surfaceMuted: "#FBEAF0", text: "#2B0C1E", textMuted: "#76546A", border: "#F0D9E3", footerBg: "#3A0A26" } },
  { id: "graphite", label: "Graphite & Teal", values: { brandPrimary: "#2B2F36", brandSecondary: "#4B5563", brandAccent: "#0F766E", surface: "#F5F5F4", surfaceMuted: "#E7E7E5", text: "#111318", textMuted: "#5B6170", border: "#D6D7D9", footerBg: "#15171C" } },
  { id: "sunset", label: "Sunset & Cocoa", values: { brandPrimary: "#7A2E0E", brandSecondary: "#C2410C", brandAccent: "#9A3412", surface: "#FFF7F0", surfaceMuted: "#FCEBDC", text: "#2A1408", textMuted: "#7C5A46", border: "#F0D6C2", footerBg: "#3B1606" } },
  { id: "lavender", label: "Lavender & Indigo", values: { brandPrimary: "#2E2A6B", brandSecondary: "#5B52C4", brandAccent: "#6D28D9", surface: "#F7F6FD", surfaceMuted: "#ECEBFA", text: "#1A1838", textMuted: "#5F5C7E", border: "#DEDCF0", footerBg: "#1B1941" } },
  { id: "nordic", label: "Nordic Frost", values: { brandPrimary: "#1E3A5F", brandSecondary: "#3A6A96", brandAccent: "#B4532A", surface: "#F5F8FB", surfaceMuted: "#E4ECF3", text: "#132338", textMuted: "#56687D", border: "#D2DEE9", footerBg: "#14263D" } },
  { id: "espresso", label: "Espresso & Cream", values: { brandPrimary: "#3B2A20", brandSecondary: "#8A5A3C", brandAccent: "#9A5B22", surface: "#FBF6EE", surfaceMuted: "#F1E8DB", text: "#2A1E16", textMuted: "#7A6253", border: "#E3D6C4", footerBg: "#2A1F18" } },
  { id: "jade", label: "Jade & Ivory", values: { brandPrimary: "#0E5E4E", brandSecondary: "#237A66", brandAccent: "#8A6508", surface: "#F6F8F3", surfaceMuted: "#E9EFE6", text: "#0E2A24", textMuted: "#5A6B64", border: "#D5E0D6", footerBg: "#0A2E27" } },
  { id: "crimson", label: "Crimson Velvet", values: { brandPrimary: "#6E0E1A", brandSecondary: "#A3212F", brandAccent: "#8E1B26", surface: "#FBF5F4", surfaceMuted: "#F2E6E4", text: "#2A0A0E", textMuted: "#7A5A5C", border: "#E6D2D0", footerBg: "#3A0A11" } },
  { id: "midnight-amber", label: "Midnight & Amber", values: { brandPrimary: "#0B1E3F", brandSecondary: "#2D4A7A", brandAccent: "#8A5300", surface: "#F6F7FA", surfaceMuted: "#E6E9F1", text: "#0C1628", textMuted: "#56617A", border: "#D3D9E6", footerBg: "#081427" } },
  { id: "matcha", label: "Matcha Garden", values: { brandPrimary: "#4B5D2A", brandSecondary: "#5F7230", brandAccent: "#3F6212", surface: "#F8F9F2", surfaceMuted: "#EDF0E0", text: "#1C2410", textMuted: "#5E6848", border: "#D9DEC6", footerBg: "#243014" } },
  { id: "cobalt", label: "Cobalt & Citrus", values: { brandPrimary: "#1A3FA6", brandSecondary: "#3B63D6", brandAccent: "#9A4A06", surface: "#F7F9FE", surfaceMuted: "#E8EEFB", text: "#0E1B42", textMuted: "#56648A", border: "#D5DEF3", footerBg: "#0F2470" } },
  { id: "charcoal", label: "Charcoal & Mint", values: { brandPrimary: "#1F2937", brandSecondary: "#0F766E", brandAccent: "#047857", surface: "#F7F8F8", surfaceMuted: "#E7EAEC", text: "#111827", textMuted: "#5B6573", border: "#D4D9DE", footerBg: "#111827" } },
] as const;

// Light green-brand default palette (modeled on coupondazzle.com) — brand
// colors are each tuned for how they're actually used: primary (sea green)
// is the header/CTA color, secondary (forest green) is tuned for button-
// background contrast since it's only ever used there, accent (deep green)
// is tuned for direct-text contrast since it's never a button background.
// Surface is the main page background (cream); surfaceMuted is a lighter,
// separate tone used for badges/chips/muted panels — it is NOT the footer.
// The footer is its own fixed dark section (footerBg) with hardcoded light
// text, independent of the rest of the light theme. Kept in sync with
// packages/config/src/tokens.css's :root defaults.
const DEFAULT_THEME = {
  brandPrimary: "#7c6cf0",
  brandSecondary: "#5b4bd5",
  brandAccent: "#c2379b",
  surface: "#f7f8ff",
  surfaceMuted: "#ffffff",
  text: "#1e2440",
  textMuted: "#6b7391",
  border: "#e4e8f5",
  footerBg: "#1f1b3d",
};

export interface SettingsFormInitialData {
  siteName: string;
  logoUrl?: string | null;
  tagline?: string;
  heroOverline?: string;
  heroDescription?: string;
  heroImage?: string | null;
  brandPrimary: string;
  brandSecondary: string;
  brandAccent: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  footerBg: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialYoutube?: string | null;
  socialTiktok?: string | null;
  socialDiscord?: string | null;
  ga4Id?: string | null;
  gtmId?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
  clarityId?: string | null;
  blockedCountries?: string;
  blockedIps?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** A colour picker and a hex field that stay in sync. The picker's value is what gets submitted. */
function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX_RE.test(value);
  const safe = valid ? value : "#000000";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <div
        className={`flex items-center gap-2 rounded-[10px] border bg-white p-1.5 pr-3 transition-colors focus-within:ring-2 focus-within:ring-brand-primary/15 ${
          valid ? "border-border focus-within:border-brand-primary" : "border-red-300 focus-within:border-red-400"
        }`}
      >
        <span className="relative h-8 w-9 shrink-0 overflow-hidden rounded-lg border border-black/10 shadow-inner" style={{ background: safe }}>
          <input
            id={id}
            name={id}
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label} hex code`}
          className="w-full bg-transparent font-mono text-sm uppercase text-text outline-none"
        />
        {!valid && <span className="text-xs font-medium text-red-600">Invalid</span>}
      </div>
    </div>
  );
}

/** A miniature of the public homepage + store voucher, painted with the colours being edited, so changes can be judged before saving. */
function ThemePreview({ colors }: { colors: Record<keyof typeof DEFAULT_THEME, string> }) {
  const c = colors;
  const ok = (v: string) => (HEX_RE.test(v) ? v : "#000000");
  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-[0_12px_32px_-16px_rgba(16,24,20,0.25)]" style={{ background: ok(c.surface) }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: ok(c.brandPrimary) }}>
        <span className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-md" style={{ background: ok(c.brandAccent) }} />
          <span className="text-xs font-bold" style={{ color: ok(c.surface) }}>
            Site name
          </span>
        </span>
        <span className="rounded-md px-2.5 py-1 text-[11px] font-semibold" style={{ background: ok(c.brandAccent), color: ok(c.surface) }}>
          Get code
        </span>
      </div>

      {/* Hero */}
      <div className="flex flex-col gap-2 px-4 pb-5 pt-5">
        <span className="w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: ok(c.surfaceMuted), color: ok(c.brandAccent) }}>
          Verified deals
        </span>
        <p className="text-lg font-bold leading-tight" style={{ color: ok(c.text) }}>
          Save more on the brands you buy
        </p>
        <p className="text-xs leading-relaxed" style={{ color: ok(c.textMuted) }}>
          Hand-checked coupons and deals, updated every week.
        </p>
        <span className="mt-1 w-fit rounded-lg px-3.5 py-2 text-xs font-semibold" style={{ background: ok(c.brandSecondary), color: ok(c.surface) }}>
          Browse deals
        </span>
      </div>

      {/* Card */}
      <div className="mx-4 mb-5 rounded-xl border p-3" style={{ background: ok(c.surfaceMuted), borderColor: ok(c.border) }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: ok(c.text) }}>
            Top offer
          </span>
          <span className="text-[11px] font-bold" style={{ color: ok(c.brandAccent) }}>
            −47%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: ok(c.border) }}>
          <div className="h-1.5 w-2/3 rounded-full" style={{ background: ok(c.brandPrimary) }} />
        </div>
        <p className="mt-2 text-[11px]" style={{ color: ok(c.textMuted) }}>
          Tested 2 days ago
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ background: ok(c.footerBg) }}>
        <p className="text-[11px]" style={{ color: ok(c.surface), opacity: 0.8 }}>
          © Site name · Privacy · Terms
        </p>
      </div>
    </div>
  );
}

export function SettingsForm({ initialData }: { initialData: SettingsFormInitialData }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(updateSiteSettings, undefined);

  const [heroImage, setHeroImage] = useState(initialData.heroImage ?? "");

  // Controlled (not defaultValue) — React resets uncontrolled fields to
  // blank after a form action completes, which was wiping these two right
  // after a successful save. Kept in sync with the server's response below
  // so they show the canonical, deduped list that was actually persisted.
  const [blockedCountries, setBlockedCountries] = useState(initialData.blockedCountries ?? "");
  const [blockedIps, setBlockedIps] = useState(initialData.blockedIps ?? "");

  const [colorValues, setColorValues] = useState({
    brandPrimary: initialData.brandPrimary,
    brandSecondary: initialData.brandSecondary,
    brandAccent: initialData.brandAccent,
    surface: initialData.surface,
    surfaceMuted: initialData.surfaceMuted,
    text: initialData.text,
    textMuted: initialData.textMuted,
    border: initialData.border,
    footerBg: initialData.footerBg,
  });
  function handleResetTheme() {
    setColorValues(DEFAULT_THEME);
    setActivePreset(null);
  }

  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Palettes the admin generated with AI this session; they sit above the built-ins.
  const [generatedThemes, setGeneratedThemes] = useState<ThemePreset[]>([]);
  const [presetQuery, setPresetQuery] = useState("");
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function applyThemePreset(preset: ThemePreset) {
    setColorValues(preset.values);
    setActivePreset(preset.id);
  }

  async function generateTheme() {
    setAiPending(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/generate-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: aiBrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      const preset: ThemePreset = { id: `ai-${Date.now()}`, label: data.name, values: data.values };
      setGeneratedThemes((prev) => [preset, ...prev].slice(0, 6));
      applyThemePreset(preset);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Theme generation failed.");
    } finally {
      setAiPending(false);
    }
  }

  // The list grows (built-ins + AI), so it's searchable and collapses to a
  // short preview until the admin asks for all of them.
  const allPresets: ThemePreset[] = [...generatedThemes, ...THEME_PRESETS];
  const query = presetQuery.trim().toLowerCase();
  const matchingPresets = query ? allPresets.filter((p) => p.label.toLowerCase().includes(query)) : allPresets;
  const PRESET_PREVIEW_COUNT = 8;
  const visiblePresets = query || showAllPresets ? matchingPresets : matchingPresets.slice(0, PRESET_PREVIEW_COUNT);

  function updateColor(key: keyof typeof colorValues, value: string) {
    setColorValues((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  }

  // Adjusts state during render (React's documented pattern for "sync state
  // to a changed prop") rather than in an effect, so the field updates in
  // the same render the new action result arrives in, no extra pass needed.
  const [syncedState, setSyncedState] = useState(state);
  if (state !== syncedState) {
    setSyncedState(state);
    if (state?.success) {
      if (state.blockedCountries) setBlockedCountries(state.blockedCountries.join(", "));
      if (state.blockedIps) setBlockedIps(state.blockedIps.join("\n"));
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] md:p-7">
        <h2 className="text-base font-semibold text-text">Brand</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="siteName" className="text-sm font-medium">
            Site name
          </label>
          <input
            id="siteName"
            name="siteName"
            defaultValue={initialData.siteName}
            className="max-w-sm rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tagline" className="text-sm font-medium">
            Hero heading <span className="text-text-muted">(also used as the site tagline)</span>
          </label>
          <textarea
            id="tagline"
            name="tagline"
            rows={2}
            defaultValue={initialData.tagline ?? ""}
            placeholder="Read. Learn. Grow."
            className="max-w-md rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
          <p className="text-xs text-text-muted">
            The large headline on the homepage hero. Press Enter (or type <code>\n</code>) for a line
            break. Leave blank for the default &ldquo;Read. Learn. Grow.&rdquo;
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="heroOverline" className="text-sm font-medium">
            Hero overline <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="heroOverline"
            name="heroOverline"
            defaultValue={initialData.heroOverline ?? ""}
            placeholder="Insights that matter, stories that inspire"
            className="max-w-md rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
          <p className="text-xs text-text-muted">Small uppercase line shown above the hero heading.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="heroDescription" className="text-sm font-medium">
            Hero description <span className="text-text-muted">(optional)</span>
          </label>
          <textarea
            id="heroDescription"
            name="heroDescription"
            rows={3}
            defaultValue={initialData.heroDescription ?? ""}
            placeholder="Discover powerful ideas, practical tips, and real-world knowledge…"
            className="max-w-md rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
          <p className="text-xs text-text-muted">
            Paragraph under the hero heading. Press Enter (or type <code>\n</code>) for a line break.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="logoUrl" className="text-sm font-medium">
            Logo URL <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="logoUrl"
            name="logoUrl"
            type="url"
            defaultValue={initialData.logoUrl ?? ""}
            className="max-w-md rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor="heroImage" className="text-sm font-medium">
              Homepage hero background image <span className="text-text-muted">(optional)</span>
            </label>
            <AIGenerateImageButton
              task="heroBackground"
              getPrompt={() => heroImagePrompt({ siteName: initialData.siteName,heroDescription: "", heroHeading:"",heroOverline:"" })}
              onGenerated={setHeroImage}
            />
          </div>
          <input
            id="heroImage"
            name="heroImage"
            type="url"
            placeholder="https://…"
            value={heroImage}
            onChange={(e) => setHeroImage(e.target.value)}
            className="max-w-md rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
          <p className="text-xs text-text-muted">
            Shown behind the gradient on the homepage banner. Leave blank for a plain gradient.
          </p>
          {heroImage && (
            // eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary/AI-generated URL
            <img src={heroImage} alt="Hero background preview" className="mt-1 h-24 w-full max-w-md rounded-base object-cover" />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">Theme colors</h2>
            <p className="mt-1 text-sm text-text-muted">
              Drives the whole site, including the <code className="rounded bg-surface px-1 text-xs">/stores/[slug]</code> pages and their PPC-variant URLs.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetTheme}
            className="inline-flex h-9 items-center rounded-[10px] border border-border bg-white px-3.5 text-sm font-medium text-text-muted transition-colors hover:border-text-muted/40 hover:text-text"
          >
            Reset to default
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-brand-primary/40 bg-brand-primary/[0.04] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-white" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M5 5l1.8 1.8M13.2 13.2 15 15M15 5l-1.8 1.8M6.8 13.2 5 15" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">Generate a palette with AI</p>
                    <p className="text-xs text-text-muted">Describe the mood. Every colour is checked for readability before it appears.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !aiPending) {
                        e.preventDefault();
                        generateTheme();
                      }
                    }}
                    maxLength={300}
                    placeholder="e.g. warm autumn coffee shop, cosy and editorial"
                    aria-label="Describe the theme mood"
                    className="h-10 min-w-0 flex-1 rounded-[10px] border border-border bg-white px-3 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
                  />
                  <button
                    type="button"
                    onClick={generateTheme}
                    disabled={aiPending}
                    aria-busy={aiPending}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white shadow-sm shadow-brand-primary/25 transition-colors hover:bg-brand-primary-hover disabled:opacity-70"
                  >
                    {aiPending ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Designing…
                      </>
                    ) : (
                      "Generate"
                    )}
                  </button>
                </div>
                {aiError && (
                  <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {aiError}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-text">
                  Presets <span className="font-normal text-text-muted">· {allPresets.length} palettes</span>
                </p>
                <input
                  type="search"
                  value={presetQuery}
                  onChange={(e) => setPresetQuery(e.target.value)}
                  placeholder="Search palettes"
                  aria-label="Search palettes"
                  className="h-9 w-44 rounded-[10px] border border-border bg-white px-3 text-xs text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4">
                {visiblePresets.map((preset) => {
                  const active = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyThemePreset(preset)}
                      aria-pressed={active}
                      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition-all ${
                        active
                          ? "border-brand-primary shadow-[0_0_0_3px_rgba(31,111,92,0.15)]"
                          : "border-border hover:-translate-y-0.5 hover:border-text-muted/40 hover:shadow-sm"
                      }`}
                    >
                      <span className="flex h-12 w-full">
                        <span className="flex-[3]" style={{ background: preset.values.brandPrimary }} />
                        <span className="flex-[2]" style={{ background: preset.values.brandSecondary }} />
                        <span className="flex-[2]" style={{ background: preset.values.brandAccent }} />
                        <span className="flex-[2]" style={{ background: preset.values.surfaceMuted }} />
                      </span>
                      <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                        <span className="truncate text-xs font-semibold text-text">{preset.label}</span>
                        {active && (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m2.5 6.2 2.2 2.2 4.8-4.8" />
                            </svg>
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {visiblePresets.length === 0 && (
                <p className="text-center text-xs text-text-muted">No palette matches “{presetQuery}”.</p>
              )}
              {!query && allPresets.length > PRESET_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllPresets((v) => !v)}
                  className="self-center rounded-[10px] border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-text-muted/40 hover:text-text"
                >
                  {showAllPresets ? "Show fewer" : `Show all ${allPresets.length} palettes`}
                </button>
              )}
              <p className="text-xs text-text-muted">Picking a preset only fills the fields below. Click Save changes to publish it.</p>
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-4 border-t border-border pt-6 sm:grid-cols-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted sm:col-span-2">Brand</p>
              <ColorField id="brandPrimary" label="Primary" value={colorValues.brandPrimary} onChange={(v) => updateColor("brandPrimary", v)} />
              <ColorField id="brandSecondary" label="Secondary" value={colorValues.brandSecondary} onChange={(v) => updateColor("brandSecondary", v)} />
              <ColorField id="brandAccent" label="Accent" value={colorValues.brandAccent} onChange={(v) => updateColor("brandAccent", v)} />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted sm:col-span-2 sm:pt-2">Surfaces &amp; text</p>
              <ColorField id="surface" label="Page background" value={colorValues.surface} onChange={(v) => updateColor("surface", v)} />
              <ColorField id="surfaceMuted" label="Card background" value={colorValues.surfaceMuted} onChange={(v) => updateColor("surfaceMuted", v)} />
              <ColorField id="text" label="Text" value={colorValues.text} onChange={(v) => updateColor("text", v)} />
              <ColorField id="textMuted" label="Muted text" value={colorValues.textMuted} onChange={(v) => updateColor("textMuted", v)} />
              <ColorField id="border" label="Border" value={colorValues.border} onChange={(v) => updateColor("border", v)} />
              <ColorField id="footerBg" label="Footer" value={colorValues.footerBg} onChange={(v) => updateColor("footerBg", v)} />
            </div>
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <p className="mb-2 text-sm font-medium text-text">Live preview</p>
            <ThemePreview colors={colorValues} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] md:p-7">
        <h2 className="text-base font-semibold text-text">Contact</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="contactEmail" className="text-sm font-medium">
              Email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={initialData.contactEmail ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="contactPhone" className="text-sm font-medium">
              Phone <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              defaultValue={initialData.contactPhone ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="contactAddress" className="text-sm font-medium">
            Address <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="contactAddress"
            name="contactAddress"
            defaultValue={initialData.contactAddress ?? ""}
            className="max-w-md rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] md:p-7">
        <h2 className="text-base font-semibold text-text">Social Links</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="socialFacebook" className="text-sm font-medium">
              Facebook
            </label>
            <input
              id="socialFacebook"
              name="socialFacebook"
              type="url"
              defaultValue={initialData.socialFacebook ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="socialInstagram" className="text-sm font-medium">
              Instagram
            </label>
            <input
              id="socialInstagram"
              name="socialInstagram"
              type="url"
              defaultValue={initialData.socialInstagram ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="socialYoutube" className="text-sm font-medium">
              YouTube
            </label>
            <input
              id="socialYoutube"
              name="socialYoutube"
              type="url"
              defaultValue={initialData.socialYoutube ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="socialTiktok" className="text-sm font-medium">
              TikTok
            </label>
            <input
              id="socialTiktok"
              name="socialTiktok"
              type="url"
              defaultValue={initialData.socialTiktok ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="socialDiscord" className="text-sm font-medium">
              Discord
            </label>
            <input
              id="socialDiscord"
              name="socialDiscord"
              type="url"
              defaultValue={initialData.socialDiscord ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] md:p-7">
        <h2 className="text-base font-semibold text-text">
          Analytics &amp; Ads <span className="text-sm font-normal text-text-muted">(IDs only — wired up in a later phase)</span>
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="ga4Id" className="text-sm font-medium">
              GA4 Measurement ID
            </label>
            <input
              id="ga4Id"
              name="ga4Id"
              placeholder="G-XXXXXXXXXX"
              defaultValue={initialData.ga4Id ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="gtmId" className="text-sm font-medium">
              GTM Container ID
            </label>
            <input
              id="gtmId"
              name="gtmId"
              placeholder="GTM-XXXXXXX"
              defaultValue={initialData.gtmId ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="googleAdsConversionId" className="text-sm font-medium">
              Google Ads Conversion ID
            </label>
            <input
              id="googleAdsConversionId"
              name="googleAdsConversionId"
              placeholder="AW-XXXXXXXXX"
              defaultValue={initialData.googleAdsConversionId ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="googleAdsConversionLabel" className="text-sm font-medium">
              Google Ads Conversion Label
            </label>
            <input
              id="googleAdsConversionLabel"
              name="googleAdsConversionLabel"
              defaultValue={initialData.googleAdsConversionLabel ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="clarityId" className="text-sm font-medium">
              Microsoft Clarity Project ID
            </label>
            <input
              id="clarityId"
              name="clarityId"
              placeholder="e.g. abcd1234ef"
              defaultValue={initialData.clarityId ?? ""}
              className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
            />
            <p className="text-xs text-text-muted">
              From clarity.microsoft.com → your project → Settings → Setup. Records session replays and heatmaps,
              including iOS Safari sessions GA4 undercounts.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-12px_rgba(16,24,20,0.08)] md:p-7">
        <h2 className="text-base font-semibold text-text">Regional Access</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="blockedCountries" className="text-sm font-medium">
            Blocked countries <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="blockedCountries"
            name="blockedCountries"
            value={blockedCountries}
            onChange={(e) => setBlockedCountries(e.target.value)}
            placeholder="PK, IN"
            className="max-w-md rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
          <p className="text-xs text-text-muted">
            Comma-separated ISO country codes (e.g. <code>PK, IN</code>). Visitors from these countries see a
            &ldquo;not available in your region&rdquo; page. Leave blank to allow everyone. Takes up to a minute to
            propagate to the public site.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="blockedIps" className="text-sm font-medium">
            Blocked IPs <span className="text-text-muted">(optional)</span>
          </label>
          <textarea
            id="blockedIps"
            name="blockedIps"
            value={blockedIps}
            onChange={(e) => setBlockedIps(e.target.value)}
            placeholder={"203.0.113.5\n198.51.100.20"}
            rows={4}
            className="max-w-md resize-y rounded-[10px] border border-border bg-white px-3 py-2 font-mono text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] transition-colors hover:border-text-muted/40 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
          />
          <p className="text-xs text-text-muted">
            One IP per line, or comma-separated — paste directly from the Suspicious activity tab&rsquo;s
            &ldquo;Block these IPs&rdquo; list. These are blocked manually, only what you add here — nothing is
            blocked automatically. Leave blank to allow everyone. Takes up to a minute to propagate to the public
            site.
          </p>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/95 px-4 py-3 shadow-[0_12px_32px_-12px_rgba(16,24,20,0.25)] backdrop-blur">
        <p className="text-xs text-text-muted">Changes go live on the public site after you save.</p>
        <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-brand-primary px-6 text-sm font-semibold text-white shadow-sm shadow-brand-primary/25 transition-colors hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Settings"}
        </button>
        {state?.success && <p className="text-sm text-brand-accent">Saved — public site updated.</p>}
        {state?.error && <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.error}</p>}
        </div>
      </div>
    </form>
  );
}
