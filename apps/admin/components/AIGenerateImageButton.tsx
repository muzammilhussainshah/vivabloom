"use client";

import { useState } from "react";

export function AIGenerateImageButton({
  label = "Generate with AI",
  getPrompt,
  onGenerated,
  task,
}: {
  label?: string;
  getPrompt: () => string;
  onGenerated: (url: string) => void;
  /** Selects which model runs this job (see lib/ai/prompts.ts AI_MODELS.image). */
  task?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: getPrompt(), task }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      onGenerated(data.url);
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
        className="self-start rounded-base border border-brand-primary px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-surface-muted disabled:opacity-60"
      >
        {isPending ? "Generating image…" : label}
      </button>
      {error && <p className="text-xs text-brand-secondary">{error}</p>}
    </div>
  );
}
