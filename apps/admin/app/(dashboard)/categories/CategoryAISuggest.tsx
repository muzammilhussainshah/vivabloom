"use client";

import { useState } from "react";

interface MatchedCategory {
  id: string;
  slug: string;
  name: string;
}

interface SuggestResult {
  siteTitle: string | null;
  siteDescription: string | null;
  matchedCategory: MatchedCategory | null;
  suggestions: string[];
}

/** Builds the "New Category" URL, carrying the AI context along so the form's own Generate All / Generate Image buttons can reuse it. */
function newCategoryUrl(name: string, ctx: { storeUrl: string; siteTitle: string | null; siteDescription: string | null }) {
  const params = new URLSearchParams({ name });
  if (ctx.storeUrl) params.set("storeUrl", ctx.storeUrl);
  if (ctx.siteTitle) params.set("siteTitle", ctx.siteTitle);
  if (ctx.siteDescription) params.set("siteDescription", ctx.siteDescription);
  return `/categories/new?${params.toString()}`;
}

/**
 * "Generate by AI" panel for the Categories list: enter a store's URL, check
 * it against every existing category for a fit, and get fresh new-category
 * name ideas either way (an admin may want a new one even when an existing
 * category technically matches). Picking any name opens a pre-filled "New
 * Category" tab; the existing-category match instead links straight to
 * editing that category.
 */
export function CategoryAISuggest() {
  const [open, setOpen] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestResult | null>(null);

  async function handleSuggest() {
    const url = storeUrl.trim();
    if (!url) {
      setError("Enter a store URL first.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data as SuggestResult);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Suggestion failed.");
    } finally {
      setIsPending(false);
    }
  }

  const ctx = result
    ? { storeUrl: storeUrl.trim(), siteTitle: result.siteTitle, siteDescription: result.siteDescription }
    : { storeUrl: storeUrl.trim(), siteTitle: null, siteDescription: null };

  return (
    <div className="rounded-base border border-brand-primary/40 bg-surface-muted p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-brand-primary">✨ Generate by AI</span>
        <span className="text-xs text-text-muted">{open ? "Hide" : "Find or suggest a category for a store"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-text-muted">
            Enter a store&apos;s website URL. We&apos;ll check whether an existing category already fits it, and
            suggest new category names either way.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://example-store.com"
              className="flex-1 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSuggest}
              disabled={isPending}
              className="rounded-base bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {isPending ? "Checking…" : "Suggest Categories"}
            </button>
          </div>
          {error && <p className="text-xs text-brand-secondary">{error}</p>}

          {result && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              {result.matchedCategory ? (
                <div className="rounded-base border border-brand-accent/40 bg-surface p-3">
                  <p className="text-sm">
                    Existing category looks like a fit:{" "}
                    <span className="font-semibold">{result.matchedCategory.name}</span>
                  </p>
                  <a
                    href={`/categories/${result.matchedCategory.id}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-primary hover:underline"
                  >
                    Open this category →
                  </a>
                </div>
              ) : (
                <p className="text-xs text-text-muted">No existing category looked like a confident fit.</p>
              )}

              {result.suggestions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    New category ideas{" "}
                    <span className="text-text-muted">
                      (click one to open a pre-filled New Category tab{result.matchedCategory ? " — or reuse the existing one above" : ""})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.suggestions.map((name) => (
                      <a
                        key={name}
                        href={newCategoryUrl(name, ctx)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-brand-primary hover:text-brand-primary"
                      >
                        {name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1 border-t border-border pt-3">
                <label htmlFor="customCategoryName" className="text-sm font-medium">
                  Or use a custom name
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="customCategoryName"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                  />
                  <a
                    href={customName.trim() ? newCategoryUrl(customName.trim(), ctx) : undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!customName.trim()}
                    onClick={(e) => {
                      if (!customName.trim()) e.preventDefault();
                    }}
                    className={`rounded-base border border-border px-4 py-2 text-center text-sm font-medium ${
                      customName.trim() ? "hover:bg-surface" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    Create new category
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
