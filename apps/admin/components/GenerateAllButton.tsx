"use client";

import { useState } from "react";
import type { ArticleProduct, GeneratedArticle } from "@/lib/ai/prompts";

/**
 * One-click "generate a whole article" button. Sends the topic (and optional
 * store name / selected products) to /api/ai/generate-article and hands the
 * structured result back to the form to populate every field at once.
 */
export function GenerateAllButton({
  label = "✨ Generate All with AI",
  getTopic,
  getStoreName,
  getProducts,
  getCountry,
  onGenerated,
}: {
  label?: string;
  getTopic: () => string;
  getStoreName: () => string | undefined;
  getProducts?: () => ArticleProduct[];
  /** BLOG_COUNTRIES code to localize the article for, or "" for country-agnostic. */
  getCountry?: () => string | undefined;
  onGenerated: (article: GeneratedArticle) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const topic = getTopic().trim();
    if (!topic) {
      setError("Enter a topic first.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          storeName: getStoreName(),
          products: getProducts?.(),
          country: getCountry?.() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      onGenerated(data as GeneratedArticle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="self-start rounded-base bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {isPending ? "Generating article…" : label}
      </button>
      {error && <p className="text-xs text-brand-secondary">{error}</p>}
    </div>
  );
}
