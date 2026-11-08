"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "./actions";
import { updateSiteSettings } from "./actions";
import { AIGenerateImageButton } from "@/components/AIGenerateImageButton";
import { heroImagePrompt } from "@/lib/ai/prompts";

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

function ColorField({ id, label, defaultValue }: { id: string; label: string; defaultValue: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input id={id} name={id} type="color" defaultValue={defaultValue} className="h-9 w-12 rounded-base border border-border bg-surface p-1" />
        <input
          type="text"
          defaultValue={defaultValue}
          onChange={(e) => {
            const colorInput = document.getElementById(id) as HTMLInputElement | null;
            if (colorInput && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) colorInput.value = e.target.value;
          }}
          className="w-28 rounded-base border border-border bg-surface px-2 py-1.5 font-mono text-sm focus:border-brand-primary focus:outline-none"
        />
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
  // ColorField's inputs are uncontrolled (defaultValue) — bumping this key
  // forces them to remount and re-read colorValues, which is how "Reset"
  // takes visual effect without fighting the uncontrolled inputs' state.
  const [resetNonce, setResetNonce] = useState(0);

  function handleResetTheme() {
    setColorValues(DEFAULT_THEME);
    setResetNonce((n) => n + 1);
    setActivePreset(null);
  }

  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyThemePreset(preset: (typeof THEME_PRESETS)[number]) {
    setColorValues(preset.values);
    setResetNonce((n) => n + 1);
    setActivePreset(preset.id);
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
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Brand</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="siteName" className="text-sm font-medium">
            Site name
          </label>
          <input
            id="siteName"
            name="siteName"
            defaultValue={initialData.siteName}
            className="max-w-sm rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
            className="max-w-md rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
            className="max-w-md rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
            className="max-w-md rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
            className="max-w-md rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
            className="max-w-md rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Theme Colors</h2>
          <button
            type="button"
            onClick={handleResetTheme}
            className="rounded-base border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
          >
            Reset to Default Theme
          </button>
        </div>
        <p className="-mt-2 text-xs text-text-muted">
          Drives the whole site, including the <code>/stores/[slug]</code> pages and their PPC-variant URLs.
        </p>
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyThemePreset(preset)}
              className={`flex items-center gap-2 rounded-base border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activePreset === preset.id ? "border-brand-primary bg-brand-primary/10" : "border-border hover:bg-surface-muted"
              }`}
            >
              <span className="flex h-3.5 w-3.5 overflow-hidden rounded-full border border-border">
                <span className="w-1/3" style={{ backgroundColor: preset.values.brandPrimary }} />
                <span className="w-1/3" style={{ backgroundColor: preset.values.brandAccent }} />
                <span className="w-1/3" style={{ backgroundColor: preset.values.surface }} />
              </span>
              {preset.label}
            </button>
          ))}
        </div>
        <p className="-mt-2 text-xs text-text-muted">Picking a preset or resetting only updates the fields below — click Save Settings to apply.</p>
        <div key={resetNonce} className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-6">
            <ColorField id="brandPrimary" label="Primary color" defaultValue={colorValues.brandPrimary} />
            <ColorField id="brandSecondary" label="Secondary color" defaultValue={colorValues.brandSecondary} />
            <ColorField id="brandAccent" label="Accent color" defaultValue={colorValues.brandAccent} />
          </div>
          <div className="flex flex-wrap gap-6">
            <ColorField id="surface" label="Page background" defaultValue={colorValues.surface} />
            <ColorField id="surfaceMuted" label="Muted background" defaultValue={colorValues.surfaceMuted} />
            <ColorField id="text" label="Text color" defaultValue={colorValues.text} />
            <ColorField id="textMuted" label="Muted text color" defaultValue={colorValues.textMuted} />
            <ColorField id="border" label="Border color" defaultValue={colorValues.border} />
            <ColorField id="footerBg" label="Footer background" defaultValue={colorValues.footerBg} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Contact</h2>
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
            className="max-w-md rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Social Links</h2>
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
            <p className="text-xs text-text-muted">
              From clarity.microsoft.com → your project → Settings → Setup. Records session replays and heatmaps,
              including iOS Safari sessions GA4 undercounts.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Regional Access</h2>
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
            className="max-w-md rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
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
            className="max-w-md resize-y rounded-base border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
          />
          <p className="text-xs text-text-muted">
            One IP per line, or comma-separated — paste directly from the Suspicious activity tab&rsquo;s
            &ldquo;Block these IPs&rdquo; list. These are blocked manually, only what you add here — nothing is
            blocked automatically. Leave blank to allow everyone. Takes up to a minute to propagate to the public
            site.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Settings"}
        </button>
        {state?.success && <p className="text-sm text-brand-accent">Saved — public site updated.</p>}
        {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
      </div>
    </form>
  );
}
